-- ============================================================
-- 阶段 9：订单买家备注增量迁移
-- 前置条件：已按顺序执行 01-06，当前数据库为 frieren_cloth_shop_db。
-- 影响对象：order_main.buyer_remark、v_order_summary、
--           v_user_order_detail、sp_create_direct_order_with_remark。
-- 重复执行：字段已存在时跳过；视图使用 OR REPLACE；新过程先删后建。
-- 恢复说明：本迁移不改写已有订单；旧 sp_create_direct_order 保持不变。
-- ============================================================

USE frieren_cloth_shop_db;

SET @buyer_remark_column_exists := (
    SELECT COUNT(*)
    FROM information_schema.columns
    WHERE table_schema = 'frieren_cloth_shop_db'
      AND table_name = 'order_main'
      AND column_name = 'buyer_remark'
);

SET @add_buyer_remark_sql := IF(
    @buyer_remark_column_exists = 0,
    'ALTER TABLE order_main ADD COLUMN buyer_remark VARCHAR(500) NULL COMMENT ''订单级买家备注（普通文本）'' AFTER total_amount',
    'SELECT ''order_main.buyer_remark already exists'' AS migration_status'
);

PREPARE add_buyer_remark_stmt FROM @add_buyer_remark_sql;
EXECUTE add_buyer_remark_stmt;
DEALLOCATE PREPARE add_buyer_remark_stmt;

CREATE OR REPLACE VIEW v_order_summary AS
SELECT
    o.id AS order_id,
    o.order_no,
    o.user_id,
    u.email,
    o.status,
    o.total_amount,
    o.buyer_remark AS buyer_remark,
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
    o.status, o.total_amount, o.buyer_remark, o.created_at, o.updated_at;

CREATE OR REPLACE VIEW v_user_order_detail AS
SELECT
    u.id AS user_id,
    u.email,
    o.id AS order_id,
    o.order_no,
    o.status AS order_status,
    o.total_amount,
    o.buyer_remark AS buyer_remark,
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

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_create_direct_order_with_remark $$

CREATE PROCEDURE sp_create_direct_order_with_remark(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT,
    IN p_sku_id BIGINT,
    IN p_quantity INT,
    IN p_buyer_remark VARCHAR(500),
    OUT p_order_id BIGINT,
    OUT p_order_no VARCHAR(40)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_available_stock INT DEFAULT 0;
    DECLARE v_price DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_order_no VARCHAR(40);
    DECLARE v_buyer_remark VARCHAR(500);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购买数量必须大于 0';
    END IF;

    SET v_buyer_remark = NULLIF(
        REGEXP_REPLACE(COALESCE(p_buyer_remark, ''), '^[[:space:]]+|[[:space:]]+$', ''),
        ''
    );

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id AND is_deleted = 0;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '用户不存在或已删除';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM user_address
    WHERE id = p_address_id
      AND user_id = p_user_id
      AND is_deleted = 0;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '收货地址不存在或不属于当前用户';
    END IF;

    SELECT COUNT(*), COALESCE(MAX(s.price), 0.00) INTO v_count, v_price
    FROM product_sku s
    JOIN product p ON s.product_id = p.id
    WHERE s.id = p_sku_id
      AND s.status = 'ON_SALE'
      AND s.is_deleted = 0
      AND p.status = 'ON_SALE'
      AND p.is_deleted = 0;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SKU 不存在、已删除或未上架';
    END IF;

    SELECT available_stock INTO v_available_stock
    FROM inventory
    WHERE sku_id = p_sku_id;
    IF v_available_stock < p_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '库存不足，不能直接下单';
    END IF;

    SET v_total_amount = v_price * p_quantity;
    SET v_order_no = CONCAT(
        'ORD',
        DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s'),
        LPAD(p_user_id, 4, '0'),
        LPAD(FLOOR(RAND() * 1000), 3, '0')
    );

    INSERT INTO order_main(
        order_no,
        user_id,
        address_id,
        status,
        total_amount,
        buyer_remark
    )
    VALUES(
        v_order_no,
        p_user_id,
        p_address_id,
        'PENDING_PAYMENT',
        v_total_amount,
        v_buyer_remark
    );

    SET p_order_id = LAST_INSERT_ID();
    SET p_order_no = v_order_no;

    INSERT INTO order_item(order_id, sku_id, quantity, price)
    VALUES(p_order_id, p_sku_id, p_quantity, v_price);

    UPDATE inventory
    SET available_stock = available_stock - p_quantity,
        locked_stock = locked_stock + p_quantity
    WHERE sku_id = p_sku_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    VALUES(p_sku_id, 'LOCK_STOCK', -p_quantity, v_order_no);

    COMMIT;
END $$

DELIMITER ;

SHOW COLUMNS FROM order_main LIKE 'buyer_remark';
SHOW CREATE VIEW v_order_summary;
SHOW CREATE VIEW v_user_order_detail;
SHOW CREATE PROCEDURE sp_create_direct_order;
SHOW CREATE PROCEDURE sp_create_direct_order_with_remark;
