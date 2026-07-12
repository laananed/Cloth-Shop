-- Phase 01: additive catalog metadata, product favorites, tags, and safe operation logging.
-- MySQL 8.0.28 compatible. Re-running this migration does not overwrite business data.
USE frieren_cloth_shop_db;

DELIMITER $$

DROP PROCEDURE IF EXISTS ug_add_column_if_missing $$
CREATE PROCEDURE ug_add_column_if_missing(
    IN p_table_name VARCHAR(64),
    IN p_column_name VARCHAR(64),
    IN p_column_definition VARCHAR(1000)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = p_table_name
          AND COLUMN_NAME = p_column_name
    ) THEN
        SET @ug_ddl = CONCAT(
            'ALTER TABLE `', REPLACE(p_table_name, '`', '``'),
            '` ADD COLUMN `', REPLACE(p_column_name, '`', '``'),
            '` ', p_column_definition
        );
        PREPARE ug_stmt FROM @ug_ddl;
        EXECUTE ug_stmt;
        DEALLOCATE PREPARE ug_stmt;
    END IF;
END $$

CALL ug_add_column_if_missing('product', 'description', 'TEXT NULL AFTER `name`') $$
CALL ug_add_column_if_missing('order_main', 'buyer_remark', 'VARCHAR(500) NULL') $$
CALL ug_add_column_if_missing('category', 'is_protected', 'TINYINT NOT NULL DEFAULT 0') $$

DELIMITER ;

CREATE TABLE IF NOT EXISTS product_favorite (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_favorite_user_product (user_id, product_id),
    KEY idx_product_favorite_product (product_id),
    CONSTRAINT fk_product_favorite_product
        FOREIGN KEY (product_id) REFERENCES product(id)
);

CREATE TABLE IF NOT EXISTS product_tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_product_tag_name (name),
    KEY idx_product_tag_deleted (is_deleted)
);

CREATE TABLE IF NOT EXISTS product_tag_relation (
    product_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, tag_id),
    UNIQUE KEY uk_product_tag_relation_product_tag (product_id, tag_id),
    KEY idx_product_tag_relation_tag (tag_id),
    CONSTRAINT fk_product_tag_relation_product
        FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT fk_product_tag_relation_tag
        FOREIGN KEY (tag_id) REFERENCES product_tag(id)
);

CREATE TABLE IF NOT EXISTS operation_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    operator_type VARCHAR(20) NOT NULL DEFAULT 'SYSTEM',
    operator_id BIGINT NULL,
    module VARCHAR(50) NOT NULL DEFAULT 'SYSTEM',
    action VARCHAR(80) NOT NULL,
    target_type VARCHAR(50) NULL,
    target_id VARCHAR(80) NULL,
    request_method VARCHAR(10) NULL,
    request_path VARCHAR(255) NULL,
    result VARCHAR(20) NOT NULL DEFAULT 'SUCCESS',
    summary VARCHAR(500) NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_operation_log_filter (operator_type, module, action, result, created_at),
    KEY idx_operation_log_target (target_type, target_id)
);

DELIMITER $$

CALL ug_add_column_if_missing('operation_log', 'operator_type', 'VARCHAR(20) NOT NULL DEFAULT ''SYSTEM''') $$
CALL ug_add_column_if_missing('operation_log', 'operator_id', 'BIGINT NULL') $$
CALL ug_add_column_if_missing('operation_log', 'module', 'VARCHAR(50) NOT NULL DEFAULT ''SYSTEM''') $$
CALL ug_add_column_if_missing('operation_log', 'action', 'VARCHAR(80) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'target_type', 'VARCHAR(50) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'target_id', 'VARCHAR(80) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'request_method', 'VARCHAR(10) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'request_path', 'VARCHAR(255) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'result', 'VARCHAR(20) NOT NULL DEFAULT ''SUCCESS''') $$
CALL ug_add_column_if_missing('operation_log', 'summary', 'VARCHAR(500) NULL') $$
CALL ug_add_column_if_missing('operation_log', 'created_at', 'DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP') $$

DROP PROCEDURE IF EXISTS ug_add_column_if_missing $$

DELIMITER ;

-- category.name is already unique in the project schema, making these seeds repeatable.
INSERT INTO category (name, sort_order, is_deleted, is_protected)
VALUES
    ('无分类', 0, 0, 1),
    ('日常轻搭', 10, 0, 0),
    ('幻夜出行', 20, 0, 0),
    ('东风和韵', 30, 0, 0),
    ('纯白礼赞', 40, 0, 0),
    ('主题限定', 50, 0, 0),
    ('海岛假日', 60, 0, 0)
ON DUPLICATE KEY UPDATE
    sort_order = VALUES(sort_order),
    is_deleted = 0,
    is_protected = GREATEST(is_protected, VALUES(is_protected));

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
    s.sku_name AS sku_name,
    s.price AS price,
    s.status AS sku_status,
    i.available_stock AS available_stock,
    i.locked_stock AS locked_stock,
    COALESCE(stat.total_sold_count, 0) AS total_sold_count,
    COALESCE(stat.total_sales_amount, 0.00) AS total_sales_amount,
    tags.tag_names AS tag_names,
    p.created_at AS product_created_at,
    p.updated_at AS product_updated_at,
    i.updated_at AS inventory_updated_at
FROM category c
JOIN product p ON c.id = p.category_id
JOIN product_sku s ON p.id = s.product_id
LEFT JOIN inventory i ON s.id = i.sku_id
LEFT JOIN product_sales_stat stat ON s.id = stat.sku_id
LEFT JOIN (
    SELECT
        ptr.product_id,
        GROUP_CONCAT(DISTINCT t.name ORDER BY t.name SEPARATOR ',') AS tag_names
    FROM product_tag_relation ptr
    JOIN product_tag t ON t.id = ptr.tag_id AND t.is_deleted = 0
    GROUP BY ptr.product_id
) tags ON tags.product_id = p.id
WHERE c.is_deleted = 0
  AND p.is_deleted = 0
  AND s.is_deleted = 0;

-- Verification queries are read-only and intentionally do not expose business records.
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND (
      (TABLE_NAME = 'product' AND COLUMN_NAME = 'description')
      OR (TABLE_NAME = 'order_main' AND COLUMN_NAME = 'buyer_remark')
      OR (TABLE_NAME = 'category' AND COLUMN_NAME = 'is_protected')
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
