USE frieren_cloth_shop_db;

CREATE TABLE IF NOT EXISTS tag (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(40) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_deleted TINYINT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_tag_name (name),
    KEY idx_tag_deleted_sort (is_deleted, sort_order, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS product_tag (
    product_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, tag_id),
    KEY idx_product_tag_tag_product (tag_id, product_id),
    CONSTRAINT fk_product_tag_product
        FOREIGN KEY (product_id) REFERENCES product(id),
    CONSTRAINT fk_product_tag_tag
        FOREIGN KEY (tag_id) REFERENCES tag(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
