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
