-- 数据库结构与增量迁移（整理合并版）
-- 建议执行顺序：本文件 -> 02_视图.sql -> 03_存储过程_触发器_函数.sql -> 04_测试数据与验证.sql -> 05_账号与支付密码初始化.sql
-- 编码：UTF-8

-- ============================================================
-- 基础数据库与 15 张核心表
-- 来源：01_create_table.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS frieren_cloth_shop_db
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_general_ci;

USE frieren_cloth_shop_db;

# 1
CREATE TABLE user (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_admin TINYINT NOT NULL DEFAULT 0,
  is_deleted TINYINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 2
CREATE TABLE user_address (
    id BIGINT AUTO_INCREMENT PRIMARY KEY ,
    user_id BIGINT NOT NULL,
    recipient_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    detail VARCHAR(255) NOT NULL,
    is_default TINYINT NOT NULL DEFAULT 0,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_address_user_id (user_id),

    CONSTRAINT fk_user_address__user FOREIGN KEY (user_id) REFERENCES user (id)

)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 3
CREATE TABLE category (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) UNIQUE NOT NULL ,
    sort_order INT NOT NULL default 0,
    is_deleted TINYINT NOT NULL default 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 4
CREATE TABLE product (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    category_id BIGINT NOT NULL ,
    name VARCHAR(120) NOT NULL ,
    image_url VARCHAR(500) NULL COMMENT '商品主图访问地址',
    status VARCHAR(20) NOT NULL DEFAULT 'ON_SALE',
    is_deleted TINYINT NOT NULL  DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      KEY idx_product_category_status_deleted (category_id, status, is_deleted),
    CONSTRAINT fk_product_category FOREIGN KEY (category_id) REFERENCES category (id)
)ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 5
CREATE TABLE product_sku (
    id BIGINT AUTO_INCREMENT PRIMARY KEY ,
    product_id BIGINT,
    sku_name VARCHAR(100),
    price DECIMAL(10,2) DEFAULT 0.00,
    status VARCHAR(20) DEFAULT 'ON_SALE',
    is_deleted TINYINT DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    key idx_product_sku_product_status(product_id, status),
    CONSTRAINT fk_product_sku_product FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT chk_product_sku_price CHECK ( price >= 0 )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 6
CREATE TABLE cart (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE ,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 7
CREATE TABLE cart_item (
    id BIGINT AUTO_INCREMENT PRIMARY KEY ,
    cart_id BIGINT NOT NULL  ,
    sku_id BIGINT NOT NULL  ,
    quantity INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_cart_item_cart FOREIGN KEY (cart_id) REFERENCES cart(id),
    CONSTRAINT fk_cart_item_sku FOREIGN KEY (sku_id) REFERENCES product_sku(id),
    CONSTRAINT chk_cart_item_quantity check ( quantity > 0 ),
    key idx_cart_item_sku_id (sku_id),
    UNIQUE KEY uk_cart_item_cart_sku (cart_id, sku_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 8
CREATE TABLE order_main (
    id BIGINT AUTO_INCREMENT PRIMARY KEY ,
    order_no VARCHAR(40) NOT NULL UNIQUE ,
    user_id BIGINT NOT NULL ,
    address_id BIGINT NOT NULL ,
    status VARCHAR(30) NOT NULL default 'PENDING_PAYMENT',
    total_amount DECIMAL(12,2) NOT NULL  DEFAULT 0.00,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_order_main_user FOREIGN KEY (user_id) REFERENCES user(id),
    CONSTRAINT fk_orser_main_address FOREIGN KEY (address_id) REFERENCES user_address(id),
    constraint chk_order_main_total_amount CHECK ( total_amount >= 0 ),
    key idx_order_main_user_created (user_id, created_at),
    key idx_order_main_address_id(address_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 9
CREATE TABLE order_status_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    remark VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    KEY idx_order_status_log_order_created (order_id, created_at),

    CONSTRAINT fk_order_status_log_order
      FOREIGN KEY (order_id) REFERENCES order_main(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 10
CREATE TABLE order_item (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  sku_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0.00,

  KEY idx_order_item_order_id (order_id),
  KEY idx_order_item_sku_id (sku_id),

  CONSTRAINT fk_order_item_order
    FOREIGN KEY (order_id) REFERENCES order_main(id),

  CONSTRAINT fk_order_item_sku
    FOREIGN KEY (sku_id) REFERENCES product_sku(id),

  CONSTRAINT chk_order_item_quantity
    CHECK (quantity > 0),

  CONSTRAINT chk_order_item_price
    CHECK (price >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 11
CREATE TABLE payment_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  pay_method VARCHAR(32) NOT NULL,
  pay_status VARCHAR(32) NOT NULL,
  pay_amount DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_payment_record_order_id (order_id),

  CONSTRAINT fk_payment_record_order
    FOREIGN KEY (order_id) REFERENCES order_main(id),

  CONSTRAINT chk_payment_record_amount
    CHECK (pay_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 12
CREATE TABLE inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku_id BIGINT NOT NULL,
  available_stock INT NOT NULL DEFAULT 0,
  locked_stock INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uk_inventory_sku_id (sku_id),

  CONSTRAINT fk_inventory_sku
    FOREIGN KEY (sku_id) REFERENCES product_sku(id),

  CONSTRAINT chk_inventory_available_stock
    CHECK (available_stock >= 0),

  CONSTRAINT chk_inventory_locked_stock
    CHECK (locked_stock >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 13
CREATE TABLE inventory_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  sku_id BIGINT NOT NULL,
  change_type VARCHAR(32) NOT NULL,
  change_qty INT NOT NULL,
  ref_no VARCHAR(64),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_inventory_log_sku_created (sku_id, created_at),

  CONSTRAINT fk_inventory_log_sku
    FOREIGN KEY (sku_id) REFERENCES product_sku(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 14
CREATE TABLE operation_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  operator_id BIGINT NOT NULL,
  action_type VARCHAR(64) NOT NULL,
  remark VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

  KEY idx_operation_log_operator_id (operator_id),
  KEY idx_operation_log_created_at (created_at),

  CONSTRAINT fk_operation_log_user
    FOREIGN KEY (operator_id) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

# 15
CREATE TABLE product_sales_stat (
    sku_id BIGINT PRIMARY KEY ,
    total_sold_count INT NOT NULL DEFAULT 0,
    total_sales_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     KEY idx_product_sales_stat_sold_count (total_sold_count),

  CONSTRAINT fk_product_sales_stat_sku
    FOREIGN KEY (sku_id) REFERENCES product_sku(id),

  CONSTRAINT chk_product_sales_stat_count
    CHECK (total_sold_count >= 0),

  CONSTRAINT chk_product_sales_stat_amount
    CHECK (total_sales_amount >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- ============================================================
-- 商品多图扩展表
-- 来源：10_create_product_image.sql
-- ============================================================

-- 商品多图管理扩展表。
-- product.image_url 继续作为兼容主图字段，本表用于保存商品的多张图片。
USE frieren_cloth_shop_db;

CREATE TABLE IF NOT EXISTS product_image (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    product_id BIGINT NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_main TINYINT NOT NULL DEFAULT 0,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_image_product
        FOREIGN KEY (product_id) REFERENCES product(id),
    KEY idx_product_image_product_sort_deleted (product_id, sort_order, is_deleted),
    KEY idx_product_image_product_main (product_id, is_main, is_deleted)
);

-- 可选执行：将已有商品的兼容主图同步到商品图片表。
-- 默认不执行，避免在首次建表时自动迁移历史数据。
-- INSERT INTO product_image (product_id, image_url, sort_order, is_main, is_deleted)
-- SELECT p.id, p.image_url, 0, 1, 0
-- FROM product p
-- WHERE p.image_url IS NOT NULL
--   AND p.image_url <> ''
--   AND p.is_deleted = 0
--   AND NOT EXISTS (
--       SELECT 1
--       FROM product_image pi
--       WHERE pi.product_id = p.id
--         AND pi.image_url = p.image_url
--         AND pi.is_deleted = 0
--   );

SHOW CREATE TABLE product_image;
SELECT COUNT(*) AS product_image_count FROM product_image;

-- ============================================================
-- 复杂 SKU 颜色/尺码字段迁移
-- 来源：11_add_product_sku_dimensions.sql（ALTER TABLE 部分）
-- ============================================================

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
