# Phase 01 - Database

Status: COMPLETE_WITH_LIMITATION

## Implementation

- Migration: `11_catalog_metadata_favorites_tags.sql`
- Additive columns: `product.description`, `order_main.buyer_remark`, `category.is_protected`
- New tables: `product_favorite`, `product_tag`, `product_tag_relation`
- `operation_log`: created when absent and extended column-by-column when present
- Categories: protected `无分类` plus six required active seeds
- View: `v_product_detail` retains existing SKU/inventory/sales fields and adds description and aggregated tag names

## Idempotency and safety

- Missing columns are detected through `information_schema.COLUMNS`; the migration does not use unsupported `ADD COLUMN IF NOT EXISTS`.
- Tables use `CREATE TABLE IF NOT EXISTS`; categories use unique-name upsert semantics.
- No delete, truncate, inventory/order/image update, or business-row replacement is present.
- Existing uploads and credentials are untouched.

## Verification

- RED: `node --test tests/db_migration.test.js` failed 5/5 because the migration did not exist.
- GREEN: migration contract suite passes 6/6.
- Full `npm.cmd test`, JS syntax, Python compile, and `git diff --check`: pending final phase verification.
- Live MySQL 8.0.28 client is installed, but `root` without a password was rejected with `ERROR 1045 (28000)`.

## Limitation and recovery

Live migration execution and before/after row-count comparison are credential-blocked. Resume by supplying the existing local DB credentials through the normal ignored environment configuration, record product/SKU/inventory/order/image counts, run the migration twice, and prove counts and view rows remain stable.
