import importlib.util
import io
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch


ROOT_DIR = Path(__file__).resolve().parents[1]
SCRIPT_PATH = ROOT_DIR / "scripts" / "generate_final_sales_data.py"


def load_module():
    spec = importlib.util.spec_from_file_location("generate_final_sales_data", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class GenerateFinalSalesDataUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_module()

    def setUp(self):
        self.products = [
            {"id": 10, "name": self.module.TOP_PRODUCT_NAME},
            {"id": 15, "name": self.module.BOTTOM_PRODUCT_NAME},
            *[
                {"id": product_id, "name": f"测试商品 {product_id:02d}"}
                for product_id in range(20, 31)
            ],
        ]

    def test_product_targets_are_deterministic_and_meet_ranking_constraints(self):
        baseline = {product["id"]: 0 for product in self.products}

        first = self.module.generate_product_targets(self.products, baseline)
        second = self.module.generate_product_targets(list(reversed(self.products)), baseline)

        self.assertEqual(first, second)
        self.assertEqual(sum(first.values()), self.module.TARGET_TOTAL_SALES)
        self.assertGreaterEqual(sum(first.values()), 980)
        self.assertLessEqual(sum(first.values()), 1020)
        top_id = next(p["id"] for p in self.products if p["name"] == self.module.TOP_PRODUCT_NAME)
        bottom_id = next(p["id"] for p in self.products if p["name"] == self.module.BOTTOM_PRODUCT_NAME)
        ranked = sorted(first.items(), key=lambda item: (-item[1], item[0]))
        self.assertEqual(ranked[0][0], top_id)
        self.assertEqual(ranked[-1][0], bottom_id)
        self.assertGreaterEqual(ranked[0][1] - ranked[1][1], 30)
        self.assertGreater(ranked[-2][1], ranked[-1][1])
        self.assertGreaterEqual(len(set(first.values())), 8)

    def test_product_targets_never_hide_existing_non_seed_sales(self):
        baseline = {product["id"]: 0 for product in self.products}
        baseline[20] = 131

        with self.assertRaisesRegex(ValueError, "现有非 seed 有效销量"):
            self.module.generate_product_targets(self.products, baseline)

    def test_sku_allocation_is_deterministic_uneven_and_exact(self):
        skus = [
            {"id": 101, "product_id": 10, "sku_name": "黑色 / S"},
            {"id": 102, "product_id": 10, "sku_name": "黑色 / M"},
            {"id": 103, "product_id": 10, "sku_name": "黑色 / L"},
            {"id": 104, "product_id": 10, "sku_name": "黑色 / XL"},
        ]

        first = self.module.allocate_sales_to_skus(10, skus, 250)
        second = self.module.allocate_sales_to_skus(10, list(reversed(skus)), 250)

        self.assertEqual(first, second)
        self.assertEqual(sum(first.values()), 250)
        self.assertGreater(len(set(first.values())), 1)
        self.assertGreater(first[102], first[101])

    def test_seed_markers_match_only_owned_rows(self):
        self.assertTrue(self.module.is_seed_email("seed_sales_0001@example.test"))
        self.assertTrue(self.module.is_seed_order_no("SEED20260716-000001"))
        self.assertFalse(self.module.is_seed_email("student@example.test"))
        self.assertFalse(self.module.is_seed_email("seed_sales_0001@example.com"))
        self.assertFalse(self.module.is_seed_order_no("ORD20260716000001"))
        self.assertFalse(self.module.is_seed_order_no("XSEED20260716-000001"))

    def test_protected_snapshot_uses_actual_sku_dimension_columns(self):
        class SchemaAwareCursor:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

            def execute(self, sql):
                normalized = " ".join(sql.split())
                if "FROM product_sku ORDER BY id" in normalized:
                    if " color," in normalized or " size " in normalized:
                        raise RuntimeError("Unknown product_sku dimension column")
                    self.rows = [{"sku_code": "SKU-1", "color_name": "黑色", "size_name": "M"}]
                else:
                    self.rows = []

            def fetchall(self):
                return self.rows

        class SchemaAwareConnection:
            def cursor(self):
                return SchemaAwareCursor()

        snapshot = self.module.fetch_protected_snapshot(SchemaAwareConnection())

        self.assertEqual(snapshot["skus"][0]["color_name"], "黑色")

    def test_refunded_order_history_uses_the_real_two_step_refund_flow(self):
        created_at = datetime(2026, 7, 1, 10, 0, 0)
        paid_at = created_at + timedelta(minutes=10)
        refunded_at = paid_at + timedelta(days=1)
        plan = self.module.OrderPlan(
            sequence=1,
            user_index=1,
            status="REFUNDED",
            created_at=created_at,
            updated_at=refunded_at,
            paid_at=paid_at,
            shipped_at=None,
            refunded_at=refunded_at,
            lines=(self.module.OrderLinePlan(101, 1, Decimal("99.00")),),
        )

        rows = self.module._status_log_rows(7, plan)

        self.assertEqual(
            [(row[1], row[2]) for row in rows],
            [
                (None, "PENDING_PAYMENT"),
                ("PENDING_PAYMENT", "PAID"),
                ("PAID", "REFUND_REQUESTED"),
                ("REFUND_REQUESTED", "REFUNDED"),
            ],
        )
        self.assertEqual([row[4] for row in rows], sorted(row[4] for row in rows))

        inventory_rows = self.module._inventory_log_rows(plan)
        self.assertEqual(
            [row[1] for row in inventory_rows],
            ["LOCK_STOCK", "CONFIRM_SALE", "REFUND_RESTORE"],
        )

    def test_verification_report_is_safe_on_the_windows_gbk_console(self):
        result = {
            "ranking": [
                {"name": self.module.TOP_PRODUCT_NAME, "sold_count": 250, "sales_amount": Decimal("174750.00")},
                {"name": self.module.BOTTOM_PRODUCT_NAME, "sold_count": 10, "sales_amount": Decimal("299990.00")},
            ],
            "sku_sum_by_product": {10: 250, 15: 10},
        }
        raw = io.BytesIO()
        output = io.TextIOWrapper(raw, encoding="gbk")

        with redirect_stdout(output):
            self.module.print_verification(result)
        output.flush()

        self.assertIn("CNY", raw.getvalue().decode("gbk"))

    def test_cleanup_only_is_guarded_by_execute(self):
        with patch.object(sys, "argv", ["generate_final_sales_data.py", "--cleanup-only"]):
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit):
                    self.module.parse_args()

        with patch.object(
            sys,
            "argv",
            ["generate_final_sales_data.py", "--cleanup-only", "--execute"],
        ):
            args = self.module.parse_args()

        self.assertTrue(args.cleanup_only)
        self.assertTrue(args.execute)


if __name__ == "__main__":
    unittest.main()
