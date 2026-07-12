# 复杂 SKU 完善设计

## 目标与边界

在现有 FastAPI、PyMySQL、MySQL 和原生前端上，将商品 SKU 完善为固定的“颜色 + 尺码”二维模型。继续使用真实 `sku_id` 关联库存、购物车和订单；不引入通用属性表，不改历史订单价格，不物理删除 SKU，不改图片、退款、支付、发货、地址和管理员认证协议。

## 真实基线

- MySQL 版本为 8.0.28，数据库为 `frieren_cloth_shop_db`。
- `product_sku` 当前字段为 `id/product_id/sku_name/price/status/is_deleted/created_at`。
- 当前没有 `sku_code`、颜色列或尺码列；69 条旧 SKU 均不能通过明确的 `" / "` 分隔符安全迁移。
- `inventory.sku_id` 已有唯一索引；购物车和订单均继续引用 `product_sku.id`。
- 现有加购、直接购买、整车结算和选中结算存储过程已经复核商品/SKU 上架、逻辑删除和库存。
- `v_product_detail` 当前保留主图、库存更新时间和销售统计，但尚未包含结构化 SKU 字段。

## 数据设计

新增一次增量迁移 `11_add_product_sku_dimensions.sql`：

- `sku_code VARCHAR(100) NULL`
- `color_name VARCHAR(50) NULL`
- `size_name VARCHAR(30) NULL`
- 普通索引 `(product_id, color_name, size_name, is_deleted)`
- 普通索引 `sku_code`
- 重建 `v_product_detail`，只增加 `sku_code/color_name/size_name/sku_is_deleted`，保留全部原列。

迁移不修改任何现有 `sku_id` 或关联字段，不自动拆分旧 `sku_name`，也不建立会被旧数据阻塞的唯一索引。新建/编辑 SKU 时，由后端在同一事务内锁定商品并校验有效 SKU 的编码和颜色尺码组合唯一性。

## 后端设计

`skus_json` 继续作为新增商品的 multipart JSON 字段。结构化行使用 `sku_code/sku_name/color/size/price/stock/on_sale`；后端兼容读取旧 `available_stock`，但响应统一返回 `stock` 和数据库原名 `available_stock`。数据库继续以 `status=ON_SALE/OFF_SALE` 保存上下架状态，并在响应中补充 `on_sale`。

新增已存在商品的 SKU 管理接口：

- `GET /admin/products/{product_id}/skus`
- `POST /admin/products/{product_id}/skus`
- `PATCH /admin/products/{product_id}/skus/{sku_id}`
- `DELETE /admin/products/{product_id}/skus/{sku_id}`

所有接口复用 Bearer 管理员认证。新增与编辑在事务内校验所属关系、编码、组合、价格、库存和状态；删除只更新 `is_deleted=1`，并保护最后一个有效 SKU。

## 前端设计

新增纯函数模块 `src/sku-utils.js`，集中处理维度去重、笛卡尔积、编辑值保留、可售组合判断和颜色尺码选择，供 `node:test` 直接验证。`src/main.js` 仅接线，不重写现有购买、图片、地址、支付或后台认证流程。

后台新增商品使用逗号、中文逗号或换行分隔颜色/尺码，生成可编辑矩阵并提交 `skus_json`；失败保留表单和图片预览，成功后统一清理。已有商品卡片新增“管理规格”弹窗，完整加载、编辑、新增缺失组合和逻辑删除 SKU。

前台对结构化商品显示独立颜色和尺码按钮；两维完成后才设置真实 `activePurchaseSkuId`。按钮可用性由未删除、SKU 在售、商品在售且库存大于 0 的组合决定。旧 SKU 的结构化字段为 NULL 时继续显示原 `sku_name` 单规格按钮。

## 测试与验收

严格按 SKU-1 到 SKU-5 执行红—绿闭环。每个闭环先新增带前缀的测试并单独观察失败，再最小实现并单独运行对应 pattern；通过后才进入下一闭环。最后运行全量 `npm.cmd test`、JavaScript/Python 语法检查、`git diff --check` 和工作区审计。数据库迁移与接口集成测试只报告真实执行结果。
