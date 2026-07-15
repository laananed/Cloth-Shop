-- ============================================================
-- 阶段 4：商品介绍增量迁移
-- 前置条件：已按顺序执行 01-05，当前数据库为 frieren_cloth_shop_db。
-- 影响对象：product.description、v_product_detail。
-- 重复执行：字段已存在时跳过 ADD COLUMN；视图使用 OR REPLACE。
-- 恢复说明：本迁移不改写业务数据；如需回退应用，请先保留字段，避免丢失介绍。
-- ============================================================

USE frieren_cloth_shop_db;

SET @description_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'product'
      AND column_name = 'description'
);

SET @add_description_sql := IF(
    @description_column_exists = 0,
    'ALTER TABLE product ADD COLUMN description TEXT NULL COMMENT ''商品介绍（普通文本）'' AFTER name',
    'SELECT ''product.description already exists'' AS migration_status'
);

PREPARE add_description_stmt FROM @add_description_sql;
EXECUTE add_description_stmt;
DEALLOCATE PREPARE add_description_stmt;

CREATE OR REPLACE VIEW v_product_detail AS
SELECT
    c.id AS category_id,
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
    p.description AS description,
    p.image_url AS image_url,
    p.status AS product_status,
    s.id AS sku_id,
    s.sku_code AS sku_code,
    s.sku_name AS sku_name,
    s.color_name AS color_name,
    s.size_name AS size_name,
    s.price AS price,
    s.status AS sku_status,
    s.is_deleted AS sku_is_deleted,
    i.available_stock AS available_stock,
    i.locked_stock AS locked_stock,
    COALESCE(stat.total_sold_count, 0) AS total_sold_count,
    COALESCE(stat.total_sales_amount, 0.00) AS total_sales_amount,
    p.created_at AS product_created_at,
    p.updated_at AS product_updated_at,
    i.updated_at AS inventory_updated_at
FROM category c
JOIN product p ON c.id = p.category_id
JOIN product_sku s ON p.id = s.product_id
LEFT JOIN inventory i ON s.id = i.sku_id
LEFT JOIN product_sales_stat stat ON s.id = stat.sku_id
WHERE c.is_deleted = 0
  AND p.is_deleted = 0
  AND s.is_deleted = 0;
