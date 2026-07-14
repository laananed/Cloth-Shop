# SQL 文件整理说明

## 建议执行顺序

1. `01_数据库结构与增量迁移.sql`
2. `02_视图.sql`
3. `03_存储过程_触发器_函数.sql`
4. `04_测试数据与验证.sql`（只在测试库执行，会清空并重建测试数据）
5. `05_账号与支付密码初始化.sql`

## 合并规则

- 基础建表、多图表、复杂 SKU 字段归入“数据库结构与增量迁移”。
- 所有视图归入“视图”；复杂 SKU 版 `v_product_detail` 放在最后，作为最终定义。
- 存储过程、触发器、函数归入同一文件。
- 测试数据、业务流程测试、`EXPLAIN`、`SHOW CREATE TABLE` 归入测试验证文件。
- 支付密码初始化与管理员账号归入账号初始化文件。

## 去重处理

- `07_create_admin_user.sql` 与 `09_create_admin_user.sql` 内容完全相同，仅保留一份。
- `06_add_refund_order.sql` 的退款存储过程已经完整存在于 `05_create_procedure_trigger.sql` 末尾，不再重复追加。
- 原 `01_create_table.sql` 末尾的支付密码迁移与 `08_update_user_pay_password.sql` 重复，统一采用后者的幂等写法。

## 最小兼容性修正

- 将原 `product` 表定义中的明显语法笔误 `i id BIGINT` 修正为 `id BIGINT`。
- 测试数据清理部分补充 `product_image` 表，避免重复运行测试时受外键约束影响。
- 除上述修正、分类移动和去重外，未改写原有业务逻辑。
