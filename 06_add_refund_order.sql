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
