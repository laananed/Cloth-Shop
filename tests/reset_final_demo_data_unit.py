import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path
from unittest.mock import Mock, patch


ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "backend"))

import scripts.reset_final_demo_data as reset_module  # noqa: E402
from scripts.reset_final_demo_data import (  # noqa: E402
    DELETE_ORDER,
    cleanup_pending_product_images,
    delete_business_data,
    image_url_to_runtime_path,
    load_pending_image_urls,
    persist_pending_image_urls,
    remove_product_image_files,
)


class ResetFinalDemoDataTests(unittest.TestCase):
    def test_delete_order_respects_real_foreign_key_dependencies(self):
        self.assertLess(DELETE_ORDER.index("cart_item"), DELETE_ORDER.index("cart"))
        self.assertLess(DELETE_ORDER.index("order_item"), DELETE_ORDER.index("order_main"))
        self.assertLess(DELETE_ORDER.index("payment_record"), DELETE_ORDER.index("order_main"))
        self.assertLess(DELETE_ORDER.index("inventory"), DELETE_ORDER.index("product_sku"))
        self.assertLess(DELETE_ORDER.index("product_sku"), DELETE_ORDER.index("product"))

    def test_image_url_mapping_accepts_only_direct_product_uploads(self):
        upload_dir = ROOT_DIR / "backend" / "uploads" / "products"

        self.assertEqual(
            image_url_to_runtime_path("/uploads/products/demo.png", upload_dir),
            upload_dir / "demo.png",
        )
        self.assertIsNone(image_url_to_runtime_path("/assets/products/demo.png", upload_dir))
        self.assertIsNone(image_url_to_runtime_path("/uploads/products/../secret.png", upload_dir))
        self.assertIsNone(image_url_to_runtime_path("/uploads/products/.gitkeep", upload_dir))

    def test_image_cleanup_removes_only_referenced_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            upload_dir = Path(temp_dir)
            referenced = upload_dir / "referenced.png"
            unrelated = upload_dir / "unrelated.png"
            keep = upload_dir / ".gitkeep"
            referenced.write_bytes(b"old")
            unrelated.write_bytes(b"keep")
            keep.write_bytes(b"")

            result = remove_product_image_files(
                ["/uploads/products/referenced.png", "/uploads/products/missing.png"],
                upload_dir,
            )

            self.assertFalse(referenced.exists())
            self.assertTrue(unrelated.exists())
            self.assertTrue(keep.exists())
            self.assertEqual(result.deleted, [referenced])
            self.assertEqual(result.missing, [upload_dir / "missing.png"])
            self.assertEqual(result.failed, [])

    def test_failed_image_cleanup_manifest_is_retried_on_next_run(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            upload_dir = root / "uploads"
            upload_dir.mkdir()
            image_path = upload_dir / "retry.png"
            manifest_path = root / "pending.json"
            image_path.write_bytes(b"old")
            urls = ["/uploads/products/retry.png"]
            pending = persist_pending_image_urls(urls, manifest_path)
            original_unlink = Path.unlink

            def fail_image_once(path, *args, **kwargs):
                if path == image_path:
                    raise PermissionError("locked")
                return original_unlink(path, *args, **kwargs)

            with patch.object(Path, "unlink", fail_image_once):
                first = cleanup_pending_product_images(pending, upload_dir, manifest_path)

            self.assertTrue(image_path.exists())
            self.assertTrue(manifest_path.exists())
            self.assertEqual(load_pending_image_urls(manifest_path), urls)
            self.assertEqual(len(first.failed), 1)

            second = cleanup_pending_product_images(
                load_pending_image_urls(manifest_path), upload_dir, manifest_path
            )
            self.assertFalse(image_path.exists())
            self.assertFalse(manifest_path.exists())
            self.assertEqual(second.failed, [])

    def test_database_delete_failure_rolls_back_without_commit(self):
        class Cursor:
            rowcount = 1

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql):
                if "`inventory_log`" in sql:
                    raise RuntimeError("injected delete failure")

        class Connection:
            began = 0
            committed = 0
            rolled_back = 0

            def begin(self):
                self.began += 1

            def cursor(self):
                return Cursor()

            def commit(self):
                self.committed += 1

            def rollback(self):
                self.rolled_back += 1

        conn = Connection()
        with self.assertRaisesRegex(RuntimeError, "injected delete failure"):
            delete_business_data(conn)

        self.assertEqual(conn.began, 1)
        self.assertEqual(conn.committed, 0)
        self.assertEqual(conn.rolled_back, 1)

    def test_backup_failure_prevents_database_deletion(self):
        conn = Mock()
        counts = {table: 0 for table in reset_module.REPORT_TABLES + reset_module.PRESERVED_TABLES}
        with (
            patch.object(reset_module, "parse_args", return_value=Namespace(execute=True)),
            patch.object(reset_module, "get_connection", return_value=conn),
            patch.object(reset_module, "fetch_counts", return_value=counts),
            patch.object(reset_module, "fetch_operation_log_cleanup_count", return_value=0),
            patch.object(reset_module, "fetch_product_image_urls", return_value=[]),
            patch.object(reset_module, "load_pending_image_urls", return_value=[]),
            patch.object(
                reset_module,
                "create_database_backup",
                side_effect=RuntimeError("injected backup failure"),
            ),
            patch.object(reset_module, "delete_business_data") as delete_mock,
        ):
            self.assertEqual(reset_module.main(), 1)

        delete_mock.assert_not_called()
        conn.close.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
