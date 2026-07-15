-- 测试数据、业务流程与验证（整理合并版）
-- 警告：包含清空测试数据的语句，只应在测试数据库中执行。
-- 为兼容新增 product_image 表，已补充其 DELETE 与 AUTO_INCREMENT 重置。
-- 编码：UTF-8

-- ============================================================
-- 测试数据初始化
-- 来源：02_test_table.sql
-- ============================================================

USE frieren_cloth_shop_db;

-- =========================
-- 0. 清空旧测试数据
-- 只建议在测试库执行
-- =========================

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM cart_item;
DELETE FROM payment_record;
DELETE FROM order_status_log;
DELETE FROM order_item;
DELETE FROM inventory_log;
DELETE FROM operation_log;
DELETE FROM product_sales_stat;
DELETE FROM product_image;
DELETE FROM inventory;
DELETE FROM order_main;
DELETE FROM cart;
DELETE FROM product_sku;
DELETE FROM product;
DELETE FROM user_address;
DELETE FROM category;
DELETE FROM `user`;

ALTER TABLE cart_item AUTO_INCREMENT = 1;
ALTER TABLE payment_record AUTO_INCREMENT = 1;
ALTER TABLE order_status_log AUTO_INCREMENT = 1;
ALTER TABLE order_item AUTO_INCREMENT = 1;
ALTER TABLE inventory_log AUTO_INCREMENT = 1;
ALTER TABLE operation_log AUTO_INCREMENT = 1;
ALTER TABLE product_image AUTO_INCREMENT = 1;
ALTER TABLE inventory AUTO_INCREMENT = 1;
ALTER TABLE order_main AUTO_INCREMENT = 1;
ALTER TABLE cart AUTO_INCREMENT = 1;
ALTER TABLE product_sku AUTO_INCREMENT = 1;
ALTER TABLE product AUTO_INCREMENT = 1;
ALTER TABLE user_address AUTO_INCREMENT = 1;
ALTER TABLE category AUTO_INCREMENT = 1;
ALTER TABLE `user` AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- =========================
-- 1. 用户数据
-- =========================

INSERT INTO `user` (id, email, password_hash, is_admin, is_deleted)
VALUES
(1, 'test_user@example.com', 'hash_test_123456', 0, 0),
(2, 'alice@example.com', 'hash_alice_123456', 0, 0),
(3, 'bob@example.com', 'hash_bob_123456', 0, 0),
(4, 'carol@example.com', 'hash_carol_123456', 0, 0),
(5, 'diana@example.com', 'hash_diana_123456', 0, 0),
(6, 'eva@example.com', 'hash_eva_123456', 0, 0),
(7, 'admin@example.com', 'hash_admin_123456', 1, 0),
(8, 'ops@example.com', 'hash_ops_123456', 1, 0);

-- =========================
-- 2. 用户地址
-- =========================

INSERT INTO user_address
(id, user_id, recipient_name, phone, detail, is_default, is_deleted)
VALUES
(1, 1, '测试用户', '13800000000', '广东省佛山市佛山大学南海校区 1 栋 101', 1, 0),
(2, 1, '测试用户', '13800000001', '广东省佛山市禅城区季华路 88 号', 0, 0),
(3, 2, 'Alice', '13800000002', '广东省广州市天河区体育西路 66 号', 1, 0),
(4, 3, 'Bob', '13800000003', '广东省深圳市南山区科技园 9 栋', 1, 0),
(5, 4, 'Carol', '13800000004', '广东省佛山市南海区桂城街道', 1, 0),
(6, 5, 'Diana', '13800000005', '广东省珠海市香洲区情侣路', 1, 0),
(7, 6, 'Eva', '13800000006', '广东省东莞市松山湖大学路', 1, 0),
(8, 7, '管理员', '13800000007', '广东省佛山市后台管理中心', 1, 0);

-- =========================
-- 3. 商品分类
-- =========================

INSERT INTO category (id, name, sort_order, is_deleted)
VALUES
(1, '连衣裙', 1, 0),
(2, '外套', 2, 0),
(3, '上衣', 3, 0),
(4, '配饰', 4, 0);

-- =========================
-- 4. 商品主表：16 个商品
-- =========================

INSERT INTO product (id, category_id, name, status, is_deleted)
VALUES
(1, 1, '海风白色连衣裙', 'ON_SALE', 0),
(2, 1, '浅樱粉日常裙', 'ON_SALE', 0),
(3, 1, '云蓝学院风套装裙', 'ON_SALE', 0),
(4, 1, '星夜黑色长裙', 'ON_SALE', 0),

(5, 2, '银灰色披肩外套', 'ON_SALE', 0),
(6, 2, '海盐蓝短外套', 'ON_SALE', 0),
(7, 2, '奶油白针织开衫', 'ON_SALE', 0),
(8, 2, '月光薄纱防晒衫', 'ON_SALE', 0),

(9, 3, '蓝白水手领上衣', 'ON_SALE', 0),
(10, 3, '樱粉蝴蝶结衬衫', 'ON_SALE', 0),
(11, 3, '云朵泡泡袖上衣', 'ON_SALE', 0),
(12, 3, '浅灰百褶搭配上衣', 'ON_SALE', 0),

(13, 4, '海蓝丝带发带', 'ON_SALE', 0),
(14, 4, '红色精灵耳坠', 'ON_SALE', 0),
(15, 4, '星月胸针', 'ON_SALE', 0),
(16, 4, '云白小斜挎包', 'ON_SALE', 0);

-- =========================
-- 5. 商品 SKU：每个商品 2 个 SKU，共 32 个
-- =========================

INSERT INTO product_sku
(id, product_id, sku_name, price, status, is_deleted)
VALUES
(1, 1, '白色-M码', 199.00, 'ON_SALE', 0),
(2, 1, '白色-L码', 199.00, 'ON_SALE', 0),

(3, 2, '浅樱粉-M码', 179.00, 'ON_SALE', 0),
(4, 2, '浅樱粉-L码', 179.00, 'ON_SALE', 0),

(5, 3, '云蓝-M码', 229.00, 'ON_SALE', 0),
(6, 3, '云蓝-L码', 229.00, 'ON_SALE', 0),

(7, 4, '黑色-M码', 259.00, 'ON_SALE', 0),
(8, 4, '黑色-L码', 259.00, 'ON_SALE', 0),

(9, 5, '银灰色-均码', 129.00, 'ON_SALE', 0),
(10, 5, '银灰色-加厚款', 149.00, 'ON_SALE', 0),

(11, 6, '海盐蓝-均码', 149.00, 'ON_SALE', 0),
(12, 6, '海盐蓝-宽松款', 159.00, 'ON_SALE', 0),

(13, 7, '奶油白-均码', 119.00, 'ON_SALE', 0),
(14, 7, '奶油白-宽松款', 129.00, 'ON_SALE', 0),

(15, 8, '月光白-均码', 99.00, 'ON_SALE', 0),
(16, 8, '浅蓝色-均码', 99.00, 'ON_SALE', 0),

(17, 9, '蓝白-S码', 89.00, 'ON_SALE', 0),
(18, 9, '蓝白-M码', 89.00, 'ON_SALE', 0),

(19, 10, '樱粉-S码', 99.00, 'ON_SALE', 0),
(20, 10, '樱粉-M码', 99.00, 'ON_SALE', 0),

(21, 11, '云白-S码', 109.00, 'ON_SALE', 0),
(22, 11, '云白-M码', 109.00, 'ON_SALE', 0),

(23, 12, '浅灰-S码', 139.00, 'ON_SALE', 0),
(24, 12, '浅灰-M码', 139.00, 'ON_SALE', 0),

(25, 13, '海蓝-普通款', 39.00, 'ON_SALE', 0),
(26, 13, '海蓝-蝴蝶结款', 39.00, 'ON_SALE', 0),

(27, 14, '红色-普通款', 49.00, 'ON_SALE', 0),
(28, 14, '红色-长坠款', 59.00, 'ON_SALE', 0),

(29, 15, '星月-银色', 35.00, 'ON_SALE', 0),
(30, 15, '星月-金色', 35.00, 'ON_SALE', 0),

(31, 16, '云白-小号', 69.00, 'ON_SALE', 0),
(32, 16, '云白-中号', 79.00, 'ON_SALE', 0);

-- =========================
-- 6. 库存数据
-- sku_id = 3 和 21 留出锁定库存，用于模拟待支付订单
-- =========================

INSERT INTO inventory (sku_id, available_stock, locked_stock)
SELECT
  id AS sku_id,
  40 + (id % 8) * 5 AS available_stock,
  CASE
    WHEN id = 3 THEN 2
    WHEN id = 21 THEN 1
    ELSE 0
  END AS locked_stock
FROM product_sku;

-- =========================
-- 7. 销量统计数据
-- 先手动写入已有销量，后续可用触发器自动维护
-- =========================

INSERT INTO product_sales_stat
(sku_id, total_sold_count, total_sales_amount)
SELECT
  id AS sku_id,
  CASE id
    WHEN 1 THEN 1
    WHEN 5 THEN 1
    WHEN 7 THEN 1
    WHEN 9 THEN 1
    WHEN 17 THEN 1
    WHEN 26 THEN 1
    WHEN 29 THEN 2
    WHEN 31 THEN 2
    ELSE 0
  END AS total_sold_count,
  CASE id
    WHEN 1 THEN 199.00
    WHEN 5 THEN 229.00
    WHEN 7 THEN 259.00
    WHEN 9 THEN 129.00
    WHEN 17 THEN 89.00
    WHEN 26 THEN 39.00
    WHEN 29 THEN 70.00
    WHEN 31 THEN 138.00
    ELSE 0.00
  END AS total_sales_amount
FROM product_sku;

-- =========================
-- 8. 购物车
-- =========================

INSERT INTO cart (id, user_id, status)
VALUES
(1, 1, 'ACTIVE'),
(2, 2, 'ACTIVE'),
(3, 3, 'ACTIVE'),
(4, 4, 'ACTIVE'),
(5, 5, 'ACTIVE');

-- =========================
-- 9. 购物车明细
-- =========================

INSERT INTO cart_item
(id, cart_id, sku_id, quantity)
VALUES
(1, 1, 1, 1),
(2, 1, 26, 2),
(3, 2, 3, 1),
(4, 2, 21, 1),
(5, 3, 9, 1),
(6, 3, 17, 2),
(7, 4, 31, 1),
(8, 4, 29, 1),
(9, 5, 7, 1),
(10, 5, 13, 1);

-- =========================
-- 10. 订单主表
-- =========================

INSERT INTO order_main
(id, order_no, user_id, address_id, status, total_amount)
VALUES
(1, 'ORD202607060001', 1, 1, 'PAID', 238.00),
(2, 'ORD202607060002', 2, 3, 'PENDING_PAYMENT', 358.00),
(3, 'ORD202607060003', 3, 4, 'PAID', 218.00),
(4, 'ORD202607060004', 4, 5, 'CANCELLED', 159.00),
(5, 'ORD202607060005', 1, 2, 'PAID', 138.00),
(6, 'ORD202607060006', 5, 6, 'PAID', 329.00),
(7, 'ORD202607060007', 2, 3, 'PENDING_PAYMENT', 109.00),
(8, 'ORD202607060008', 6, 7, 'PAID', 229.00);

-- =========================
-- 11. 订单明细
-- =========================

INSERT INTO order_item
(id, order_id, sku_id, quantity, price)
VALUES
(1, 1, 1, 1, 199.00),
(2, 1, 26, 1, 39.00),

(3, 2, 3, 2, 179.00),

(4, 3, 9, 1, 129.00),
(5, 3, 17, 1, 89.00),

(6, 4, 12, 1, 159.00),

(7, 5, 31, 2, 69.00),

(8, 6, 7, 1, 259.00),
(9, 6, 29, 2, 35.00),

(10, 7, 21, 1, 109.00),

(11, 8, 5, 1, 229.00);

-- =========================
-- 12. 支付记录
-- =========================

INSERT INTO payment_record
(id, order_id, pay_method, pay_status, pay_amount)
VALUES
(1, 1, 'ALIPAY', 'SUCCESS', 238.00),
(2, 2, 'WECHAT', 'FAILED', 358.00),
(3, 3, 'WECHAT', 'SUCCESS', 218.00),
(4, 4, 'ALIPAY', 'CANCELLED', 0.00),
(5, 5, 'ALIPAY', 'SUCCESS', 138.00),
(6, 6, 'WECHAT', 'SUCCESS', 329.00),
(7, 7, 'ALIPAY', 'FAILED', 109.00),
(8, 8, 'WECHAT', 'SUCCESS', 229.00);

-- =========================
-- 13. 订单状态日志
-- =========================

-- 03 已创建订单插入触发器；上面的固定订单会先自动生成一条当前状态日志。
-- 本测试脚本需要写入完整的演示状态历史，因此先移除这些触发器临时日志。
DELETE FROM order_status_log;
ALTER TABLE order_status_log AUTO_INCREMENT = 1;

INSERT INTO order_status_log
(id, order_id, from_status, to_status, remark)
VALUES
(1, 1, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(2, 1, 'PENDING_PAYMENT', 'PAID', '用户支付成功'),

(3, 2, NULL, 'PENDING_PAYMENT', '用户创建订单'),

(4, 3, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(5, 3, 'PENDING_PAYMENT', 'PAID', '用户支付成功'),

(6, 4, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(7, 4, 'PENDING_PAYMENT', 'CANCELLED', '用户取消订单'),

(8, 5, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(9, 5, 'PENDING_PAYMENT', 'PAID', '用户支付成功'),

(10, 6, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(11, 6, 'PENDING_PAYMENT', 'PAID', '用户支付成功'),

(12, 7, NULL, 'PENDING_PAYMENT', '用户创建订单'),

(13, 8, NULL, 'PENDING_PAYMENT', '用户创建订单'),
(14, 8, 'PENDING_PAYMENT', 'PAID', '用户支付成功');

-- =========================
-- 14. 库存流水
-- =========================

INSERT INTO inventory_log
(id, sku_id, change_type, change_qty, ref_no)
VALUES
(1, 1, 'LOCK_STOCK', -1, 'ORD202607060001'),
(2, 1, 'CONFIRM_SALE', -1, 'ORD202607060001'),
(3, 26, 'LOCK_STOCK', -1, 'ORD202607060001'),
(4, 26, 'CONFIRM_SALE', -1, 'ORD202607060001'),

(5, 3, 'LOCK_STOCK', -2, 'ORD202607060002'),

(6, 9, 'LOCK_STOCK', -1, 'ORD202607060003'),
(7, 9, 'CONFIRM_SALE', -1, 'ORD202607060003'),
(8, 17, 'LOCK_STOCK', -1, 'ORD202607060003'),
(9, 17, 'CONFIRM_SALE', -1, 'ORD202607060003'),

(10, 12, 'LOCK_STOCK', -1, 'ORD202607060004'),
(11, 12, 'RELEASE_STOCK', 1, 'ORD202607060004'),

(12, 31, 'LOCK_STOCK', -2, 'ORD202607060005'),
(13, 31, 'CONFIRM_SALE', -2, 'ORD202607060005'),

(14, 7, 'LOCK_STOCK', -1, 'ORD202607060006'),
(15, 7, 'CONFIRM_SALE', -1, 'ORD202607060006'),
(16, 29, 'LOCK_STOCK', -2, 'ORD202607060006'),
(17, 29, 'CONFIRM_SALE', -2, 'ORD202607060006'),

(18, 21, 'LOCK_STOCK', -1, 'ORD202607060007'),

(19, 5, 'LOCK_STOCK', -1, 'ORD202607060008'),
(20, 5, 'CONFIRM_SALE', -1, 'ORD202607060008');

-- =========================
-- 15. 操作日志
-- =========================

INSERT INTO operation_log
(id, operator_id, action_type, remark)
VALUES
(1, 7, 'CREATE_CATEGORY', '初始化商品分类'),
(2, 7, 'CREATE_PRODUCT', '初始化 16 个测试商品'),
(3, 7, 'INIT_INVENTORY', '初始化 SKU 库存数据'),
(4, 8, 'ADJUST_STOCK', '检查库存快照和库存流水'),
(5, 8, 'CHECK_ORDER', '检查测试订单数据'),
(6, 7, 'INIT_STAT', '初始化销量统计表');

-- =========================
-- 16. 简单验证
-- =========================

SELECT COUNT(*) AS user_count FROM `user`;
SELECT COUNT(*) AS category_count FROM category;
SELECT COUNT(*) AS product_count FROM product;
SELECT COUNT(*) AS sku_count FROM product_sku;
SELECT COUNT(*) AS inventory_count FROM inventory;
SELECT COUNT(*) AS order_count FROM order_main;
SELECT COUNT(*) AS order_item_count FROM order_item;



SELECT
    p.id AS product_id,
    p.name AS product_name,
    c.name AS category_name,
    s.id AS sku_id,
    s.sku_name,
    s.price,
    s.status AS sku_status,
    i.available_stock,
    i.locked_stock
FROM product p
JOIN category c ON p.category_id = c.id
JOIN product_sku s ON p.id = s.product_id
JOIN inventory i ON s.id = i.sku_id
WHERE p.id = 1;


-- 2. 分类商品查询：查询某个分类下所有上架商品
SELECT
    c.name AS category_name,
    p.id AS product_id,
    p.name AS product_name,
    p.status,
    p.is_deleted
FROM category c
JOIN product p ON c.id = p.category_id
WHERE c.id = 1
  AND p.status = 'ON_SALE'
  AND p.is_deleted = 0
ORDER BY p.id;

SELECT
    u.id AS user_id,
    u.email,
    c.id AS cart_id,
    p.name AS product_name,
    s.sku_name,
    s.price,
    ci.quantity,
    s.price * ci.quantity AS item_amount
FROM `user` u
JOIN cart c ON u.id = c.user_id
JOIN cart_item ci ON c.id = ci.cart_id
JOIN product_sku s ON ci.sku_id = s.id
JOIN product p ON s.product_id = p.id
WHERE u.id = 1
ORDER BY ci.id;

SELECT
    u.id AS user_id,
    u.email,
    o.id AS order_id,
    o.order_no,
    o.status,
    o.total_amount,
    o.created_at
FROM `user` u
JOIN order_main o ON u.id = o.user_id
WHERE u.id = 1
ORDER BY o.created_at DESC;


SELECT
    o.order_no,
    o.status AS order_status,
    o.total_amount,
    p.name AS product_name,
    s.sku_name,
    oi.quantity,
    oi.price,
    oi.quantity * oi.price AS item_amount
FROM order_main o
JOIN order_item oi ON o.id = oi.order_id
JOIN product_sku s ON oi.sku_id = s.id
JOIN product p ON s.product_id = p.id
WHERE o.id = 1;


SELECT
    o.order_no,
    o.status AS order_status,
    pr.pay_method,
    pr.pay_status,
    pr.pay_amount,
    pr.created_at
FROM order_main o
JOIN payment_record pr ON o.id = pr.order_id
WHERE o.id = 1;


-- 7. 订单状态日志查询：查看订单状态变化过程
SELECT
    o.order_no,
    osl.from_status,
    osl.to_status,
    osl.remark,
    osl.created_at
FROM order_main o
JOIN order_status_log osl ON o.id = osl.order_id
WHERE o.id = 1
ORDER BY osl.created_at;


SELECT
    p.name AS product_name,
    s.id AS sku_id,
    s.sku_name,
    i.available_stock,
    i.locked_stock
FROM product_sku s
JOIN product p ON s.product_id = p.id
JOIN inventory i ON s.id = i.sku_id
WHERE s.id IN (1, 3, 21)
ORDER BY s.id;


SELECT
    s.id AS sku_id,
    s.sku_name,
    il.change_type,
    il.change_qty,
    il.ref_no,
    il.created_at
FROM inventory_log il
JOIN product_sku s ON il.sku_id = s.id
WHERE il.sku_id = 1
ORDER BY il.created_at;


SELECT
    p.name AS product_name,
    s.sku_name,
    stat.total_sold_count,
    stat.total_sales_amount
FROM product_sales_stat stat
JOIN product_sku s ON stat.sku_id = s.id
JOIN product p ON s.product_id = p.id
ORDER BY stat.total_sold_count DESC, stat.total_sales_amount DESC
LIMIT 10;

SELECT
    COUNT(*) AS paid_order_count,
    SUM(total_amount) AS total_paid_amount
FROM order_main
WHERE status = 'PAID';

SELECT
    o.order_no,
    o.status,
    p.name AS product_name,
    s.sku_name,
    oi.quantity,
    i.available_stock,
    i.locked_stock
FROM order_main o
JOIN order_item oi ON o.id = oi.order_id
JOIN product_sku s ON oi.sku_id = s.id
JOIN product p ON s.product_id = p.id
JOIN inventory i ON s.id = i.sku_id
WHERE o.status = 'PENDING_PAYMENT';


SELECT
    cart_id,
    sku_id,
    COUNT(*) AS repeat_count
FROM cart_item
GROUP BY cart_id, sku_id
HAVING COUNT(*) > 1;


SELECT
    s.id AS sku_id,
    s.sku_name
FROM product_sku s
LEFT JOIN inventory i ON s.id = i.sku_id
WHERE i.sku_id IS NULL;


SELECT
    o.id AS order_id,
    o.order_no,
    o.total_amount AS order_total_amount,
    SUM(oi.quantity * oi.price) AS item_total_amount,
    o.total_amount - SUM(oi.quantity * oi.price) AS diff_amount
FROM order_main o
JOIN order_item oi ON o.id = oi.order_id
GROUP BY o.id, o.order_no, o.total_amount
HAVING diff_amount <> 0;

-- ============================================================
-- 完整业务流程测试
-- 来源：06_business_flow_test.sql
-- ============================================================

USE frieren_cloth_shop_db;

-- =========================================================
-- 05_business_flow_test.sql
-- 作用：测试完整业务流程，适合截图放入课程设计报告
-- 执行前提：已执行 01、02、03、04 号 SQL 文件
-- =========================================================

-- =========================================================
-- 一、查看视图是否可用
-- =========================================================
SELECT * FROM v_product_detail ORDER BY product_id, sku_id LIMIT 10;
SELECT * FROM v_product_sales_rank ORDER BY sales_rank LIMIT 10;
SELECT * FROM v_inventory_status ORDER BY sku_id LIMIT 10;

-- =========================================================
-- 二、购物车下单流程：加入购物车 → 创建订单 → 支付订单
-- 使用用户 1，地址 1
-- =========================================================

-- 1. 加入购物车：给用户 1 增加一个 SKU 25
CALL sp_add_to_cart(1, 25, 1);

-- 截图点 1：查看用户 1 的购物车
SELECT *
FROM v_user_cart_detail
WHERE user_id = 1
ORDER BY cart_item_id;

-- 2. 从购物车创建订单
CALL sp_create_order_from_cart(1, 1, @cart_order_id, @cart_order_no);

-- 截图点 2：查看刚刚创建的订单编号
SELECT @cart_order_id AS cart_order_id, @cart_order_no AS cart_order_no;

-- 截图点 3：订单已创建，状态应为 PENDING_PAYMENT
SELECT *
FROM v_order_summary
WHERE order_id = @cart_order_id;

-- 截图点 4：订单明细已生成
SELECT *
FROM v_user_order_detail
WHERE order_id = @cart_order_id
ORDER BY order_item_id;

-- 截图点 5：购物车应已清空
SELECT
    '用户 1 购物车剩余明细数' AS check_item,
    COUNT(*) AS result_count
FROM v_user_cart_detail
WHERE user_id = 1;

-- 截图点 6：库存已锁定，库存流水已记录
SELECT *
FROM inventory_log
WHERE ref_no = @cart_order_no
ORDER BY id;

-- 3. 支付订单
CALL sp_pay_order(@cart_order_id, 'ALIPAY');

-- 截图点 7：订单状态应变为 PAID，支付记录应生成
SELECT *
FROM v_order_summary
WHERE order_id = @cart_order_id;

SELECT *
FROM payment_record
WHERE order_id = @cart_order_id;

-- 截图点 8：订单状态日志、库存流水、销量统计自动变化
SELECT *
FROM order_status_log
WHERE order_id = @cart_order_id
ORDER BY id;

SELECT *
FROM inventory_log
WHERE ref_no = @cart_order_no
ORDER BY id;

SELECT *
FROM v_product_sales_rank
WHERE sku_id IN (
    SELECT sku_id FROM order_item WHERE order_id = @cart_order_id
)
ORDER BY sku_id;

-- =========================================================
-- 三、直接下单流程：立即购买 → 取消订单
-- 使用用户 2，地址 3，SKU 27
-- =========================================================

-- 1. 直接下单，不经过购物车
CALL sp_create_direct_order(2, 3, 27, 1, @direct_order_id, @direct_order_no);

-- 截图点 9：直接下单成功，状态为 PENDING_PAYMENT
SELECT @direct_order_id AS direct_order_id, @direct_order_no AS direct_order_no;

SELECT *
FROM v_user_order_detail
WHERE order_id = @direct_order_id;

SELECT *
FROM inventory_log
WHERE ref_no = @direct_order_no
ORDER BY id;

-- 2. 取消直接下单订单
CALL sp_cancel_order(@direct_order_id, '测试业务流程：用户取消直接购买订单');

-- 截图点 10：订单状态应变为 CANCELLED，库存释放
SELECT *
FROM v_order_summary
WHERE order_id = @direct_order_id;

SELECT *
FROM order_status_log
WHERE order_id = @direct_order_id
ORDER BY id;

SELECT *
FROM inventory_log
WHERE ref_no = @direct_order_no
ORDER BY id;

SELECT *
FROM v_inventory_status
WHERE sku_id = 27;

-- =========================================================
-- 四、异常测试：库存不足时应报错
-- 注意：这条语句会故意报错，用来证明触发器 / 存储过程有业务约束
-- 如果不想中断执行，可以单独复制到查询控制台运行并截图
-- =========================================================
-- CALL sp_create_direct_order(2, 3, 27, 99999, @bad_order_id, @bad_order_no);

-- =========================================================
-- 五、最终一致性检查
-- =========================================================

-- 1. 订单主表金额 = 订单明细金额，应该查不出异常数据
SELECT
    o.id AS order_id,
    o.order_no,
    o.total_amount AS order_total_amount,
    SUM(oi.quantity * oi.price) AS item_total_amount,
    o.total_amount - SUM(oi.quantity * oi.price) AS diff_amount
FROM order_main o
JOIN order_item oi ON o.id = oi.order_id
GROUP BY o.id, o.order_no, o.total_amount
HAVING diff_amount <> 0;

-- 2. SKU 是否都有库存记录，应该查不出异常数据
SELECT
    s.id AS sku_id,
    s.sku_name
FROM product_sku s
LEFT JOIN inventory i ON s.id = i.sku_id
WHERE i.sku_id IS NULL;

-- 3. 库存是否出现负数，应该查不出异常数据
SELECT *
FROM inventory
WHERE available_stock < 0 OR locked_stock < 0;

-- 4. 展示最终订单数量、支付成功订单数量和总销售额
SELECT
    COUNT(*) AS order_count,
    SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_order_count,
    SUM(CASE WHEN status = 'PAID' THEN total_amount ELSE 0 END) AS paid_total_amount
FROM order_main;

-- ============================================================
-- 索引 EXPLAIN 验证
-- 来源：03_explain.sql
-- ============================================================

EXPLAIN
SELECT * FROM product WHERE category_id = 1;


EXPLAIN
SELECT *
FROM `user`
WHERE email = 'test_user@example.com';


EXPLAIN
SELECT *
FROM product
WHERE category_id = 1
  AND status = 'ON_SALE'
  AND is_deleted = 0;

-- ============================================================
-- 基础表结构 SHOW CREATE 验证
-- 来源：01_create_table.sql（check 部分）
-- ============================================================

### check
SHOW CREATE TABLE `user`;
SHOW CREATE TABLE product_sku;
SHOW CREATE TABLE cart_item;
SHOW CREATE TABLE order_main;
SHOW CREATE TABLE inventory;
# success!!!
