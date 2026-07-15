import json
import unittest
from contextlib import contextmanager

from fastapi import HTTPException

from app import main


class FakeCursor:
    def __init__(self, conn):
        self.conn = conn
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, sql, params=()):
        statement = " ".join(sql.split())
        if statement.startswith("SELECT id FROM product"):
            values = [int(value) for value in params]
            self.rows = [{"id": product_id} for product_id in sorted(values) if product_id in self.conn.products]
        elif statement.startswith("SELECT id, is_deleted FROM tag"):
            values = [int(value) for value in params]
            self.rows = [
                {"id": tag_id, "is_deleted": self.conn.tags[tag_id]["is_deleted"]}
                for tag_id in sorted(values)
                if tag_id in self.conn.tags
            ]
        elif statement.startswith("SELECT product_id, tag_id FROM product_tag"):
            values = [int(value) for value in params]
            requested = set(values)
            self.rows = [
                {"product_id": product_id, "tag_id": tag_id}
                for product_id, tag_id in sorted(self.conn.relations)
                if product_id in requested
            ]
        elif statement.startswith("SELECT pt.product_id, t.id AS tag_id"):
            values = [int(value) for value in params]
            requested = set(values)
            self.rows = [
                {
                    "product_id": product_id,
                    "tag_id": tag_id,
                    "tag_name": self.conn.tags[tag_id]["name"],
                    "sort_order": self.conn.tags[tag_id]["sort_order"],
                }
                for product_id, tag_id in sorted(self.conn.relations)
                if product_id in requested and tag_id in self.conn.tags and not self.conn.tags[tag_id]["is_deleted"]
            ]
        elif statement.startswith("DELETE FROM product_tag WHERE product_id IN"):
            values = [int(value) for value in params]
            requested = set(values)
            self.conn.relations = {
                relation for relation in self.conn.relations if relation[0] not in requested
            }
        elif statement.startswith("INSERT INTO operation_log"):
            self.conn.operation_logs.append(tuple(params))
        else:
            raise AssertionError(f"未处理的 SQL：{statement}")

    def executemany(self, sql, rows):
        if self.conn.fail_on_insert:
            raise RuntimeError("模拟批量写入失败")
        if not sql.startswith("INSERT INTO product_tag"):
            raise AssertionError(f"未处理的批量 SQL：{sql}")
        self.conn.relations.update((int(product_id), int(tag_id)) for product_id, tag_id in rows)

    def fetchall(self):
        return list(self.rows)


class FakeConnection:
    def __init__(self, products, tags, relations=(), fail_on_insert=False):
        self.products = set(products)
        self.tags = {
            tag_id: {"name": f"标签{tag_id}", "sort_order": tag_id, "is_deleted": 0}
            for tag_id in tags
        }
        self.relations = set(relations)
        self._initial_relations = set(relations)
        self.fail_on_insert = fail_on_insert
        self.operation_logs = []
        self._initial_operation_logs = []
        self.commit_count = 0
        self.rollback_count = 0

    def cursor(self):
        return FakeCursor(self)

    def commit(self):
        self.commit_count += 1
        self._initial_relations = set(self.relations)
        self._initial_operation_logs = list(self.operation_logs)

    def rollback(self):
        self.rollback_count += 1
        self.relations = set(self._initial_relations)
        self.operation_logs = list(self._initial_operation_logs)


class ProductTagsBatchRouteTests(unittest.TestCase):
    def setUp(self):
        self.original_get_db = main.get_db
        self.original_require_admin_user = main.require_admin_user
        self.original_write_admin_operation_failure = main.write_admin_operation_failure
        self.failure_logs = []

        def require_admin(authorization):
            if authorization is None:
                raise HTTPException(status_code=401, detail="请先登录管理员账号")
            if authorization == "Bearer user":
                raise HTTPException(status_code=403, detail="仅管理员可执行此操作")
            return {"id": 7, "email": "admin@example.test", "is_admin": 1, "is_deleted": 0}

        def write_failure(*args, **kwargs):
            self.failure_logs.append((args, kwargs))

        main.require_admin_user = require_admin
        main.write_admin_operation_failure = write_failure

    def tearDown(self):
        main.get_db = self.original_get_db
        main.require_admin_user = self.original_require_admin_user
        main.write_admin_operation_failure = self.original_write_admin_operation_failure

    def use_connection(self, conn):
        @contextmanager
        def fake_get_db():
            yield conn

        main.get_db = fake_get_db

    @staticmethod
    def response_json(response):
        return json.loads(response.body.decode("utf-8"))

    def test_success_commits_once_and_returns_ordered_before_after_counts(self):
        conn = FakeConnection({1, 2}, {1, 2}, {(1, 1)})
        self.use_connection(conn)
        request = main.AdminProductTagsBatchUpdateRequest(
            product_ids=[2, 1], operation="ADD", tag_ids=[2]
        )

        response = main.update_admin_product_tags_batch(request, "Bearer admin")

        self.assertEqual(response["requested_product_count"], 2)
        self.assertEqual(response["changed_product_count"], 2)
        self.assertEqual(response["unchanged_product_count"], 0)
        self.assertEqual([row["product_id"] for row in response["data"]], [1, 2])
        self.assertEqual([tag["tag_id"] for tag in response["data"][0]["before_tags"]], [1])
        self.assertEqual([tag["tag_id"] for tag in response["data"][0]["after_tags"]], [1, 2])
        self.assertEqual(conn.relations, {(1, 1), (1, 2), (2, 2)})
        self.assertEqual((conn.commit_count, conn.rollback_count), (1, 0))
        self.assertEqual(len(conn.operation_logs), 1)
        self.assertEqual(conn.operation_logs[0][1:5], ("PRODUCT_TAGS_BATCH_UPDATE", "PRODUCT", None, "SUCCESS"))
        self.assertEqual(json.loads(conn.operation_logs[0][6])["changed_product_ids"], [1, 2])
        self.assertEqual(self.failure_logs, [])

    def test_invalid_product_and_tag_return_404_and_rollback_everything(self):
        for request, invalid_field in [
            (
                main.AdminProductTagsBatchUpdateRequest(
                    product_ids=[1, 999], operation="ADD", tag_ids=[2]
                ),
                "invalid_product_ids",
            ),
            (
                main.AdminProductTagsBatchUpdateRequest(
                    product_ids=[1], operation="ADD", tag_ids=[999]
                ),
                "invalid_tag_ids",
            ),
        ]:
            with self.subTest(invalid_field=invalid_field):
                conn = FakeConnection({1}, {1, 2}, {(1, 1)})
                self.use_connection(conn)
                response = main.update_admin_product_tags_batch(request, "Bearer admin")
                body = self.response_json(response)
                self.assertEqual(response.status_code, 404)
                self.assertIn(invalid_field, body)
                self.assertEqual(conn.relations, {(1, 1)})
                self.assertEqual((conn.commit_count, conn.rollback_count), (0, 1))
                self.assertEqual(conn.operation_logs, [])
                self.assertEqual(self.failure_logs[-1][0][1:4], ("PRODUCT_TAGS_BATCH_UPDATE", "PRODUCT", None))

    def test_sixth_tag_returns_409_without_partial_write(self):
        conn = FakeConnection({1, 2}, set(range(1, 7)), {(1, tag_id) for tag_id in range(1, 6)})
        self.use_connection(conn)
        request = main.AdminProductTagsBatchUpdateRequest(
            product_ids=[1, 2], operation="ADD", tag_ids=[6]
        )

        response = main.update_admin_product_tags_batch(request, "Bearer admin")
        body = self.response_json(response)

        self.assertEqual(response.status_code, 409)
        self.assertEqual(body["conflict_product_ids"], [1])
        self.assertEqual(conn.relations, {(1, tag_id) for tag_id in range(1, 6)})
        self.assertEqual((conn.commit_count, conn.rollback_count), (0, 1))
        self.assertEqual(conn.operation_logs, [])
        self.assertEqual(self.failure_logs[-1][0][1:4], ("PRODUCT_TAGS_BATCH_UPDATE", "PRODUCT", None))

    def test_write_exception_rolls_back_and_permissions_short_circuit(self):
        conn = FakeConnection({1}, {1}, fail_on_insert=True)
        self.use_connection(conn)
        request = main.AdminProductTagsBatchUpdateRequest(
            product_ids=[1], operation="ADD", tag_ids=[1]
        )
        with self.assertRaises(HTTPException) as raised:
            main.update_admin_product_tags_batch(request, "Bearer admin")
        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(conn.relations, set())
        self.assertEqual((conn.commit_count, conn.rollback_count), (0, 1))
        self.assertEqual(conn.operation_logs, [])
        self.assertEqual(self.failure_logs[-1][0][1:4], ("PRODUCT_TAGS_BATCH_UPDATE", "PRODUCT", None))

        for authorization, status_code in [(None, 401), ("Bearer user", 403)]:
            with self.subTest(status_code=status_code):
                with self.assertRaises(HTTPException) as auth_error:
                    main.update_admin_product_tags_batch(request, authorization)
                self.assertEqual(auth_error.exception.status_code, status_code)


if __name__ == "__main__":
    unittest.main()
