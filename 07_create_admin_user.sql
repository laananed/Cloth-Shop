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
