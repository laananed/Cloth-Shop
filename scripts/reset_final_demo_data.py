#!/usr/bin/env python3
"""清空旧商品与交易演示数据；默认只预览，传入 --execute 才执行。"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
RUNTIME_PRODUCT_UPLOAD_DIR = ROOT_DIR / Path("backend/uploads/products")
PENDING_IMAGE_MANIFEST = (
    ROOT_DIR / "local_backups" / "final_demo_reset" / "pending_product_images.json"
)
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.db import get_connection  # noqa: E402


REPORT_TABLES = (
    "cart_item",
    "cart",
    "payment_record",
    "order_status_log",
    "order_item",
    "order_main",
    "inventory_log",
    "product_sales_stat",
    "product_tag",
    "product_image",
    "inventory",
    "product_sku",
    "product",
    "operation_log",
)
PRESERVED_TABLES = ("user", "user_address", "category", "tag")

# 按当前 information_schema 外键依赖从子表到父表排列；不关闭外键检查。
DELETE_ORDER = (
    "cart_item",
    "payment_record",
    "order_status_log",
    "order_item",
    "inventory_log",
    "product_sales_stat",
    "product_tag",
    "product_image",
    "inventory",
    "order_main",
    "cart",
    "product_sku",
    "product",
)

AUTO_INCREMENT_TABLES = (
    "cart_item",
    "cart",
    "payment_record",
    "order_status_log",
    "order_item",
    "order_main",
    "inventory_log",
    "product_image",
    "inventory",
    "product_sku",
    "product",
    "operation_log",
)

OPERATION_LOG_DELETE_SQL = """
DELETE FROM operation_log
WHERE UPPER(COALESCE(target_type, '')) IN (
    'PRODUCT', 'SKU', 'PRODUCT_SKU', 'INVENTORY', 'PRODUCT_IMAGE', 'ORDER', 'CART'
)
OR UPPER(action_type) REGEXP 'PRODUCT|SKU|INVENTORY|STOCK|ORDER|PAY|REFUND|SHIP|CART|SALE'
OR UPPER(action_type) IN ('INIT_STAT')
"""

ORPHAN_QUERIES = {
    "cart_item.cart_id": "SELECT COUNT(*) AS row_count FROM cart_item child LEFT JOIN cart parent ON parent.id = child.cart_id WHERE parent.id IS NULL",
    "cart_item.sku_id": "SELECT COUNT(*) AS row_count FROM cart_item child LEFT JOIN product_sku parent ON parent.id = child.sku_id WHERE parent.id IS NULL",
    "order_item.order_id": "SELECT COUNT(*) AS row_count FROM order_item child LEFT JOIN order_main parent ON parent.id = child.order_id WHERE parent.id IS NULL",
    "order_item.sku_id": "SELECT COUNT(*) AS row_count FROM order_item child LEFT JOIN product_sku parent ON parent.id = child.sku_id WHERE parent.id IS NULL",
    "payment_record.order_id": "SELECT COUNT(*) AS row_count FROM payment_record child LEFT JOIN order_main parent ON parent.id = child.order_id WHERE parent.id IS NULL",
    "order_status_log.order_id": "SELECT COUNT(*) AS row_count FROM order_status_log child LEFT JOIN order_main parent ON parent.id = child.order_id WHERE parent.id IS NULL",
    "inventory.sku_id": "SELECT COUNT(*) AS row_count FROM inventory child LEFT JOIN product_sku parent ON parent.id = child.sku_id WHERE parent.id IS NULL",
    "inventory_log.sku_id": "SELECT COUNT(*) AS row_count FROM inventory_log child LEFT JOIN product_sku parent ON parent.id = child.sku_id WHERE parent.id IS NULL",
    "product_sales_stat.sku_id": "SELECT COUNT(*) AS row_count FROM product_sales_stat child LEFT JOIN product_sku parent ON parent.id = child.sku_id WHERE parent.id IS NULL",
    "product_sku.product_id": "SELECT COUNT(*) AS row_count FROM product_sku child LEFT JOIN product parent ON parent.id = child.product_id WHERE parent.id IS NULL",
    "product_image.product_id": "SELECT COUNT(*) AS row_count FROM product_image child LEFT JOIN product parent ON parent.id = child.product_id WHERE parent.id IS NULL",
    "product_tag.product_id": "SELECT COUNT(*) AS row_count FROM product_tag child LEFT JOIN product parent ON parent.id = child.product_id WHERE parent.id IS NULL",
}


@dataclass
class ImageCleanupResult:
    deleted: list[Path]
    missing: list[Path]
    failed: list[tuple[Path, str]]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="清空旧商品和旧交易演示数据")
    parser.add_argument(
        "--execute",
        action="store_true",
        help="实际执行删除；未提供时只打印各表行数和预计清理范围",
    )
    return parser.parse_args()


def fetch_counts(conn, tables: tuple[str, ...]) -> dict[str, int]:
    counts: dict[str, int] = {}
    with conn.cursor() as cursor:
        for table in tables:
            cursor.execute(f"SELECT COUNT(*) AS row_count FROM `{table}`")
            counts[table] = int(cursor.fetchone()["row_count"])
    return counts


def fetch_operation_log_cleanup_count(conn) -> int:
    condition = OPERATION_LOG_DELETE_SQL.split("WHERE", 1)[1]
    with conn.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) AS row_count FROM operation_log WHERE {condition}")
        return int(cursor.fetchone()["row_count"])


def fetch_product_image_urls(conn) -> list[str]:
    with conn.cursor() as cursor:
        cursor.execute(
            """
            SELECT image_url FROM product WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''
            UNION
            SELECT image_url FROM product_image WHERE image_url IS NOT NULL AND TRIM(image_url) <> ''
            """
        )
        return [str(row["image_url"]).strip() for row in cursor.fetchall()]


def print_counts(label: str, counts: dict[str, int]) -> None:
    print(label)
    for table, count in counts.items():
        print(f"  {table}: {count}")


def create_database_backup(conn) -> Path | None:
    mysqldump = shutil.which("mysqldump")
    if not mysqldump:
        print("未生成完整数据库备份：未找到 mysqldump。")
        return None

    with conn.cursor() as cursor:
        cursor.execute("SELECT DATABASE() AS db_name")
        database = str(cursor.fetchone()["db_name"])

    backup_dir = ROOT_DIR / "local_backups" / "final_demo_reset"
    backup_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backup_dir / f"{database}_{timestamp}.sql"
    command = [
        mysqldump,
        "--single-transaction",
        "--routines",
        "--triggers",
        "--no-tablespaces",
        "--host",
        os.getenv("DB_HOST", "127.0.0.1"),
        "--port",
        os.getenv("DB_PORT", "3306"),
        "--user",
        os.getenv("DB_USER", "root"),
        database,
    ]
    environment = os.environ.copy()
    environment["MYSQL_PWD"] = os.getenv("DB_PASSWORD", "")

    with backup_path.open("wb") as output:
        result = subprocess.run(
            command,
            stdout=output,
            stderr=subprocess.PIPE,
            env=environment,
            check=False,
        )
    if result.returncode != 0:
        backup_path.unlink(missing_ok=True)
        detail = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"mysqldump 备份失败，已停止清理：{detail}")

    print(f"完整数据库备份：{backup_path}")
    return backup_path


def delete_business_data(conn) -> dict[str, int]:
    deleted: dict[str, int] = {}
    try:
        conn.begin()
        with conn.cursor() as cursor:
            for table in DELETE_ORDER:
                cursor.execute(f"DELETE FROM `{table}`")
                deleted[table] = max(0, int(cursor.rowcount))
            cursor.execute(OPERATION_LOG_DELETE_SQL)
            deleted["operation_log"] = max(0, int(cursor.rowcount))
        conn.commit()
        return deleted
    except Exception:
        conn.rollback()
        raise


def reset_auto_increment(conn) -> None:
    # ALTER TABLE 在 MySQL 中会隐式提交，因此只在删除事务成功提交后单独执行。
    with conn.cursor() as cursor:
        for table in AUTO_INCREMENT_TABLES:
            cursor.execute(f"ALTER TABLE `{table}` AUTO_INCREMENT = 1")


def image_url_to_runtime_path(image_url: str, upload_dir: Path) -> Path | None:
    parsed_path = unquote(urlsplit(str(image_url).strip()).path).replace("\\", "/")
    prefix = "/uploads/products/"
    if not parsed_path.startswith(prefix):
        return None
    relative_name = parsed_path[len(prefix):]
    if not relative_name or "/" in relative_name or relative_name in {".", "..", ".gitkeep"}:
        return None
    candidate = (upload_dir / relative_name).resolve()
    if candidate.parent != upload_dir.resolve():
        return None
    return candidate


def remove_product_image_files(image_urls: list[str], upload_dir: Path) -> ImageCleanupResult:
    result = ImageCleanupResult(deleted=[], missing=[], failed=[])
    candidates = {
        candidate
        for image_url in image_urls
        if (candidate := image_url_to_runtime_path(image_url, upload_dir)) is not None
    }
    for path in sorted(candidates, key=lambda item: item.name.lower()):
        if not path.exists():
            result.missing.append(path)
            continue
        try:
            if not path.is_file():
                raise OSError("目标不是普通文件")
            path.unlink()
            result.deleted.append(path)
        except OSError as error:
            result.failed.append((path, str(error)))
    return result


def load_pending_image_urls(manifest_path: Path) -> list[str]:
    if not manifest_path.exists():
        return []
    try:
        content = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"无法读取待清理商品图片清单 {manifest_path}: {error}") from error
    if not isinstance(content, list) or any(
        not isinstance(item, str) or not item.strip() for item in content
    ):
        raise RuntimeError(f"待清理商品图片清单格式无效：{manifest_path}")
    return sorted(set(item.strip() for item in content))


def persist_pending_image_urls(image_urls: list[str], manifest_path: Path) -> list[str]:
    pending = sorted(
        set(load_pending_image_urls(manifest_path))
        | {str(item).strip() for item in image_urls if str(item).strip()}
    )
    if not pending:
        return []
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = manifest_path.with_suffix(f"{manifest_path.suffix}.tmp")
    try:
        temporary_path.write_text(
            json.dumps(pending, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary_path.replace(manifest_path)
    except OSError as error:
        temporary_path.unlink(missing_ok=True)
        raise RuntimeError(f"无法保存待清理商品图片清单 {manifest_path}: {error}") from error
    return pending


def cleanup_pending_product_images(
    image_urls: list[str], upload_dir: Path, manifest_path: Path
) -> ImageCleanupResult:
    result = remove_product_image_files(image_urls, upload_dir)
    if not result.failed:
        try:
            manifest_path.unlink(missing_ok=True)
        except OSError as error:
            raise RuntimeError(f"商品图片已处理，但无法删除待清理清单 {manifest_path}: {error}") from error
    return result


def fetch_orphan_counts(conn) -> dict[str, int]:
    counts: dict[str, int] = {}
    with conn.cursor() as cursor:
        for relation, query in ORPHAN_QUERIES.items():
            cursor.execute(query)
            counts[relation] = int(cursor.fetchone()["row_count"])
    return counts


def main() -> int:
    args = parse_args()
    conn = get_connection()
    try:
        before = fetch_counts(conn, REPORT_TABLES + PRESERVED_TABLES)
        cleanup_log_count = fetch_operation_log_cleanup_count(conn)
        image_urls = fetch_product_image_urls(conn)
        pending_image_urls = load_pending_image_urls(PENDING_IMAGE_MANIFEST)
        print_counts("删除前记录数：", before)
        print(f"  operation_log 中符合旧商品/交易清理条件：{cleanup_log_count}")
        print(f"  数据库引用的商品图片 URL：{len(set(image_urls))}")
        print(f"  上次待重试的商品图片 URL：{len(pending_image_urls)}")

        if not args.execute:
            print("预览完成：未提供 --execute，未删除数据库记录或图片文件。")
            return 0

        create_database_backup(conn)
        retryable_image_urls = [
            image_url
            for image_url in pending_image_urls + image_urls
            if image_url_to_runtime_path(image_url, RUNTIME_PRODUCT_UPLOAD_DIR) is not None
        ]
        pending_image_urls = persist_pending_image_urls(
            retryable_image_urls, PENDING_IMAGE_MANIFEST
        )
        deleted = delete_business_data(conn)
        reset_auto_increment(conn)
        after = fetch_counts(conn, REPORT_TABLES + PRESERVED_TABLES)
        orphans = fetch_orphan_counts(conn)
        print_counts("本次实际删除记录数：", deleted)
        print_counts("删除后记录数：", after)
        print_counts("外键孤儿记录数：", orphans)

        changed_preserved = [
            table for table in PRESERVED_TABLES if before[table] != after[table]
        ]
        nonempty_business = [
            table for table in REPORT_TABLES if table != "operation_log" and after[table] != 0
        ]
        orphan_relations = [relation for relation, count in orphans.items() if count != 0]
        if changed_preserved or nonempty_business or orphan_relations:
            raise RuntimeError(
                "数据库清理后验证失败："
                f"保留表变化={changed_preserved}，未清空表={nonempty_business}，孤儿关系={orphan_relations}"
            )

        image_result = cleanup_pending_product_images(
            pending_image_urls, RUNTIME_PRODUCT_UPLOAD_DIR, PENDING_IMAGE_MANIFEST
        )
        print(f"已删除旧商品图片：{len(image_result.deleted)}")
        for path in image_result.deleted:
            print(f"  deleted: {path}")
        for path in image_result.missing:
            print(f"  missing: {path}")
        for path, detail in image_result.failed:
            print(f"  failed: {path}: {detail}")
        if image_result.failed:
            return 2

        print("最终演示数据清理完成。")
        return 0
    except Exception as error:
        print(f"清理失败：{error}", file=sys.stderr)
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
