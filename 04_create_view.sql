CREATE OR REPLACE VIEW v_product_detail AS
SELECT
    c.id AS category_id,
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
    p.image_url AS image_url,
    p.status AS product_status,
    s.id AS sku_id,
    s.sku_name AS sku_name,
    s.price AS price,
    s.status AS sku_status,
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
