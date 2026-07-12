-- 复杂 SKU 增量迁移：固定支持颜色和尺码两个结构化维度。
-- 旧 SKU 保持 NULL，不根据不可靠的 sku_name 自动拆分。
USE frieren_cloth_shop_db;

ALTER TABLE product_sku
    ADD COLUMN sku_code VARCHAR(100) NULL AFTER product_id,
    ADD COLUMN color_name VARCHAR(50) NULL AFTER sku_name,
    ADD COLUMN size_name VARCHAR(30) NULL AFTER color_name,
    ADD INDEX idx_product_sku_code (sku_code),
    ADD INDEX idx_product_sku_dimensions (
        product_id,
        color_name,
        size_name,
        is_deleted
    );

CREATE OR REPLACE VIEW v_product_detail AS
SELECT
    c.id AS category_id,
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
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
