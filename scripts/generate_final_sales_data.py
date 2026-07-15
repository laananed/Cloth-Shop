#!/usr/bin/env python3
"""为当前正式商品生成可重放的千级销售演示数据；默认只预览。"""

from __future__ import annotations

import argparse
import hashlib
import math
import random
import re
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Sequence


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import get_connection  # noqa: E402


RANDOM_SEED = 20260716
TARGET_TOTAL_SALES = 1000
EXPECTED_PRODUCT_COUNT = 13
SYNTHETIC_USER_COUNT = 80
BATCH_SIZE = 100
TOP_PRODUCT_NAME = "暗夜流光一字肩开衩长款礼服裙"
BOTTOM_PRODUCT_NAME = "烈焰红全包围运动型摩托车"
SEED_EMAIL_RE = re.compile(r"^seed_sales_\d{4}@example\.test$")
SEED_ORDER_PREFIX = "SEED20260716-"
SEED_ORDER_RE = re.compile(r"^SEED20260716-\d{6}$")
EFFECTIVE_STATUSES = ("PAID", "SHIPPED", "COMPLETED", "REFUND_REQUESTED")
PAID_STATUSES = EFFECTIVE_STATUSES + ("REFUNDED",)


@dataclass(frozen=True)
class OrderLinePlan:
    sku_id: int
    quantity: int
    price: Decimal


@dataclass(frozen=True)
class OrderPlan:
    sequence: int
    user_index: int
    status: str
    created_at: datetime
    updated_at: datetime
    paid_at: datetime | None
    shipped_at: datetime | None
    refunded_at: datetime | None
    lines: tuple[OrderLinePlan, ...]

    @property
    def order_no(self) -> str:
        return f"{SEED_ORDER_PREFIX}{self.sequence:06d}"

    @property
    def total_amount(self) -> Decimal:
        return sum(
            (line.price * line.quantity for line in self.lines),
            start=Decimal("0.00"),
        ).quantize(Decimal("0.01"))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="为当前 13 件正式商品生成约 1000 件有效销量的演示订单"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="实际执行事务写入；未提供时只读取数据库并打印生成计划",
    )
    parser.add_argument(
        "--cleanup-only",
        action="store_true",
        help="只清理本脚本的 seed 数据并重建销量；必须与 --execute 同时使用",
    )
    args = parser.parse_args()
    if args.cleanup_only and not args.execute:
        parser.error("--cleanup-only 必须与 --execute 同时使用")
    return args


def is_seed_email(value: str) -> bool:
    return bool(SEED_EMAIL_RE.fullmatch(str(value or "")))


def is_seed_order_no(value: str) -> bool:
    return bool(SEED_ORDER_RE.fullmatch(str(value or "")))


def chunked(values: Sequence, size: int = BATCH_SIZE) -> Iterable[Sequence]:
    for offset in range(0, len(values), size):
        yield values[offset : offset + size]


def execute_many_chunked(cursor, sql: str, rows: Sequence[tuple]) -> None:
    for batch in chunked(rows):
        cursor.executemany(sql, batch)


def _bounded_apportion(
    ids: list[int],
    weights: dict[int, float],
    total: int,
    minimum: int,
    maximum: int,
) -> dict[int, int]:
    if not ids:
        if total:
            raise ValueError("没有可分配对象")
        return {}
    if total < minimum * len(ids) or total > maximum * len(ids):
        raise ValueError("目标总量无法在指定边界内分配")

    result = {item_id: minimum for item_id in ids}
    remaining = total - minimum * len(ids)
    active = set(ids)
    while remaining and active:
        weight_sum = sum(weights[item_id] for item_id in active)
        raw = {
            item_id: remaining * weights[item_id] / weight_sum
            for item_id in active
        }
        assigned = 0
        fractions: list[tuple[float, int]] = []
        for item_id in sorted(active):
            capacity = maximum - result[item_id]
            addition = min(capacity, int(math.floor(raw[item_id])))
            result[item_id] += addition
            assigned += addition
            fractions.append((raw[item_id] - math.floor(raw[item_id]), item_id))
        remaining -= assigned
        if not remaining:
            break
        progressed = False
        for _, item_id in sorted(fractions, key=lambda item: (-item[0], item[1])):
            if remaining == 0:
                break
            if result[item_id] < maximum:
                result[item_id] += 1
                remaining -= 1
                progressed = True
        active = {item_id for item_id in active if result[item_id] < maximum}
        if not progressed and remaining:
            raise ValueError("目标销量校正失败")
    return result


def generate_product_targets(
    products: Sequence[dict],
    baseline_by_product: dict[int, int],
    seed: int = RANDOM_SEED,
) -> dict[int, int]:
    active = sorted(
        ({"id": int(item["id"]), "name": str(item["name"])} for item in products),
        key=lambda item: (item["name"], item["id"]),
    )
    if len(active) != EXPECTED_PRODUCT_COUNT:
        raise ValueError(
            f"有效商品数量必须为 {EXPECTED_PRODUCT_COUNT}，当前为 {len(active)}"
        )
    top_matches = [item for item in active if item["name"] == TOP_PRODUCT_NAME]
    bottom_matches = [item for item in active if item["name"] == BOTTOM_PRODUCT_NAME]
    if len(top_matches) != 1 or len(bottom_matches) != 1:
        raise ValueError("指定最高或最低销量商品不存在，或存在多个同名有效商品")

    top_id = top_matches[0]["id"]
    bottom_id = bottom_matches[0]["id"]
    middle_ids = [item["id"] for item in active if item["id"] not in {top_id, bottom_id}]
    rng = random.Random(seed)
    weights = {item_id: rng.uniform(0.45, 1.65) for item_id in middle_ids}
    targets = _bounded_apportion(
        middle_ids,
        weights,
        TARGET_TOTAL_SALES - 250 - 10,
        minimum=30,
        maximum=130,
    )
    targets[top_id] = 250
    targets[bottom_id] = 10

    for product_id, baseline in baseline_by_product.items():
        if product_id in targets and int(baseline) > targets[product_id]:
            raise ValueError(
                "现有非 seed 有效销量已超过目标分布，不能在不删除真实订单的前提下生成："
                f"product_id={product_id}, baseline={baseline}, target={targets[product_id]}"
            )
    ranked = sorted(targets.items(), key=lambda item: (-item[1], item[0]))
    if sum(targets.values()) != TARGET_TOTAL_SALES:
        raise ValueError("商品目标销量总和校正失败")
    if ranked[0][0] != top_id or ranked[-1][0] != bottom_id:
        raise ValueError("指定首尾商品约束校正失败")
    if ranked[0][1] - ranked[1][1] < 30:
        raise ValueError("第一名与第二名销量差不足 30")
    return dict(sorted(targets.items()))


def allocate_sales_to_skus(
    product_id: int,
    skus: Sequence[dict],
    total: int,
    seed: int = RANDOM_SEED,
) -> dict[int, int]:
    ordered = sorted(skus, key=lambda item: int(item["id"]))
    if not ordered:
        raise ValueError(f"商品 {product_id} 没有有效在售 SKU")
    if total < 0:
        raise ValueError("SKU 待分配销量不能为负数")
    if len(ordered) == 1:
        return {int(ordered[0]["id"]): total}

    rng = random.Random(f"{seed}:{product_id}:sku")
    weights: dict[int, float] = {}
    for sku in ordered:
        sku_id = int(sku["id"])
        name = str(sku.get("sku_name") or "").upper()
        common_size_boost = 1.28 if re.search(r"(?:^|[/\s])(?:M|L)(?:$|[/\s])", name) else 1.0
        weights[sku_id] = rng.uniform(0.72, 1.35) * common_size_boost

    ids = [int(item["id"]) for item in ordered]
    weight_sum = sum(weights.values())
    raw = {sku_id: total * weights[sku_id] / weight_sum for sku_id in ids}
    result = {sku_id: int(math.floor(raw[sku_id])) for sku_id in ids}
    remainder = total - sum(result.values())
    for sku_id in sorted(ids, key=lambda value: (-(raw[value] - result[value]), value))[:remainder]:
        result[sku_id] += 1
    if total >= len(ids) and len(set(result.values())) == 1:
        high = max(ids, key=lambda value: (weights[value], -value))
        low = min(ids, key=lambda value: (weights[value], value))
        if result[low] > 0:
            result[high] += 1
            result[low] -= 1
    return dict(sorted(result.items()))


def fetch_catalog(conn) -> tuple[list[dict], list[dict]]:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT id, name, category_id, image_url, status, is_deleted, created_at, updated_at
            FROM product
            WHERE is_deleted = 0
            ORDER BY id
            """
        )
        products = list(cursor.fetchall())
        cursor.execute(
            """
            SELECT
                s.id, s.product_id, s.sku_name, s.price, s.status, s.is_deleted,
                i.available_stock, i.locked_stock
            FROM product_sku s
            JOIN product p ON p.id = s.product_id
            JOIN inventory i ON i.sku_id = s.id
            WHERE p.is_deleted = 0
              AND p.status = 'ON_SALE'
              AND s.is_deleted = 0
              AND s.status = 'ON_SALE'
            ORDER BY s.product_id, s.id
            """
        )
        skus = list(cursor.fetchall())
    generate_product_targets(products, {int(item["id"]): 0 for item in products})
    skus_by_product = Counter(int(item["product_id"]) for item in skus)
    missing = [int(item["id"]) for item in products if not skus_by_product[int(item["id"])]]
    if missing:
        raise ValueError(f"存在没有有效在售 SKU 的商品：{missing}")
    return products, skus


def fetch_non_seed_baseline(conn) -> tuple[dict[int, int], dict[int, int]]:
    placeholders = ", ".join(["%s"] * len(EFFECTIVE_STATUSES))
    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT s.product_id, oi.sku_id, SUM(oi.quantity) AS sold_count
            FROM order_main o
            JOIN order_item oi ON oi.order_id = o.id
            JOIN product_sku s ON s.id = oi.sku_id
            WHERE o.status IN ({placeholders})
              AND o.order_no NOT LIKE %s
            GROUP BY s.product_id, oi.sku_id
            """,
            (*EFFECTIVE_STATUSES, f"{SEED_ORDER_PREFIX}%"),
        )
        rows = cursor.fetchall()
    by_product: dict[int, int] = defaultdict(int)
    by_sku: dict[int, int] = defaultdict(int)
    for row in rows:
        product_id = int(row["product_id"])
        sku_id = int(row["sku_id"])
        sold_count = int(row["sold_count"] or 0)
        by_product[product_id] += sold_count
        by_sku[sku_id] += sold_count
    return dict(by_product), dict(by_sku)


def build_sales_plan(conn) -> tuple[list[dict], list[dict], dict[int, int], dict[int, int]]:
    products, skus = fetch_catalog(conn)
    baseline_by_product, baseline_by_sku = fetch_non_seed_baseline(conn)
    targets = generate_product_targets(products, baseline_by_product)
    skus_by_product: dict[int, list[dict]] = defaultdict(list)
    for sku in skus:
        skus_by_product[int(sku["product_id"])].append(sku)

    additions: dict[int, int] = {}
    for product in products:
        product_id = int(product["id"])
        delta = targets[product_id] - baseline_by_product.get(product_id, 0)
        allocated = allocate_sales_to_skus(product_id, skus_by_product[product_id], delta)
        additions.update(allocated)

    for sku_id, baseline in baseline_by_sku.items():
        if sku_id not in {int(item["id"]) for item in skus} and baseline:
            raise ValueError(f"非 seed 有效订单引用了当前无效 SKU：{sku_id}")
    return products, skus, targets, additions


def _split_quantity(quantity: int, rng: random.Random) -> list[int]:
    chunks: list[int] = []
    remaining = quantity
    while remaining:
        value = min(remaining, rng.randint(1, 4))
        chunks.append(value)
        remaining -= value
    return chunks


def _random_created_at(now: datetime, rng: random.Random) -> datetime:
    month_bucket = rng.choices(range(6), weights=(18, 17, 15, 19, 14, 12), k=1)[0]
    days_ago = month_bucket * 30 + rng.randint(0, 29)
    created = (now - timedelta(days=days_ago)).replace(
        hour=rng.randint(8, 22),
        minute=rng.randint(0, 59),
        second=rng.randint(0, 59),
        microsecond=0,
    )
    if created > now:
        created = now - timedelta(minutes=rng.randint(5, 120))
    if created.weekday() < 5 and rng.random() < 0.16:
        candidate = created + timedelta(days=5 - created.weekday())
        if candidate <= now:
            created = candidate
    return created


def _make_order_plan(
    sequence: int,
    status: str,
    lines: list[OrderLinePlan],
    now: datetime,
    rng: random.Random,
) -> OrderPlan:
    created_at = _random_created_at(now, rng)
    paid_at = None
    shipped_at = None
    refunded_at = None
    updated_at = created_at + timedelta(minutes=rng.randint(2, 90))
    if status in PAID_STATUSES:
        paid_at = created_at + timedelta(minutes=rng.randint(3, 180))
        updated_at = paid_at
    if status == "SHIPPED":
        shipped_at = paid_at + timedelta(hours=rng.randint(6, 72))
        updated_at = shipped_at
    if status == "REFUNDED":
        refunded_at = paid_at + timedelta(hours=rng.randint(12, 120))
        updated_at = refunded_at
    if updated_at > now:
        shift = updated_at - now + timedelta(minutes=1)
        created_at -= shift
        paid_at = paid_at - shift if paid_at else None
        shipped_at = shipped_at - shift if shipped_at else None
        refunded_at = refunded_at - shift if refunded_at else None
        updated_at -= shift
    return OrderPlan(
        sequence=sequence,
        user_index=((sequence - 1) % SYNTHETIC_USER_COUNT) + 1,
        status=status,
        created_at=created_at,
        updated_at=updated_at,
        paid_at=paid_at,
        shipped_at=shipped_at,
        refunded_at=refunded_at,
        lines=tuple(lines),
    )


def build_order_plans(
    additions_by_sku: dict[int, int],
    skus: Sequence[dict],
    now: datetime,
    seed: int = RANDOM_SEED,
) -> list[OrderPlan]:
    rng = random.Random(f"{seed}:orders")
    sku_by_id = {int(item["id"]): item for item in skus}
    chunks: list[OrderLinePlan] = []
    for sku_id in sorted(additions_by_sku):
        for quantity in _split_quantity(additions_by_sku[sku_id], rng):
            chunks.append(
                OrderLinePlan(
                    sku_id=sku_id,
                    quantity=quantity,
                    price=Decimal(str(sku_by_id[sku_id]["price"])).quantize(Decimal("0.01")),
                )
            )
    rng.shuffle(chunks)

    effective_lines: list[list[OrderLinePlan]] = []
    remaining = list(chunks)
    while remaining:
        lines = [remaining.pop()]
        desired = 2 if rng.random() < 0.64 else 1
        if desired == 2 and remaining:
            distinct_index = next(
                (index for index in range(len(remaining) - 1, -1, -1) if remaining[index].sku_id != lines[0].sku_id),
                None,
            )
            if distinct_index is not None:
                lines.append(remaining.pop(distinct_index))
        effective_lines.append(lines)

    if not 215 <= len(effective_lines) <= 300:
        raise ValueError(f"有效订单数量不在合理范围：{len(effective_lines)}")
    status_indices = list(range(len(effective_lines)))
    rng.shuffle(status_indices)
    shipped_count = round(len(effective_lines) * 0.80)
    effective_statuses = ["PAID"] * len(effective_lines)
    for index in status_indices[:shipped_count]:
        effective_statuses[index] = "SHIPPED"

    plans: list[OrderPlan] = []
    for lines, status in zip(effective_lines, effective_statuses):
        plans.append(_make_order_plan(len(plans) + 1, status, lines, now, rng))

    desired_total = min(330, max(280, len(plans) + 30))
    extra_count = desired_total - len(plans)
    non_effective_statuses = (
        ["PENDING_PAYMENT"] * round(extra_count * 0.40)
        + ["CANCELLED"] * round(extra_count * 0.35)
    )
    non_effective_statuses += ["REFUNDED"] * (extra_count - len(non_effective_statuses))
    rng.shuffle(non_effective_statuses)
    valid_sku_ids = sorted(sku_by_id)
    for status in non_effective_statuses:
        sku_id = rng.choice(valid_sku_ids)
        line = OrderLinePlan(
            sku_id=sku_id,
            quantity=rng.randint(1, 3),
            price=Decimal(str(sku_by_id[sku_id]["price"])).quantize(Decimal("0.01")),
        )
        plans.append(_make_order_plan(len(plans) + 1, status, [line], now, rng))

    item_count = sum(len(plan.lines) for plan in plans)
    if not 250 <= len(plans) <= 350 or not 400 <= item_count <= 650:
        raise ValueError(f"订单规模不符合要求：orders={len(plans)}, items={item_count}")
    return plans


def fetch_protected_snapshot(conn) -> dict:
    snapshot: dict = {}
    queries = {
        "products": "SELECT id, category_id, name, image_url, status, is_deleted, created_at, updated_at FROM product ORDER BY id",
        "skus": "SELECT id, product_id, sku_name, price, status, is_deleted, created_at, sku_code, color_name, size_name FROM product_sku ORDER BY id",
        "images": "SELECT * FROM product_image ORDER BY id",
        "categories": "SELECT * FROM category ORDER BY id",
        "tags": "SELECT * FROM tag ORDER BY id",
        "product_tags": "SELECT * FROM product_tag ORDER BY product_id, tag_id",
        "non_seed_users": "SELECT id, email, is_admin, is_deleted FROM user ORDER BY id",
        "non_seed_orders": f"SELECT id, order_no FROM order_main WHERE order_no NOT LIKE '{SEED_ORDER_PREFIX}%' ORDER BY id",
    }
    with conn.cursor() as cursor:
        for key, query in queries.items():
            cursor.execute(query)
            rows = list(cursor.fetchall())
            if key == "non_seed_users":
                rows = [row for row in rows if not is_seed_email(row["email"])]
            snapshot[key] = rows
        cursor.execute(
            "SELECT sku_id, available_stock, locked_stock FROM inventory ORDER BY sku_id"
        )
        snapshot["inventory"] = list(cursor.fetchall())
    return snapshot


def print_preflight_snapshot(snapshot: dict) -> None:
    print("执行前快照：")
    for key in (
        "products",
        "skus",
        "images",
        "categories",
        "tags",
        "product_tags",
        "non_seed_users",
        "non_seed_orders",
    ):
        print(f"  {key}: {len(snapshot[key])}")
    print("  SKU 库存：")
    for row in snapshot["inventory"]:
        print(
            f"    sku_id={row['sku_id']}: available={row['available_stock']}, "
            f"locked={row['locked_stock']}"
        )


def _fetch_owned_seed_rows(conn) -> tuple[list[dict], list[dict]]:
    with conn.cursor() as cursor:
        cursor.execute(
            "SELECT id, email FROM user WHERE email LIKE %s ORDER BY id",
            ("seed_sales_%@example.test",),
        )
        users = [row for row in cursor.fetchall() if is_seed_email(row["email"])]
        cursor.execute(
            "SELECT id, order_no, user_id, status FROM order_main WHERE order_no LIKE %s ORDER BY id",
            (f"{SEED_ORDER_PREFIX}%",),
        )
        orders = [row for row in cursor.fetchall() if is_seed_order_no(row["order_no"])]
    return users, orders


def _delete_by_ids(cursor, table: str, column: str, ids: list[int]) -> None:
    for batch in chunked(ids):
        placeholders = ",".join(["%s"] * len(batch))
        cursor.execute(
            f"DELETE FROM `{table}` WHERE `{column}` IN ({placeholders})",
            tuple(batch),
        )


def cleanup_existing_seed_data(conn) -> dict[str, int]:
    users, orders = _fetch_owned_seed_rows(conn)
    user_ids = [int(row["id"]) for row in users]
    order_ids = [int(row["id"]) for row in orders]
    user_id_set = set(user_ids)
    order_id_set = set(order_ids)
    deleted = {"users": len(user_ids), "orders": len(order_ids)}

    with conn.cursor() as cursor:
        if user_ids:
            for batch in chunked(user_ids):
                placeholders = ",".join(["%s"] * len(batch))
                cursor.execute(
                    f"SELECT id, order_no FROM order_main WHERE user_id IN ({placeholders})",
                    tuple(batch),
                )
                unexpected = [row for row in cursor.fetchall() if not is_seed_order_no(row["order_no"])]
                if unexpected:
                    raise ValueError("seed 用户名下存在非本脚本订单，拒绝删除")
        if order_ids:
            unexpected_users = [row for row in orders if int(row["user_id"]) not in user_id_set]
            if unexpected_users:
                raise ValueError("seed 订单关联了非 seed 用户，拒绝删除")
            for batch in chunked(order_ids):
                placeholders = ",".join(["%s"] * len(batch))
                cursor.execute(
                    f"""
                    SELECT oi.sku_id, SUM(oi.quantity) AS quantity
                    FROM order_main o
                    JOIN order_item oi ON oi.order_id = o.id
                    WHERE o.id IN ({placeholders}) AND o.status = 'PENDING_PAYMENT'
                    GROUP BY oi.sku_id
                    """,
                    tuple(batch),
                )
                for row in cursor.fetchall():
                    cursor.execute(
                        """
                        UPDATE inventory
                        SET available_stock = available_stock + %s,
                            locked_stock = locked_stock - %s
                        WHERE sku_id = %s AND locked_stock >= %s
                        """,
                        (row["quantity"], row["quantity"], row["sku_id"], row["quantity"]),
                    )
                    if cursor.rowcount != 1:
                        raise ValueError(f"无法释放旧 seed 待支付订单锁定库存：sku_id={row['sku_id']}")
            _delete_by_ids(cursor, "payment_record", "order_id", order_ids)
            _delete_by_ids(cursor, "order_status_log", "order_id", order_ids)
            _delete_by_ids(cursor, "order_item", "order_id", order_ids)
            _delete_by_ids(cursor, "order_main", "id", order_ids)
        cursor.execute(
            "DELETE FROM inventory_log WHERE ref_no LIKE %s",
            (f"{SEED_ORDER_PREFIX}%",),
        )
        if user_ids:
            cart_ids: list[int] = []
            for batch in chunked(user_ids):
                placeholders = ",".join(["%s"] * len(batch))
                cursor.execute(
                    f"SELECT id FROM cart WHERE user_id IN ({placeholders})",
                    tuple(batch),
                )
                cart_ids.extend(int(row["id"]) for row in cursor.fetchall())
            if cart_ids:
                _delete_by_ids(cursor, "cart_item", "cart_id", cart_ids)
                _delete_by_ids(cursor, "cart", "id", cart_ids)
            _delete_by_ids(cursor, "user_address", "user_id", user_ids)
            _delete_by_ids(cursor, "user", "id", user_ids)
    return deleted


def insert_seed_users_and_addresses(conn) -> tuple[dict[int, int], dict[int, int]]:
    user_rows = []
    for index in range(1, SYNTHETIC_USER_COUNT + 1):
        email = f"seed_sales_{index:04d}@example.test"
        password_hash = hashlib.sha256(f"seed-only:{RANDOM_SEED}:{index}".encode()).hexdigest()
        user_rows.append((email, password_hash, None, 0, 0))
    with conn.cursor() as cursor:
        execute_many_chunked(
            cursor,
            """
            INSERT INTO user(email, password_hash, pay_password_hash, is_admin, is_deleted)
            VALUES(%s, %s, %s, %s, %s)
            """,
            user_rows,
        )
        cursor.execute(
            "SELECT id, email FROM user WHERE email LIKE %s ORDER BY email",
            ("seed_sales_%@example.test",),
        )
        rows = [row for row in cursor.fetchall() if is_seed_email(row["email"])]
        user_ids = {
            int(str(row["email"])[11:15]): int(row["id"])
            for row in rows
        }
        if len(user_ids) != SYNTHETIC_USER_COUNT:
            raise ValueError("合成用户写入数量不正确")
        address_rows = [
            (
                user_ids[index],
                f"演示用户{index:02d}",
                f"1880000{index:04d}",
                f"上海市演示区流光路 {index} 号（SEED20260716）",
                1,
                0,
            )
            for index in range(1, SYNTHETIC_USER_COUNT + 1)
        ]
        execute_many_chunked(
            cursor,
            """
            INSERT INTO user_address(user_id, recipient_name, phone, detail, is_default, is_deleted)
            VALUES(%s, %s, %s, %s, %s, %s)
            """,
            address_rows,
        )
        cursor.execute(
            """
            SELECT a.id, a.user_id
            FROM user_address a
            JOIN user u ON u.id = a.user_id
            WHERE u.email LIKE %s AND a.detail LIKE %s
            ORDER BY a.user_id
            """,
            ("seed_sales_%@example.test", "%（SEED20260716）"),
        )
        address_by_user_id = {int(row["user_id"]): int(row["id"]) for row in cursor.fetchall()}
    address_ids = {index: address_by_user_id[user_ids[index]] for index in user_ids}
    return user_ids, address_ids


def _status_log_rows(order_id: int, plan: OrderPlan) -> list[tuple]:
    rows = [(order_id, None, "PENDING_PAYMENT", "演示数据：创建订单", plan.created_at)]
    if plan.status in PAID_STATUSES:
        rows.append((order_id, "PENDING_PAYMENT", "PAID", "演示数据：支付成功", plan.paid_at))
    if plan.status == "SHIPPED":
        rows.append((order_id, "PAID", "SHIPPED", "演示数据：后台发货", plan.shipped_at))
    elif plan.status == "CANCELLED":
        rows.append((order_id, "PENDING_PAYMENT", "CANCELLED", "演示数据：取消订单", plan.updated_at))
    elif plan.status == "REFUNDED":
        requested_at = plan.paid_at + (plan.refunded_at - plan.paid_at) / 2
        rows.append((order_id, "PAID", "REFUND_REQUESTED", "演示数据：提交退款申请", requested_at))
        rows.append((order_id, "REFUND_REQUESTED", "REFUNDED", "演示数据：退款完成", plan.refunded_at))
    return rows


def _inventory_log_rows(plan: OrderPlan) -> list[tuple]:
    rows: list[tuple] = []
    for line in plan.lines:
        rows.append((line.sku_id, "LOCK_STOCK", -line.quantity, plan.order_no, plan.created_at))
        if plan.status == "CANCELLED":
            rows.append((line.sku_id, "RELEASE_STOCK", line.quantity, plan.order_no, plan.updated_at))
        elif plan.status in PAID_STATUSES:
            rows.append((line.sku_id, "CONFIRM_SALE", -line.quantity, plan.order_no, plan.paid_at))
            if plan.status == "REFUNDED":
                rows.append((line.sku_id, "REFUND_RESTORE", line.quantity, plan.order_no, plan.refunded_at))
    return rows


def insert_orders(conn, plans: Sequence[OrderPlan], user_ids: dict[int, int], address_ids: dict[int, int]) -> None:
    order_rows = [
        (
            plan.order_no,
            user_ids[plan.user_index],
            address_ids[plan.user_index],
            "PENDING_PAYMENT",
            plan.total_amount,
            "SEED20260716 千级销售演示数据",
            plan.created_at,
            plan.created_at,
        )
        for plan in plans
    ]
    with conn.cursor() as cursor:
        execute_many_chunked(
            cursor,
            """
            INSERT INTO order_main(
                order_no, user_id, address_id, status, total_amount, buyer_remark,
                created_at, updated_at
            ) VALUES(%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            order_rows,
        )
        cursor.execute(
            "SELECT id, order_no FROM order_main WHERE order_no LIKE %s ORDER BY order_no",
            (f"{SEED_ORDER_PREFIX}%",),
        )
        order_ids = {
            row["order_no"]: int(row["id"])
            for row in cursor.fetchall()
            if is_seed_order_no(row["order_no"])
        }
        if len(order_ids) != len(plans):
            raise ValueError("seed 订单写入数量不正确")
        item_rows = [
            (order_ids[plan.order_no], line.sku_id, line.quantity, line.price)
            for plan in plans
            for line in plan.lines
        ]
        execute_many_chunked(
            cursor,
            "INSERT INTO order_item(order_id, sku_id, quantity, price) VALUES(%s, %s, %s, %s)",
            item_rows,
        )

        paid_rows = [(order_ids[plan.order_no],) for plan in plans if plan.status in PAID_STATUSES]
        execute_many_chunked(cursor, "UPDATE order_main SET status='PAID' WHERE id=%s", paid_rows)
        for status in ("SHIPPED", "CANCELLED"):
            rows = [(status, order_ids[plan.order_no]) for plan in plans if plan.status == status]
            execute_many_chunked(cursor, "UPDATE order_main SET status=%s WHERE id=%s", rows)
        refund_requested_rows = [
            (order_ids[plan.order_no],) for plan in plans if plan.status == "REFUNDED"
        ]
        execute_many_chunked(
            cursor,
            "UPDATE order_main SET status='REFUND_REQUESTED' WHERE id=%s",
            refund_requested_rows,
        )
        execute_many_chunked(
            cursor,
            "UPDATE order_main SET status='REFUNDED' WHERE id=%s",
            refund_requested_rows,
        )

        final_time_rows = [
            (plan.created_at, plan.updated_at, order_ids[plan.order_no]) for plan in plans
        ]
        execute_many_chunked(
            cursor,
            "UPDATE order_main SET created_at=%s, updated_at=%s WHERE id=%s",
            final_time_rows,
        )

        payment_rows: list[tuple] = []
        for plan in plans:
            order_id = order_ids[plan.order_no]
            if plan.status in PAID_STATUSES:
                method = "ALIPAY" if plan.sequence % 2 else "WECHAT"
                payment_rows.append((order_id, method, "SUCCESS", plan.total_amount, plan.paid_at))
            if plan.status == "REFUNDED":
                payment_rows.append((order_id, "REFUND", "SUCCESS", plan.total_amount, plan.refunded_at))
        execute_many_chunked(
            cursor,
            """
            INSERT INTO payment_record(order_id, pay_method, pay_status, pay_amount, created_at)
            VALUES(%s, %s, %s, %s, %s)
            """,
            payment_rows,
        )

        _delete_by_ids(cursor, "order_status_log", "order_id", list(order_ids.values()))
        status_rows = [
            row
            for plan in plans
            for row in _status_log_rows(order_ids[plan.order_no], plan)
        ]
        execute_many_chunked(
            cursor,
            """
            INSERT INTO order_status_log(order_id, from_status, to_status, remark, created_at)
            VALUES(%s, %s, %s, %s, %s)
            """,
            status_rows,
        )

        pending_rows = [
            (line.quantity, line.quantity, line.sku_id, line.quantity)
            for plan in plans
            if plan.status == "PENDING_PAYMENT"
            for line in plan.lines
        ]
        for available_qty, locked_qty, sku_id, required in pending_rows:
            cursor.execute(
                """
                UPDATE inventory
                SET available_stock = available_stock - %s,
                    locked_stock = locked_stock + %s
                WHERE sku_id = %s AND available_stock >= %s
                """,
                (available_qty, locked_qty, sku_id, required),
            )
            if cursor.rowcount != 1:
                raise ValueError(f"待支付订单锁定库存不足：sku_id={sku_id}")
        inventory_log_rows = [row for plan in plans for row in _inventory_log_rows(plan)]
        execute_many_chunked(
            cursor,
            """
            INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no, created_at)
            VALUES(%s, %s, %s, %s, %s)
            """,
            inventory_log_rows,
        )


def rebuild_sales_stats(conn) -> None:
    placeholders = ", ".join(["%s"] * len(EFFECTIVE_STATUSES))
    with conn.cursor() as cursor:
        cursor.execute(
            f"""
            INSERT INTO product_sales_stat(sku_id, total_sold_count, total_sales_amount)
            SELECT
                s.id,
                COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity * oi.price ELSE 0 END), 0.00)
            FROM product_sku s
            LEFT JOIN order_item oi ON oi.sku_id = s.id
            LEFT JOIN order_main o ON o.id = oi.order_id
            GROUP BY s.id
            ON DUPLICATE KEY UPDATE
                total_sold_count = VALUES(total_sold_count),
                total_sales_amount = VALUES(total_sales_amount)
            """,
            (*EFFECTIVE_STATUSES, *EFFECTIVE_STATUSES),
        )


def verify_protected_snapshot(before: dict, after: dict) -> int:
    changed = []
    for key in ("products", "skus", "images", "categories", "tags", "product_tags"):
        if before[key] != after[key]:
            changed.append(key)
    before_users = {int(row["id"]) for row in before["non_seed_users"]}
    after_users = {int(row["id"]) for row in after["non_seed_users"]}
    before_orders = {int(row["id"]) for row in before["non_seed_orders"]}
    after_orders = {int(row["id"]) for row in after["non_seed_orders"]}
    deleted_count = len(before_users - after_users) + len(before_orders - after_orders)
    if changed or deleted_count:
        raise ValueError(f"受保护基础数据发生变化：tables={changed}, deleted={deleted_count}")
    return deleted_count


def collect_verification(conn, targets: dict[int, int] | None = None) -> dict:
    placeholders = ", ".join(["%s"] * len(EFFECTIVE_STATUSES))
    result: dict = {}
    with conn.cursor() as cursor:
        cursor.execute("SELECT COUNT(*) AS count FROM product WHERE is_deleted=0")
        result["active_product_count"] = int(cursor.fetchone()["count"])
        cursor.execute("SELECT COUNT(*) AS count FROM user WHERE email LIKE %s", ("seed_sales_%@example.test",))
        result["seed_user_count"] = int(cursor.fetchone()["count"])
        cursor.execute(
            """
            SELECT COUNT(*) AS count FROM user_address a
            JOIN user u ON u.id=a.user_id WHERE u.email LIKE %s
            """,
            ("seed_sales_%@example.test",),
        )
        result["seed_address_count"] = int(cursor.fetchone()["count"])
        cursor.execute("SELECT COUNT(*) AS count FROM order_main WHERE order_no LIKE %s", (f"{SEED_ORDER_PREFIX}%",))
        result["seed_order_count"] = int(cursor.fetchone()["count"])
        cursor.execute(
            """
            SELECT COUNT(*) AS count FROM order_item oi
            JOIN order_main o ON o.id=oi.order_id WHERE o.order_no LIKE %s
            """,
            (f"{SEED_ORDER_PREFIX}%",),
        )
        result["seed_order_item_count"] = int(cursor.fetchone()["count"])
        cursor.execute(
            "SELECT status, COUNT(*) AS count FROM order_main WHERE order_no LIKE %s GROUP BY status ORDER BY status",
            (f"{SEED_ORDER_PREFIX}%",),
        )
        result["status_counts"] = {row["status"]: int(row["count"]) for row in cursor.fetchall()}
        cursor.execute(
            f"""
            SELECT COALESCE(SUM(oi.quantity),0) AS sold_count,
                   COALESCE(SUM(oi.quantity*oi.price),0.00) AS sales_amount
            FROM order_main o JOIN order_item oi ON oi.order_id=o.id
            WHERE o.status IN ({placeholders})
            """,
            EFFECTIVE_STATUSES,
        )
        row = cursor.fetchone()
        result["effective_total_sales"] = int(row["sold_count"])
        result["effective_total_amount"] = Decimal(row["sales_amount"])
        cursor.execute(
            """
            SELECT p.id AS product_id, p.name,
                   COALESCE(SUM(stat.total_sold_count),0) AS sold_count,
                   COALESCE(SUM(stat.total_sales_amount),0.00) AS sales_amount
            FROM product p
            JOIN product_sku s ON s.product_id=p.id AND s.is_deleted=0 AND s.status='ON_SALE'
            LEFT JOIN product_sales_stat stat ON stat.sku_id=s.id
            WHERE p.is_deleted=0
            GROUP BY p.id,p.name
            ORDER BY sold_count DESC,p.id
            """
        )
        result["ranking"] = list(cursor.fetchall())
        cursor.execute(
            f"""
            SELECT COUNT(*) AS count FROM (
                SELECT s.id,
                    COALESCE(stat.total_sold_count,0) AS stat_count,
                    COALESCE(stat.total_sales_amount,0.00) AS stat_amount,
                    COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity ELSE 0 END),0) AS actual_count,
                    COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity*oi.price ELSE 0 END),0.00) AS actual_amount
                FROM product_sku s
                LEFT JOIN product_sales_stat stat ON stat.sku_id=s.id
                LEFT JOIN order_item oi ON oi.sku_id=s.id
                LEFT JOIN order_main o ON o.id=oi.order_id
                GROUP BY s.id,stat.total_sold_count,stat.total_sales_amount
                HAVING stat_count<>actual_count OR stat_amount<>actual_amount
            ) diff
            """,
            (*EFFECTIVE_STATUSES, *EFFECTIVE_STATUSES),
        )
        result["sales_stat_diff_count"] = int(cursor.fetchone()["count"])
        cursor.execute(
            """
            SELECT COUNT(*) AS count FROM order_main o
            JOIN (SELECT order_id,SUM(quantity*price) amount FROM order_item GROUP BY order_id) x ON x.order_id=o.id
            WHERE o.total_amount<>x.amount
            """
        )
        result["order_amount_error_count"] = int(cursor.fetchone()["count"])
        paid_placeholders = ", ".join(["%s"] * len(PAID_STATUSES))
        cursor.execute(
            f"""
            SELECT COUNT(*) AS count FROM order_main o
            WHERE o.status IN ({paid_placeholders})
              AND NOT EXISTS(
                SELECT 1 FROM payment_record pr
                WHERE pr.order_id=o.id AND pr.pay_status='SUCCESS' AND pr.pay_method<>'REFUND'
              )
            """,
            PAID_STATUSES,
        )
        result["missing_payment_count"] = int(cursor.fetchone()["count"])
        cursor.execute("SELECT COUNT(*) AS count FROM (SELECT order_no FROM order_main GROUP BY order_no HAVING COUNT(*)>1) x")
        result["duplicate_order_no_count"] = int(cursor.fetchone()["count"])
        cursor.execute("SELECT COUNT(*) AS count FROM inventory WHERE available_stock<0")
        result["negative_stock_count"] = int(cursor.fetchone()["count"])
        cursor.execute("SELECT COUNT(*) AS count FROM inventory WHERE locked_stock<0")
        result["negative_locked_stock_count"] = int(cursor.fetchone()["count"])
        orphan_queries = {
            "orphan_order_item_count": "SELECT COUNT(*) count FROM order_item x LEFT JOIN order_main p ON p.id=x.order_id WHERE p.id IS NULL",
            "orphan_payment_count": "SELECT COUNT(*) count FROM payment_record x LEFT JOIN order_main p ON p.id=x.order_id WHERE p.id IS NULL",
            "orphan_status_log_count": "SELECT COUNT(*) count FROM order_status_log x LEFT JOIN order_main p ON p.id=x.order_id WHERE p.id IS NULL",
            "invalid_sales_record_count": "SELECT COUNT(*) count FROM product_sales_stat x LEFT JOIN product_sku s ON s.id=x.sku_id WHERE s.id IS NULL",
        }
        for key, query in orphan_queries.items():
            cursor.execute(query)
            result[key] = int(cursor.fetchone()["count"])
        cursor.execute(
            """
            SELECT COUNT(*) AS count FROM order_item oi
            JOIN order_main o ON o.id=oi.order_id
            LEFT JOIN product_sku s ON s.id=oi.sku_id
            LEFT JOIN product p ON p.id=s.product_id
            WHERE o.order_no LIKE %s
              AND (s.id IS NULL OR s.is_deleted<>0 OR s.status<>'ON_SALE' OR p.id IS NULL OR p.is_deleted<>0)
            """,
            (f"{SEED_ORDER_PREFIX}%",),
        )
        result["invalid_seed_sku_count"] = int(cursor.fetchone()["count"])
        cursor.execute(
            """
            SELECT p.id product_id, SUM(stat.total_sold_count) sold_count
            FROM product p JOIN product_sku s ON s.product_id=p.id
            JOIN product_sales_stat stat ON stat.sku_id=s.id
            WHERE p.is_deleted=0 AND s.is_deleted=0 AND s.status='ON_SALE'
            GROUP BY p.id
            """
        )
        result["sku_sum_by_product"] = {int(row["product_id"]): int(row["sold_count"]) for row in cursor.fetchall()}

    if targets is not None and result["sku_sum_by_product"] != dict(sorted(targets.items())):
        raise ValueError("商品级目标与 SKU 销量汇总不一致")
    zero_required = (
        "sales_stat_diff_count",
        "order_amount_error_count",
        "missing_payment_count",
        "duplicate_order_no_count",
        "negative_stock_count",
        "negative_locked_stock_count",
        "orphan_order_item_count",
        "orphan_payment_count",
        "orphan_status_log_count",
        "invalid_sales_record_count",
        "invalid_seed_sku_count",
    )
    failures = {key: result[key] for key in zero_required if result[key] != 0}
    if failures:
        raise ValueError(f"一致性验证失败：{failures}")
    ranking = result["ranking"]
    if result["active_product_count"] != EXPECTED_PRODUCT_COUNT:
        raise ValueError("最终有效商品数量不是 13")
    if not 980 <= result["effective_total_sales"] <= 1020:
        raise ValueError("最终有效总销量不在 980～1020")
    if ranking[0]["name"] != TOP_PRODUCT_NAME or ranking[-1]["name"] != BOTTOM_PRODUCT_NAME:
        raise ValueError("最终销量首尾商品不符合指定要求")
    return result


def print_target_table(products: Sequence[dict], targets: dict[int, int], additions: dict[int, int]) -> None:
    names = {int(item["id"]): item["name"] for item in products}
    added_by_product: dict[int, int] = defaultdict(int)
    print("商品级目标销量：")
    for product_id, target in sorted(targets.items(), key=lambda item: (-item[1], item[0])):
        print(f"  {names[product_id]}: {target}")
    print(f"  合计: {sum(targets.values())}")
    print(f"本次将新增有效销量: {sum(additions.values())}")


def print_verification(result: dict) -> None:
    print("生成后验证：")
    ordered_keys = (
        "active_product_count", "seed_user_count", "seed_address_count",
        "seed_order_count", "seed_order_item_count", "status_counts",
        "effective_total_sales", "effective_total_amount", "sales_stat_diff_count",
        "order_amount_error_count", "missing_payment_count", "duplicate_order_no_count",
        "negative_stock_count", "negative_locked_stock_count", "orphan_order_item_count",
        "orphan_payment_count", "orphan_status_log_count", "invalid_sales_record_count",
        "invalid_seed_sku_count", "non_seed_deleted_count",
    )
    for key in ordered_keys:
        print(f"  {key}: {result.get(key, 0)}")
    print("13 件商品销量排名：")
    for index, row in enumerate(result["ranking"], start=1):
        print(f"  {index:02d}. {row['name']}: {row['sold_count']} 件 / CNY {row['sales_amount']}")
    print("每个商品的有效 SKU 销量之和：")
    for product_id, sold_count in sorted(result["sku_sum_by_product"].items()):
        print(f"  product_id={product_id}: {sold_count}")


def run_dry_run(conn) -> int:
    before = fetch_protected_snapshot(conn)
    print_preflight_snapshot(before)
    products, skus, targets, additions = build_sales_plan(conn)
    plans = build_order_plans(additions, skus, datetime.now().replace(microsecond=0))
    print_target_table(products, targets, additions)
    print(f"计划合成用户: {SYNTHETIC_USER_COUNT}")
    print(f"计划订单: {len(plans)}")
    print(f"计划订单明细: {sum(len(plan.lines) for plan in plans)}")
    print(f"计划状态分布: {dict(sorted(Counter(plan.status for plan in plans).items()))}")
    after = fetch_protected_snapshot(conn)
    if before != after:
        raise RuntimeError("dry-run 前后数据库快照不一致")
    print("dry-run 完成：数据库快照前后一致，未写入任何数据。")
    return 0


def run_execute(conn) -> int:
    before = fetch_protected_snapshot(conn)
    print_preflight_snapshot(before)
    try:
        conn.begin()
        deleted = cleanup_existing_seed_data(conn)
        products, skus, targets, additions = build_sales_plan(conn)
        plans = build_order_plans(additions, skus, datetime.now().replace(microsecond=0))
        print_target_table(products, targets, additions)
        print(f"本次替换旧 seed 数据: {deleted}")
        user_ids, address_ids = insert_seed_users_and_addresses(conn)
        insert_orders(conn, plans, user_ids, address_ids)
        rebuild_sales_stats(conn)
        after = fetch_protected_snapshot(conn)
        non_seed_deleted_count = verify_protected_snapshot(before, after)
        result = collect_verification(conn, targets)
        result["non_seed_deleted_count"] = non_seed_deleted_count
        print_verification(result)
        sys.stdout.flush()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    try:
        print("销售演示数据生成完成，事务已提交。")
    except UnicodeEncodeError:
        pass
    return 0


def run_cleanup_only(conn) -> int:
    before = fetch_protected_snapshot(conn)
    try:
        conn.begin()
        deleted = cleanup_existing_seed_data(conn)
        rebuild_sales_stats(conn)
        after = fetch_protected_snapshot(conn)
        non_seed_deleted_count = verify_protected_snapshot(before, after)
        placeholders = ", ".join(["%s"] * len(EFFECTIVE_STATUSES))
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS count FROM user WHERE email LIKE %s",
                ("seed_sales_%@example.test",),
            )
            seed_user_count = int(cursor.fetchone()["count"])
            cursor.execute(
                "SELECT COUNT(*) AS count FROM order_main WHERE order_no LIKE %s",
                (f"{SEED_ORDER_PREFIX}%",),
            )
            seed_order_count = int(cursor.fetchone()["count"])
            cursor.execute(
                f"""
                SELECT COUNT(*) AS count FROM (
                    SELECT s.id,
                        COALESCE(stat.total_sold_count,0) AS stat_count,
                        COALESCE(stat.total_sales_amount,0.00) AS stat_amount,
                        COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity ELSE 0 END),0) AS actual_count,
                        COALESCE(SUM(CASE WHEN o.status IN ({placeholders}) THEN oi.quantity*oi.price ELSE 0 END),0.00) AS actual_amount
                    FROM product_sku s
                    LEFT JOIN product_sales_stat stat ON stat.sku_id=s.id
                    LEFT JOIN order_item oi ON oi.sku_id=s.id
                    LEFT JOIN order_main o ON o.id=oi.order_id
                    GROUP BY s.id,stat.total_sold_count,stat.total_sales_amount
                    HAVING stat_count<>actual_count OR stat_amount<>actual_amount
                ) diff
                """,
                (*EFFECTIVE_STATUSES, *EFFECTIVE_STATUSES),
            )
            diff_count = int(cursor.fetchone()["count"])
        if seed_user_count or seed_order_count or diff_count or non_seed_deleted_count:
            raise ValueError(
                "seed 清理验证失败："
                f"users={seed_user_count}, orders={seed_order_count}, "
                f"sales_diff={diff_count}, non_seed_deleted={non_seed_deleted_count}"
            )
        print(
            "seed 清理验证通过："
            f"deleted={deleted}, sales_diff=0, non_seed_deleted=0"
        )
        sys.stdout.flush()
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    print("seed 销售演示数据已清理，事务已提交。")
    return 0


def main() -> int:
    args = parse_args()
    conn = get_connection()
    try:
        if args.cleanup_only:
            return run_cleanup_only(conn)
        if args.execute:
            return run_execute(conn)
        return run_dry_run(conn)
    except Exception as error:
        print(f"销售演示数据生成失败，事务已回滚：{error}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
