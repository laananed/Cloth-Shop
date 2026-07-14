-- 存储过程、触发器与函数（整理合并版）
-- 06_add_refund_order.sql 未重复追加：其中 sp_refund_paid_order 已完整包含在 05_create_procedure_trigger.sql 末尾。
-- 编码：UTF-8

-- ============================================================
-- 业务存储过程与触发器
-- 来源：05_create_procedure_trigger.sql
-- ============================================================

USE frieren_cloth_shop_db;

-- =========================================================
-- 04_create_procedure_trigger.sql
-- 作用：创建购物车、下单、支付、取消订单相关存储过程和触发器
-- 执行前提：已执行 01_create_table.sql、02_test_table.sql、03_create_view.sql
-- =========================================================

DELIMITER $$

-- =========================================================
-- 一、先删除旧对象，方便重复执行
-- =========================================================
DROP PROCEDURE IF EXISTS sp_add_to_cart $$
DROP PROCEDURE IF EXISTS sp_create_order_from_cart $$
DROP PROCEDURE IF EXISTS sp_create_direct_order $$
DROP PROCEDURE IF EXISTS sp_pay_order $$
DROP PROCEDURE IF EXISTS sp_cancel_order $$

DROP TRIGGER IF EXISTS trg_order_main_after_insert $$
DROP TRIGGER IF EXISTS trg_order_main_after_update $$
DROP TRIGGER IF EXISTS trg_inventory_before_update $$

-- =========================================================
-- 二、触发器
-- =========================================================

-- 1. 订单创建后自动写入订单状态日志
CREATE TRIGGER trg_order_main_after_insert
AFTER INSERT ON order_main
FOR EACH ROW
BEGIN
    INSERT INTO order_status_log(order_id, from_status, to_status, remark)
    VALUES(NEW.id, NULL, NEW.status, '触发器：创建订单');
END $$

-- 2. 订单状态变化后自动写入状态日志；订单变为 PAID 时自动更新销量统计
CREATE TRIGGER trg_order_main_after_update
AFTER UPDATE ON order_main
FOR EACH ROW
BEGIN
    IF OLD.status <> NEW.status THEN
        INSERT INTO order_status_log(order_id, from_status, to_status, remark)
        VALUES(NEW.id, OLD.status, NEW.status, '触发器：订单状态变更');
    END IF;

    IF OLD.status <> 'PAID' AND NEW.status = 'PAID' THEN
        INSERT INTO product_sales_stat(sku_id, total_sold_count, total_sales_amount)
        SELECT
            oi.sku_id,
            SUM(oi.quantity) AS total_sold_count,
            SUM(oi.quantity * oi.price) AS total_sales_amount
        FROM order_item oi
        WHERE oi.order_id = NEW.id
        GROUP BY oi.sku_id
        ON DUPLICATE KEY UPDATE
            total_sold_count = total_sold_count + VALUES(total_sold_count),
            total_sales_amount = total_sales_amount + VALUES(total_sales_amount);
    END IF;
END $$

-- 3. 库存更新前检查：防止可用库存或锁定库存被更新成负数
CREATE TRIGGER trg_inventory_before_update
BEFORE UPDATE ON inventory
FOR EACH ROW
BEGIN
    IF NEW.available_stock < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '可用库存不能小于 0';
    END IF;

    IF NEW.locked_stock < 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '锁定库存不能小于 0';
    END IF;
END $$

-- =========================================================
-- 三、存储过程
-- =========================================================

-- 1. 加入购物车：如果用户没有购物车则自动创建；如果同一 SKU 已存在则增加数量
CREATE PROCEDURE sp_add_to_cart(
    IN p_user_id BIGINT,
    IN p_sku_id BIGINT,
    IN p_quantity INT
)
BEGIN
    DECLARE v_cart_id BIGINT;
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_available_stock INT DEFAULT 0;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '加入购物车数量必须大于 0';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id AND is_deleted = 0;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '用户不存在或已删除';
    END IF;

    SELECT COUNT(*) INTO v_count
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
            SET MESSAGE_TEXT = '库存不足，不能加入购物车';
    END IF;

    INSERT INTO cart(user_id, status)
    VALUES(p_user_id, 'ACTIVE')
    ON DUPLICATE KEY UPDATE status = 'ACTIVE';

    SELECT id INTO v_cart_id
    FROM cart
    WHERE user_id = p_user_id;

    INSERT INTO cart_item(cart_id, sku_id, quantity)
    VALUES(v_cart_id, p_sku_id, p_quantity)
    ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity);
END $$

-- 2. 从购物车创建订单：锁定库存、生成订单明细、清空购物车
CREATE PROCEDURE sp_create_order_from_cart(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT,
    OUT p_order_id BIGINT,
    OUT p_order_no VARCHAR(40)
)
BEGIN
    DECLARE v_cart_id BIGINT;
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_invalid_count INT DEFAULT 0;
    DECLARE v_shortage_count INT DEFAULT 0;
    DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_order_no VARCHAR(40);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

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

    SELECT COUNT(*) INTO v_count
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE';
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '当前用户没有可用购物车';
    END IF;

    SELECT id INTO v_cart_id
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE'
    LIMIT 1;

    SELECT COUNT(*) INTO v_count
    FROM cart_item
    WHERE cart_id = v_cart_id;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车为空，不能创建订单';
    END IF;

    SELECT COUNT(*) INTO v_invalid_count
    FROM cart_item ci
    LEFT JOIN product_sku s ON ci.sku_id = s.id
    LEFT JOIN product p ON s.product_id = p.id
    WHERE ci.cart_id = v_cart_id
      AND (
          s.id IS NULL
          OR s.status <> 'ON_SALE'
          OR s.is_deleted = 1
          OR p.status <> 'ON_SALE'
          OR p.is_deleted = 1
      );
    IF v_invalid_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车中存在未上架或无效商品';
    END IF;

    SELECT COUNT(*) INTO v_shortage_count
    FROM cart_item ci
    JOIN inventory i ON ci.sku_id = i.sku_id
    WHERE ci.cart_id = v_cart_id
      AND i.available_stock < ci.quantity;
    IF v_shortage_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车中存在库存不足商品';
    END IF;

    SELECT SUM(ci.quantity * s.price) INTO v_total_amount
    FROM cart_item ci
    JOIN product_sku s ON ci.sku_id = s.id
    WHERE ci.cart_id = v_cart_id;

    SET v_order_no = CONCAT('ORD', DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s'), LPAD(p_user_id, 4, '0'), LPAD(FLOOR(RAND() * 1000), 3, '0'));

    INSERT INTO order_main(order_no, user_id, address_id, status, total_amount)
    VALUES(v_order_no, p_user_id, p_address_id, 'PENDING_PAYMENT', v_total_amount);

    SET p_order_id = LAST_INSERT_ID();
    SET p_order_no = v_order_no;

    INSERT INTO order_item(order_id, sku_id, quantity, price)
    SELECT p_order_id, ci.sku_id, ci.quantity, s.price
    FROM cart_item ci
    JOIN product_sku s ON ci.sku_id = s.id
    WHERE ci.cart_id = v_cart_id;

    UPDATE inventory i
    JOIN cart_item ci ON i.sku_id = ci.sku_id
    SET i.available_stock = i.available_stock - ci.quantity,
        i.locked_stock = i.locked_stock + ci.quantity
    WHERE ci.cart_id = v_cart_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    SELECT ci.sku_id, 'LOCK_STOCK', -ci.quantity, v_order_no
    FROM cart_item ci
    WHERE ci.cart_id = v_cart_id;

    DELETE FROM cart_item
    WHERE cart_id = v_cart_id;

    COMMIT;
END $$

-- 3. 直接购买创建订单：不经过购物车，适合“立即购买”业务
CREATE PROCEDURE sp_create_direct_order(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT,
    IN p_sku_id BIGINT,
    IN p_quantity INT,
    OUT p_order_id BIGINT,
    OUT p_order_no VARCHAR(40)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_available_stock INT DEFAULT 0;
    DECLARE v_price DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_order_no VARCHAR(40);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购买数量必须大于 0';
    END IF;

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
    SET v_order_no = CONCAT('ORD', DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s'), LPAD(p_user_id, 4, '0'), LPAD(FLOOR(RAND() * 1000), 3, '0'));

    INSERT INTO order_main(order_no, user_id, address_id, status, total_amount)
    VALUES(v_order_no, p_user_id, p_address_id, 'PENDING_PAYMENT', v_total_amount);

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

-- 4. 支付订单：订单由待支付变为已支付，释放锁定库存并更新销量统计
CREATE PROCEDURE sp_pay_order(
    IN p_order_id BIGINT,
    IN p_pay_method VARCHAR(32)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_shortage_count INT DEFAULT 0;
    DECLARE v_status VARCHAR(30);
    DECLARE v_order_no VARCHAR(40);
    DECLARE v_total_amount DECIMAL(12,2);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
    FROM order_main
    WHERE id = p_order_id;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '订单不存在';
    END IF;

    SELECT status, order_no, total_amount INTO v_status, v_order_no, v_total_amount
    FROM order_main
    WHERE id = p_order_id;

    IF v_status <> 'PENDING_PAYMENT' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '只有待支付订单才能支付';
    END IF;

    SELECT COUNT(*) INTO v_shortage_count
    FROM order_item oi
    JOIN inventory i ON oi.sku_id = i.sku_id
    WHERE oi.order_id = p_order_id
      AND i.locked_stock < oi.quantity;
    IF v_shortage_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '锁定库存不足，不能支付';
    END IF;

    INSERT INTO payment_record(order_id, pay_method, pay_status, pay_amount)
    VALUES(p_order_id, p_pay_method, 'SUCCESS', v_total_amount);

    UPDATE inventory i
    JOIN order_item oi ON i.sku_id = oi.sku_id
    SET i.locked_stock = i.locked_stock - oi.quantity
    WHERE oi.order_id = p_order_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    SELECT oi.sku_id, 'CONFIRM_SALE', -oi.quantity, v_order_no
    FROM order_item oi
    WHERE oi.order_id = p_order_id;

    UPDATE order_main
    SET status = 'PAID'
    WHERE id = p_order_id;

    COMMIT;
END $$

-- 5. 取消订单：仅待支付订单可取消；取消后释放锁定库存
CREATE PROCEDURE sp_cancel_order(
    IN p_order_id BIGINT,
    IN p_remark VARCHAR(255)
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_shortage_count INT DEFAULT 0;
    DECLARE v_status VARCHAR(30);
    DECLARE v_order_no VARCHAR(40);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
    FROM order_main
    WHERE id = p_order_id;
    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '订单不存在';
    END IF;

    SELECT status, order_no INTO v_status, v_order_no
    FROM order_main
    WHERE id = p_order_id;

    IF v_status <> 'PENDING_PAYMENT' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '只有待支付订单才能取消';
    END IF;

    SELECT COUNT(*) INTO v_shortage_count
    FROM order_item oi
    JOIN inventory i ON oi.sku_id = i.sku_id
    WHERE oi.order_id = p_order_id
      AND i.locked_stock < oi.quantity;
    IF v_shortage_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '锁定库存不足，不能取消';
    END IF;

    UPDATE inventory i
    JOIN order_item oi ON i.sku_id = oi.sku_id
    SET i.available_stock = i.available_stock + oi.quantity,
        i.locked_stock = i.locked_stock - oi.quantity
    WHERE oi.order_id = p_order_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    SELECT oi.sku_id, 'RELEASE_STOCK', oi.quantity, v_order_no
    FROM order_item oi
    WHERE oi.order_id = p_order_id;

    UPDATE order_main
    SET status = 'CANCELLED'
    WHERE id = p_order_id;


    COMMIT;
END $$

DELIMITER ;

-- =========================
-- 创建后验证
-- =========================
SHOW PROCEDURE STATUS WHERE Db = DATABASE() AND Name IN (
    'sp_add_to_cart',
    'sp_create_order_from_cart',
    'sp_create_direct_order',
    'sp_pay_order',
    'sp_cancel_order'
);

SHOW TRIGGERS WHERE `Table` IN ('order_main', 'inventory');




# 从购物车选择商品提交

USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_create_order_from_selected_cart_items $$

CREATE PROCEDURE sp_create_order_from_selected_cart_items(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT,
    IN p_cart_item_ids_json JSON,
    OUT p_order_id BIGINT,
    OUT p_order_no VARCHAR(40)
)
BEGIN
    DECLARE v_cart_id BIGINT;
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_invalid_count INT DEFAULT 0;
    DECLARE v_shortage_count INT DEFAULT 0;
    DECLARE v_total_amount DECIMAL(12,2) DEFAULT 0.00;
    DECLARE v_order_no VARCHAR(40);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    DROP TEMPORARY TABLE IF EXISTS tmp_selected_cart_item;
    CREATE TEMPORARY TABLE tmp_selected_cart_item (
        cart_item_id BIGINT PRIMARY KEY
    );

    INSERT IGNORE INTO tmp_selected_cart_item(cart_item_id)
    SELECT selected_item.cart_item_id
    FROM JSON_TABLE(
        p_cart_item_ids_json,
        '$[*]' COLUMNS (
            cart_item_id BIGINT PATH '$'
        )
    ) AS selected_item
    WHERE selected_item.cart_item_id IS NOT NULL;

    SELECT COUNT(*) INTO v_count
    FROM tmp_selected_cart_item;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '请先选择要结算的购物车商品';
    END IF;

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

    SELECT COUNT(*) INTO v_count
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE';

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '当前用户没有可用购物车';
    END IF;

    SELECT id INTO v_cart_id
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE'
    LIMIT 1;

    SELECT COUNT(*) INTO v_invalid_count
    FROM tmp_selected_cart_item t
    LEFT JOIN cart_item ci ON t.cart_item_id = ci.id AND ci.cart_id = v_cart_id
    WHERE ci.id IS NULL;

    IF v_invalid_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '存在不属于当前用户购物车的商品';
    END IF;

    SELECT COUNT(*) INTO v_invalid_count
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    LEFT JOIN product_sku s ON ci.sku_id = s.id
    LEFT JOIN product p ON s.product_id = p.id
    WHERE ci.cart_id = v_cart_id
      AND (
          s.id IS NULL
          OR s.status <> 'ON_SALE'
          OR s.is_deleted = 1
          OR p.status <> 'ON_SALE'
          OR p.is_deleted = 1
      );

    IF v_invalid_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '选中商品中存在未上架或无效商品';
    END IF;

    SELECT COUNT(*) INTO v_shortage_count
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    JOIN inventory i ON ci.sku_id = i.sku_id
    WHERE ci.cart_id = v_cart_id
      AND i.available_stock < ci.quantity;

    IF v_shortage_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '选中商品中存在库存不足商品';
    END IF;

    SELECT SUM(ci.quantity * s.price) INTO v_total_amount
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    JOIN product_sku s ON ci.sku_id = s.id
    WHERE ci.cart_id = v_cart_id;

    SET v_order_no = CONCAT(
        'ORD',
        DATE_FORMAT(NOW(6), '%Y%m%d%H%i%s'),
        LPAD(p_user_id, 4, '0'),
        LPAD(FLOOR(RAND() * 1000), 3, '0')
    );

    INSERT INTO order_main(order_no, user_id, address_id, status, total_amount)
    VALUES(v_order_no, p_user_id, p_address_id, 'PENDING_PAYMENT', v_total_amount);

    SET p_order_id = LAST_INSERT_ID();
    SET p_order_no = v_order_no;

    INSERT INTO order_item(order_id, sku_id, quantity, price)
    SELECT p_order_id, ci.sku_id, ci.quantity, s.price
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    JOIN product_sku s ON ci.sku_id = s.id
    WHERE ci.cart_id = v_cart_id;

    UPDATE inventory i
    JOIN cart_item ci ON i.sku_id = ci.sku_id
    JOIN tmp_selected_cart_item t ON ci.id = t.cart_item_id
    SET i.available_stock = i.available_stock - ci.quantity,
        i.locked_stock = i.locked_stock + ci.quantity
    WHERE ci.cart_id = v_cart_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    SELECT ci.sku_id, 'LOCK_STOCK', -ci.quantity, v_order_no
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    WHERE ci.cart_id = v_cart_id;

    DELETE ci
    FROM cart_item ci
    JOIN tmp_selected_cart_item t ON ci.id = t.cart_item_id
    WHERE ci.cart_id = v_cart_id;

    COMMIT;
END $$

DELIMITER ;



SHOW PROCEDURE STATUS
WHERE Db = DATABASE()
  AND Name = 'sp_create_order_from_selected_cart_items';


  USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_update_cart_item_quantity $$

CREATE PROCEDURE sp_update_cart_item_quantity(
    IN p_user_id BIGINT,
    IN p_cart_item_id BIGINT,
    IN p_quantity INT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_cart_id BIGINT;
    DECLARE v_sku_id BIGINT;
    DECLARE v_available_stock INT DEFAULT 0;

    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车商品数量必须大于 0';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id AND is_deleted = 0;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '用户不存在或已删除';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE';

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '当前用户没有可用购物车';
    END IF;

    SELECT id INTO v_cart_id
    FROM cart
    WHERE user_id = p_user_id AND status = 'ACTIVE'
    LIMIT 1;

    SELECT COUNT(*) INTO v_count
    FROM cart_item
    WHERE id = p_cart_item_id
      AND cart_id = v_cart_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车商品不存在或不属于当前用户';
    END IF;

    SELECT sku_id INTO v_sku_id
    FROM cart_item
    WHERE id = p_cart_item_id
      AND cart_id = v_cart_id;

    SELECT COUNT(*) INTO v_count
    FROM product_sku s
    JOIN product p ON s.product_id = p.id
    WHERE s.id = v_sku_id
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
    WHERE sku_id = v_sku_id;

    IF v_available_stock < p_quantity THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '库存不足，不能修改为该数量';
    END IF;

    UPDATE cart_item
    SET quantity = p_quantity
    WHERE id = p_cart_item_id
      AND cart_id = v_cart_id;
END $$

DELIMITER ;


SHOW PROCEDURE STATUS
WHERE Db = DATABASE()
  AND Name = 'sp_update_cart_item_quantity';






-- 用于删除购物车内容
USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_delete_cart_item $$

CREATE PROCEDURE sp_delete_cart_item(
    IN p_user_id BIGINT,
    IN p_cart_item_id BIGINT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_cart_id BIGINT;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id
      AND is_deleted = 0;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '用户不存在或已删除';
    END IF;

    SELECT COUNT(*) INTO v_count
    FROM cart
    WHERE user_id = p_user_id
      AND status = 'ACTIVE';

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '当前用户没有可用购物车';
    END IF;

    SELECT id INTO v_cart_id
    FROM cart
    WHERE user_id = p_user_id
      AND status = 'ACTIVE'
    LIMIT 1;

    SELECT COUNT(*) INTO v_count
    FROM cart_item
    WHERE id = p_cart_item_id
      AND cart_id = v_cart_id;

    IF v_count = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '购物车商品不存在或不属于当前用户';
    END IF;

    DELETE FROM cart_item
    WHERE id = p_cart_item_id
      AND cart_id = v_cart_id;
END $$

DELIMITER ;


SHOW PROCEDURE STATUS
WHERE Db = DATABASE()
  AND Name = 'sp_delete_cart_item';










# 设置默认地址


USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_set_default_address $$

CREATE PROCEDURE sp_set_default_address(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id
      AND is_deleted = 0;

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
            SET MESSAGE_TEXT = '地址不存在或不属于当前用户';
    END IF;

    UPDATE user_address
    SET is_default = 0
    WHERE user_id = p_user_id
      AND is_deleted = 0;

    UPDATE user_address
    SET is_default = 1
    WHERE id = p_address_id
      AND user_id = p_user_id
      AND is_deleted = 0;
END $$

DELIMITER ;



# 删除地址

USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_delete_user_address $$

CREATE PROCEDURE sp_delete_user_address(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT
)
BEGIN
    DECLARE v_count INT DEFAULT 0;
    DECLARE v_is_default TINYINT DEFAULT 0;
    DECLARE v_next_address_id BIGINT DEFAULT NULL;

    SELECT COUNT(*) INTO v_count
    FROM `user`
    WHERE id = p_user_id
      AND is_deleted = 0;

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
            SET MESSAGE_TEXT = '地址不存在或不属于当前用户';
    END IF;

    SELECT is_default INTO v_is_default
    FROM user_address
    WHERE id = p_address_id
      AND user_id = p_user_id
      AND is_deleted = 0;

    UPDATE user_address
    SET is_deleted = 1,
        is_default = 0
    WHERE id = p_address_id
      AND user_id = p_user_id;

    IF v_is_default = 1 THEN
        SELECT id INTO v_next_address_id
        FROM user_address
        WHERE user_id = p_user_id
          AND is_deleted = 0
        ORDER BY id ASC
        LIMIT 1;

        IF v_next_address_id IS NOT NULL THEN
            UPDATE user_address
            SET is_default = 1
            WHERE id = v_next_address_id
              AND user_id = p_user_id;
        END IF;
    END IF;
END $$

DELIMITER ;


# 验证存储过程
SHOW PROCEDURE STATUS
WHERE Db = DATABASE()
  AND Name IN ('sp_set_default_address', 'sp_delete_user_address');









  # 退款
  USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_refund_paid_order $$

CREATE PROCEDURE sp_refund_paid_order(
    IN p_user_id BIGINT,
    IN p_order_id BIGINT,
    IN p_remark VARCHAR(255)
)
BEGIN
    DECLARE v_order_no VARCHAR(64);
    DECLARE v_total_amount DECIMAL(12, 2);
    DECLARE v_order_status VARCHAR(32);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT
        order_no,
        total_amount,
        status
    INTO
        v_order_no,
        v_total_amount,
        v_order_status
    FROM order_main
    WHERE id = p_order_id
      AND user_id = p_user_id
    FOR UPDATE;

    IF v_order_no IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '订单不存在或不属于当前用户';
    END IF;

    IF v_order_status <> 'PAID' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '只有已支付订单可以退款';
    END IF;

    UPDATE inventory i
    JOIN order_item oi ON i.sku_id = oi.sku_id
    SET i.available_stock = i.available_stock + oi.quantity
    WHERE oi.order_id = p_order_id;

    INSERT INTO inventory_log(sku_id, change_type, change_qty, ref_no)
    SELECT
        oi.sku_id,
        'REFUND_RESTORE',
        oi.quantity,
        v_order_no
    FROM order_item oi
    WHERE oi.order_id = p_order_id;

    INSERT INTO payment_record(order_id, pay_method, pay_status, pay_amount)
    VALUES(p_order_id, 'REFUND', 'SUCCESS', v_total_amount);

    UPDATE product_sales_stat stat
    JOIN (
        SELECT
            sku_id,
            SUM(quantity) AS refund_qty,
            SUM(quantity * price) AS refund_amount
        FROM order_item
        WHERE order_id = p_order_id
        GROUP BY sku_id
    ) refund_items ON stat.sku_id = refund_items.sku_id
    SET
        stat.total_sold_count = GREATEST(0, stat.total_sold_count - refund_items.refund_qty),
        stat.total_sales_amount = GREATEST(0, stat.total_sales_amount - refund_items.refund_amount);

    UPDATE order_main
    SET status = 'REFUNDED'
    WHERE id = p_order_id;

    COMMIT;
END $$

DELIMITER ;

-- ============================================================
-- 库存状态函数
-- 来源：07_create_function.sql
-- ============================================================

USE frieren_cloth_shop_db;

DELIMITER $$

DROP FUNCTION IF EXISTS fn_get_stock_status $$

CREATE FUNCTION fn_get_stock_status(p_available_stock INT)
RETURNS VARCHAR(20)
DETERMINISTIC
BEGIN
    DECLARE v_status VARCHAR(20);

    IF p_available_stock = 0 THEN
        SET v_status = 'OUT_OF_STOCK';
    ELSEIF p_available_stock <= 10 THEN
        SET v_status = 'LOW_STOCK';
    ELSE
        SET v_status = 'NORMAL';
    END IF;

    RETURN v_status;
END $$

DELIMITER ;

-- 函数验证
SELECT fn_get_stock_status(0) AS stock_status;
SELECT fn_get_stock_status(5) AS stock_status;
SELECT fn_get_stock_status(100) AS stock_status;
