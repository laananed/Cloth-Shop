-- 账号与支付密码初始化（整理合并版）
-- 建议在测试数据导入后执行，以确保用户 2 的支付密码被正确写入。
-- 09_create_admin_user.sql 与 07_create_admin_user.sql 完全相同，因此仅保留一份。
-- 编码：UTF-8

-- ============================================================
-- 支付密码字段检查、迁移与用户 2 初始化
-- 来源：08_update_user_pay_password.sql
-- ============================================================

USE frieren_cloth_shop_db;

SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'user'
      AND COLUMN_NAME = 'pay_password_hash'
);

SET @sql = IF(
    @column_exists = 0,
    'ALTER TABLE `user` ADD COLUMN pay_password_hash CHAR(64) NULL COMMENT ''支付密码SHA256哈希'' AFTER password_hash',
    'SELECT ''pay_password_hash already exists'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE `user`
SET pay_password_hash = SHA2('123456', 256)
WHERE id = 2;

SELECT
    id,
    email,
    pay_password_hash,
    pay_password_hash = SHA2('123456', 256) AS password_is_123456
FROM `user`
WHERE id = 2;

-- ============================================================
-- 管理员账号初始化
-- 来源：07_create_admin_user.sql（09 为重复文件）
-- ============================================================

USE frieren_cloth_shop_db;

INSERT INTO `user`(
  email,
  password_hash,
  is_admin,
  is_deleted,
  pay_password_hash
)
VALUES(
  'admin@example.com',
  SHA2('admin123456', 256),
  1,
  0,
  SHA2('123456', 256)
)
ON DUPLICATE KEY UPDATE
  password_hash = SHA2('admin123456', 256),
  is_admin = 1,
  is_deleted = 0,
  pay_password_hash = COALESCE(pay_password_hash, SHA2('123456', 256));
