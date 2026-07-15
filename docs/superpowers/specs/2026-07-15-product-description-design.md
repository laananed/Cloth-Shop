# 商品介绍闭环设计

## 目标

管理员在新增商品时填写的商品描述应保存到 MySQL，并作为数据库商品的真实介绍显示在前台。管理员之后可以在商品管理中编辑或清空介绍；SKU、库存和默认 SKU 摘要不得继续占用商品介绍字段。

## 范围

本阶段只实现商品级普通文本介绍的创建、保存、查询、展示、编辑与清空，不扩展为通用商品编辑器，不实现富文本、自动生成介绍、标签系统，也不修改分类、图片、SKU、库存、上下架、下单、支付或退款规则。

需保护现有管理员认证及 401/403 清理、复杂 SKU、新商品 SKU 默认库存 50、多图上传和统一图片管理弹窗、逻辑删除、前台静态商品兜底、搜索、购买弹窗、收藏、购物车和订单链路。

## 当前实现依据

- `admin.html` 的新增商品表单已有 `name="detail"` 的商品描述 textarea，但 `src/main.js` 没有把它加入 multipart 请求。
- `POST /products` 当前不接收描述，`product` 表也没有独立描述字段。
- `GET /products` 与 `GET /admin/inventory` 显式查询最终版 `v_product_detail` 的列。
- `convertApiProducts()` 先创建空 `detail`，随后用规格数、库存和默认 SKU 摘要覆盖该字段。
- `product.detail` 参与商品卡渲染和前台搜索。静态兜底商品在 `src/content.js` 中已有自己的 `detail` 文案。
- 后台商品卡已有图片和 SKU 管理入口及弹窗交互，可复用其按钮、反馈、遮罩和窄屏模式。

## 数据库设计

新增编号迁移 `sql语句/06_商品描述增量迁移.sql`：

- 为 `product` 增加 `description TEXT NULL COMMENT '商品介绍（普通文本）'`。
- 不更新任何已有商品、SKU、库存、销量、图片或订单数据。
- 使用 `information_schema.columns` 与动态 SQL 保护重复执行，字段已存在时不重复添加。
- 使用 `CREATE OR REPLACE VIEW v_product_detail` 更新复杂 SKU 最终视图，在保留原字段名称、顺序和过滤行为的基础上增加 `p.description AS description`。
- 迁移文件注明前置条件、执行顺序、影响对象、重复执行行为和恢复说明；不包含 `DROP DATABASE`、`TRUNCATE` 或业务数据清理。

空介绍统一保存为 SQL `NULL`。字段使用 `TEXT` 以支持中文和多行普通文本，应用层限制最多 1000 个字符。

## 新增商品数据流

将新增表单字段统一命名为 `description`，并设置 `maxlength="1000"`：

```text
admin.html textarea[name="description"]
→ src/main.js 读取并 trim
→ FormData.append("description", ...)
→ POST /products 的 Form 参数
→ 最多 1000 字符校验
→ INSERT product.description
→ v_product_detail
→ 新增响应和后台列表刷新
```

前端在请求前拒绝超过 1000 字符的内容，后端再次校验，禁止静默截断。`trim()` 只删除首尾无意义空白，正文内部换行保持不变。空字符串写入 `NULL`。现有商品、SKU、库存、图片事务与上传文件失败清理保持不变。

## 查询与前台展示

以下查询显式加入 `description`：

- `GET /products`
- `POST /products` 成功后的商品回读
- `GET /admin/inventory`
- 库存或商品状态更新后从 `v_product_detail` 回读商品的既有查询

`convertApiProducts()` 在首次合并商品时将数据库 `description` 规范化为去除首尾空白的字符串，并映射到现有 `product.detail`。同一商品后续 SKU 行不得覆盖该值。

规格数量、库存和默认 SKU 信息如仍需保留，写入独立的 `product.skuSummary`，不得再赋值给 `product.detail`。

商品卡只在介绍非空时输出 `.product-card__detail`。内容通过项目现有 `escapeHtml()` 渲染，CSS 使用 `white-space: pre-line` 和安全断词支持多行普通文本。搜索继续读取 `product.detail`，因此数据库介绍自然参与搜索，同时保留名称、分类和 SKU 搜索。静态商品继续使用原有 `detail`；API 加载失败时仍使用现有静态兜底。

## 后台编辑交互

商品卡操作区新增“编辑介绍”按钮，打开独立的商品介绍编辑弹窗。弹窗沿用后台现有遮罩、面板、关闭按钮、反馈、主按钮和响应式样式，不与图片或 SKU 状态混用。

弹窗包含：

- 当前商品名称和 ID。
- 最多 1000 字符的普通文本 textarea。
- 当前字符数和空内容说明。
- 取消、关闭和保存按钮。
- `aria-live` 反馈区域。

状态规则：

- 打开时从当前后台 API 数据载入 `description`，清除上一个商品的反馈和提交状态。
- 内容未变化、超过 1000 字符或正在提交时禁用保存。
- 空内容保存表示清空，并由后端转为 `NULL`。
- 取消、遮罩关闭和关闭按钮不提交。
- 提交成功后重新请求 `GET /admin/inventory`，刷新商品卡和当前商品数据，再关闭弹窗或显示成功反馈。
- 提交失败保留输入内容并显示后端错误；401/403 继续由现有 `adminFetch()` 清理登录态。
- 提交期间禁用 textarea、保存和取消/关闭行为，防止重复请求及商品状态串用。

## 更新接口

新增专用接口：

```http
PATCH /admin/products/{product_id}/description
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "description": "商品介绍"
}
```

新增 Pydantic 请求模型，`description` 必须是字符串且最多 1000 个字符。接口调用现有 `require_admin_user()`，在事务内查询商品是否存在且 `is_deleted = 0`，再执行参数化更新：

```sql
UPDATE product
SET description = %s
WHERE id = %s AND is_deleted = 0
```

后端先 `strip()`，空字符串转为 `None`。成功响应至少包含 `success`、`product_id` 和更新后的 `description`。不存在或已删除返回 404；认证错误保留 401/403；Pydantic 类型或长度错误保留 422；MySQL 异常回滚并返回可诊断错误。`HTTPException` 不被通用异常处理改写为 500。

## 测试策略

实现采用测试先行：先在 `tests/site.test.js` 增加会因功能缺失而失败的定向测试，再逐层实现最小代码并运行完整测试。

自动测试覆盖：

- 06 号迁移存在、增加 `product.description`、更新视图且不包含数据库重置或数据清空。
- 新增表单和 multipart 使用统一 `description` 字段及 1000 字符限制。
- `POST /products` 接收、规范化并保存描述。
- 商品查询和更新后的回读查询返回描述。
- 数据库商品转换使用真实描述，规格库存摘要不再覆盖 `detail`。
- 空介绍不输出错误占位，静态 `detail` 兜底保留，前台渲染使用转义。
- 后台卡片、弹窗、保存/关闭状态和刷新链路存在。
- PATCH 接口执行管理员认证、存在性检查、参数化更新、空值清理、显式提交/回滚并保留业务错误。
- 阶段 3 图片管理和现有 SKU 测试继续通过。

实施完成后执行项目要求的 JavaScript/Python 语法检查、`git diff --check`、本地 MySQL 非破坏迁移验证、API 冒烟，以及桌面端和约 390px 浏览器验收。若临时修改现有测试商品介绍，验收后恢复原值并确认未留下测试数据。

## 文档与提交

实现会最小更新：

- `README.md` 的 SQL 执行顺序与商品介绍说明。
- `docs/current-project-architecture.md` 的数据库对象、API、前后台数据流、测试结果和功能状态。

不修改阶段 1 至阶段 3 的历史提交，不使用强制推送。实现和验收完成后创建阶段 4 的最小业务闭环提交并推送 `master` 到 `origin/master`。
