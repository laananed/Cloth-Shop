-- 视图（整理合并版）
-- 后面的复杂 SKU 版本会覆盖前面的 v_product_detail，使其包含 sku_code、color_name、size_name。
-- 编码：UTF-8

-- ============================================================
-- 商城业务视图
-- 来源：04_create_view.sql
-- ============================================================

USE frieren_cloth_shop_db;

-- =========================================================
-- 03_create_view.sql
-- 作用：创建课程设计报告中可展示的常用业务视图
-- 执行前提：已执行 01_create_table.sql 和 02_test_table.sql
-- =========================================================

-- 1. 商品详细视图：用于前台商品列表 / 商品详情页
DROP VIEW IF EXISTS v_product_detail;
CREATE VIEW v_product_detail AS
SELECT
    c.id AS category_id,
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
    p.image_url,
    p.status AS product_status,
    s.id AS sku_id,
    s.sku_name,
    s.price,
    s.status AS sku_status,
    i.available_stock,
    i.locked_stock,
    COALESCE(stat.total_sold_count, 0) AS total_sold_count,
    COALESCE(stat.total_sales_amount, 0.00) AS total_sales_amount,
    p.created_at AS product_created_at,
    p.updated_at AS product_updated_at
FROM category c
JOIN product p ON c.id = p.category_id
JOIN product_sku s ON p.id = s.product_id
LEFT JOIN inventory i ON s.id = i.sku_id
LEFT JOIN product_sales_stat stat ON s.id = stat.sku_id
WHERE c.is_deleted = 0
  AND p.is_deleted = 0
  AND s.is_deleted = 0;

-- 2. 用户购物车视图：用于展示用户当前购物车内容
DROP VIEW IF EXISTS v_user_cart_detail;
CREATE VIEW v_user_cart_detail AS
SELECT
    u.id AS user_id,
    u.email,
    cart.id AS cart_id,
    ci.id AS cart_item_id,
    p.id AS product_id,
    p.name AS product_name,
    s.id AS sku_id,
    s.sku_name,
    s.price,
    ci.quantity,
    s.price * ci.quantity AS item_amount,
    i.available_stock,
    cart.status AS cart_status,
    ci.created_at,
    ci.updated_at
FROM `user` u
JOIN cart ON u.id = cart.user_id
JOIN cart_item ci ON cart.id = ci.cart_id
JOIN product_sku s ON ci.sku_id = s.id
JOIN product p ON s.product_id = p.id
LEFT JOIN inventory i ON s.id = i.sku_id
WHERE u.is_deleted = 0;

-- 3. 用户订单详情视图：用于用户订单页 / 管理员订单详情页
DROP VIEW IF EXISTS v_user_order_detail;
CREATE VIEW v_user_order_detail AS
SELECT
    u.id AS user_id,
    u.email,
    o.id AS order_id,
    o.order_no,
    o.status AS order_status,
    o.total_amount,
    o.created_at AS order_created_at,
    o.updated_at AS order_updated_at,
    a.recipient_name,
    a.phone,
    a.detail AS address_detail,
    oi.id AS order_item_id,
    p.id AS product_id,
    p.name AS product_name,
    s.id AS sku_id,
    s.sku_name,
    oi.quantity,
    oi.price,
    oi.quantity * oi.price AS item_amount,
    pr.pay_method,
    pr.pay_status,
    pr.pay_amount,
    pr.created_at AS pay_created_at
FROM order_main o
JOIN `user` u ON o.user_id = u.id
JOIN user_address a ON o.address_id = a.id
JOIN order_item oi ON o.id = oi.order_id
JOIN product_sku s ON oi.sku_id = s.id
JOIN product p ON s.product_id = p.id
LEFT JOIN payment_record pr ON o.id = pr.order_id;

-- 4. 库存状态视图：用于后台库存管理和库存预警
DROP VIEW IF EXISTS v_inventory_status;
CREATE VIEW v_inventory_status AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    s.id AS sku_id,
    s.sku_name,
    i.available_stock,
    i.locked_stock,
    i.available_stock + i.locked_stock AS total_stock,
    CASE
        WHEN i.available_stock = 0 THEN 'OUT_OF_STOCK'
        WHEN i.available_stock <= 10 THEN 'LOW_STOCK'
        ELSE 'NORMAL'
    END AS stock_status,
    i.updated_at
FROM inventory i
JOIN product_sku s ON i.sku_id = s.id
JOIN product p ON s.product_id = p.id;

-- 5. 商品销量排行视图：用于首页热销商品 / 后台销售统计
DROP VIEW IF EXISTS v_product_sales_rank;
CREATE VIEW v_product_sales_rank AS
SELECT
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
    s.id AS sku_id,
    s.sku_name,
    s.price,
    COALESCE(stat.total_sold_count, 0) AS total_sold_count,
    COALESCE(stat.total_sales_amount, 0.00) AS total_sales_amount,
    RANK() OVER (ORDER BY COALESCE(stat.total_sold_count, 0) DESC, COALESCE(stat.total_sales_amount, 0.00) DESC) AS sales_rank
FROM product p
JOIN category c ON p.category_id = c.id
JOIN product_sku s ON p.id = s.product_id
LEFT JOIN product_sales_stat stat ON s.id = stat.sku_id
WHERE p.is_deleted = 0
  AND s.is_deleted = 0;

-- 6. 订单汇总视图：用于后台订单统计
DROP VIEW IF EXISTS v_order_summary;
CREATE VIEW v_order_summary AS
SELECT
    o.id AS order_id,
    o.order_no,
    o.user_id,
    u.email,
    o.status,
    o.total_amount,
    COUNT(oi.id) AS item_kind_count,
    SUM(oi.quantity) AS total_quantity,
    SUM(oi.quantity * oi.price) AS item_total_amount,
    o.created_at,
    o.updated_at
FROM order_main o
JOIN `user` u ON o.user_id = u.id
JOIN order_item oi ON o.id = oi.order_id
GROUP BY
    o.id, o.order_no, o.user_id, u.email,
    o.status, o.total_amount, o.created_at, o.updated_at;

-- =========================
-- 视图创建后验证
-- =========================
SELECT 'v_product_detail' AS view_name, COUNT(*) AS row_count FROM v_product_detail;
SELECT 'v_user_cart_detail' AS view_name, COUNT(*) AS row_count FROM v_user_cart_detail;
SELECT 'v_user_order_detail' AS view_name, COUNT(*) AS row_count FROM v_user_order_detail;
SELECT 'v_inventory_status' AS view_name, COUNT(*) AS row_count FROM v_inventory_status;
SELECT 'v_product_sales_rank' AS view_name, COUNT(*) AS row_count FROM v_product_sales_rank;
SELECT 'v_order_summary' AS view_name, COUNT(*) AS row_count FROM v_order_summary;

-- ============================================================
-- 复杂 SKU 版商品详情视图（最终覆盖版本）
-- 来源：11_add_product_sku_dimensions.sql（VIEW 部分）
-- ============================================================

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
