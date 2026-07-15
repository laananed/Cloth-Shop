-- 阶段 10：购物车选中项备注下单增量迁移
-- 前置条件：已执行 01～07，order_main.buyer_remark 已存在。
-- 影响对象：仅新增/重建兼容过程 sp_create_order_from_selected_cart_items_with_remark。
-- 幂等性：可连续执行；旧过程和已有订单、购物车、库存数据均不修改。
-- 恢复方式：如需停用新入口，可删除本过程并让调用方恢复使用旧过程。

USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS sp_create_order_from_selected_cart_items_with_remark $$

CREATE PROCEDURE sp_create_order_from_selected_cart_items_with_remark(
    IN p_user_id BIGINT,
    IN p_address_id BIGINT,
    IN p_cart_item_ids JSON,
    IN p_buyer_remark VARCHAR(500),
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
    DECLARE v_buyer_remark VARCHAR(500);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_buyer_remark = NULLIF(
        REGEXP_REPLACE(COALESCE(p_buyer_remark, ''), '^[[:space:]]+|[[:space:]]+$', ''),
        ''
    );

    DROP TEMPORARY TABLE IF EXISTS tmp_selected_cart_item;
    CREATE TEMPORARY TABLE tmp_selected_cart_item (
        cart_item_id BIGINT PRIMARY KEY
    );

    -- 主键配合 INSERT IGNORE 对重复 ID 安全去重，避免重复明细和重复锁库存。
    INSERT IGNORE INTO tmp_selected_cart_item(cart_item_id)
    SELECT selected_item.cart_item_id
    FROM JSON_TABLE(
        p_cart_item_ids,
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
    LIMIT 1
    FOR UPDATE;

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
    LEFT JOIN inventory i ON ci.sku_id = i.sku_id
    WHERE ci.cart_id = v_cart_id
      AND (
          s.id IS NULL
          OR s.status <> 'ON_SALE'
          OR s.is_deleted = 1
          OR p.id IS NULL
          OR p.status <> 'ON_SALE'
          OR p.is_deleted = 1
          OR i.sku_id IS NULL
      );

    IF v_invalid_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = '选中商品中存在未上架或无效商品';
    END IF;

    -- 锁定本次涉及的库存行，随后再判断库存，避免并发下单穿透校验。
    SELECT COUNT(*) INTO v_shortage_count
    FROM tmp_selected_cart_item t
    JOIN cart_item ci ON t.cart_item_id = ci.id
    JOIN inventory i ON ci.sku_id = i.sku_id
    WHERE ci.cart_id = v_cart_id
      AND i.available_stock < ci.quantity
    FOR UPDATE;

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
  AND Name IN (
      'sp_create_order_from_selected_cart_items',
      'sp_create_order_from_selected_cart_items_with_remark'
  );
