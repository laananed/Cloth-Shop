# 商品介绍闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成管理员新增、编辑和清空商品介绍，并让前台安全展示数据库中的真实普通文本介绍。

**Architecture:** 在 `product` 增加可空 `description` 商品级字段，由 `v_product_detail` 暴露给现有商品查询。新增商品沿用 multipart 事务，编辑使用一个最小受保护 PATCH 接口；前台继续以 `product.detail` 作为展示兼容层，但其数据只来自数据库描述或静态兜底，SKU 摘要移入独立字段。

**Tech Stack:** MySQL 8.0.28、FastAPI、Pydantic、PyMySQL、原生 HTML/CSS/JavaScript ES Module、Node.js 内置测试框架。

## Global Constraints

- 商品介绍是最多 1000 个字符的普通文本，保留内部换行，禁止富文本执行。
- 空介绍统一写入 SQL `NULL`；旧商品无需补齐介绍。
- 不改变分类、图片、SKU、库存、销量、上下架、逻辑删除、下单、支付或退款规则。
- 不引入新的生产依赖，不拆分 `src/main.js` 或 `backend/app/main.py`。
- 不执行 `sql语句/04_测试数据与验证.sql`，不重置、删除或清空数据库。
- 业务实现、测试、迁移和必要文档形成阶段 4 的最小提交；正常推送 `master`，禁止强制推送和历史重写。

---

### Task 1: 用失败测试锁定商品介绍跨层契约

**Files:**
- Modify: `tests/site.test.js`
- Read: `admin.html`
- Read: `src/main.js`
- Read: `backend/app/main.py`
- Read: `sql语句/02_视图.sql`

**Interfaces:**
- Consumes: 现有 `readFileSync`、`sliceBetween` 测试辅助函数。
- Produces: `[DESCRIPTION-*]` 定向测试，锁定迁移、创建、查询、展示、编辑和安全状态契约。

- [ ] **Step 1: 增加迁移与后端失败测试**

在 `tests/site.test.js` 增加源码契约断言，读取新的 `06_商品描述增量迁移.sql`，验证：

```js
test('[DESCRIPTION-1] migration adds a nullable product description without destructive data changes', () => {
  const migration = readFileSync(new URL('../sql语句/06_商品描述增量迁移.sql', import.meta.url), 'utf8');
  assert.match(migration, /ALTER TABLE product[\s\S]*ADD COLUMN description TEXT NULL/i);
  assert.match(migration, /p\.description\s+AS\s+description/i);
  assert.doesNotMatch(migration, /DROP\s+DATABASE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+(product|product_sku|inventory)/i);
});
```

再断言 `POST /products` 接收 `description: str = Form("")`，`INSERT product` 包含 description；三个商品回读查询和两个 GET 接口显式选择 description；PATCH 路由调用 `require_admin_user`、使用 `WHERE id = %s AND is_deleted = 0`、参数化更新并显式提交/回滚。

- [ ] **Step 2: 增加前端失败测试**

断言：

```js
assert.match(adminHtml, /textarea[^>]+name="description"[^>]+maxlength="1000"/);
assert.ok(createHelper.includes('formData.append("description"'));
assert.ok(converter.includes('detail: normalizeProductDescription(row.description)'));
assert.ok(converter.includes('skuSummary:'));
assert.doesNotMatch(converter, /product\.detail\s*=\s*`共/);
assert.ok(productRenderer.includes('escapeHtml(product.detail)'));
assert.ok(adminHtml.includes('data-admin-description-editor'));
assert.ok(mainJs.includes('data-admin-product-description-edit'));
```

同时锁定空描述不输出详情节点、编辑器无变化/超长/提交中禁用、保存成功调用 `refreshAdminProductsFromApi()`、现有图片管理钩子仍存在。

- [ ] **Step 3: 运行测试确认 RED**

Run: `npm.cmd test`

Expected: 新增 `[DESCRIPTION-*]` 测试因 06 号迁移、字段、接口和弹窗尚不存在而失败；原有 110 项继续通过。

---

### Task 2: 实现非破坏性数据库迁移与后端描述契约

**Files:**
- Create: `sql语句/06_商品描述增量迁移.sql`
- Modify: `backend/app/main.py`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: `get_db()`、`require_admin_user()`、`v_product_detail`、现有商品创建事务。
- Produces: `product.description`、查询字段 `description`、`AdminProductDescriptionUpdateRequest`、`PATCH /admin/products/{product_id}/description`。

- [ ] **Step 1: 编写 06 号迁移**

迁移先用 `information_schema.columns` 构造重复执行保护，再更新最终复杂 SKU 视图：

```sql
SET @description_column_exists := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'product'
    AND column_name = 'description'
);
SET @add_description_sql := IF(
  @description_column_exists = 0,
  'ALTER TABLE product ADD COLUMN description TEXT NULL COMMENT ''商品介绍（普通文本）'' AFTER name',
  'SELECT ''product.description already exists'' AS migration_status'
);
PREPARE add_description_stmt FROM @add_description_sql;
EXECUTE add_description_stmt;
DEALLOCATE PREPARE add_description_stmt;
```

随后复制 `sql语句/02_视图.sql` 中最终版 `CREATE OR REPLACE VIEW v_product_detail`，仅在 `product_name` 后增加 `p.description AS description`，其余字段、JOIN 和过滤条件保持一致。

- [ ] **Step 2: 增加后端规范化和请求模型**

在 `backend/app/main.py` 增加：

```python
PRODUCT_DESCRIPTION_MAX_LENGTH = 1000

class AdminProductDescriptionUpdateRequest(BaseModel):
    description: str = Field(..., max_length=PRODUCT_DESCRIPTION_MAX_LENGTH)

def normalize_product_description(value: str | None) -> str | None:
    normalized = (value or "").strip()
    if len(normalized) > PRODUCT_DESCRIPTION_MAX_LENGTH:
        raise HTTPException(status_code=400, detail="商品介绍不能超过 1000 个字符")
    return normalized or None
```

- [ ] **Step 3: 扩展新增商品事务和查询**

给 `create_product()` 增加 `description: str = Form("")`，进入事务前规范化；将商品写入改为：

```sql
INSERT INTO product(category_id, name, description, image_url, status, is_deleted)
VALUES(%s, %s, %s, %s, 'ON_SALE', 0)
```

参数使用 `(category_id, product_name, normalized_description, image_url)`。所有 `v_product_detail` 商品查询在 `product_name` 后显式增加 `description`，包括公开商品、创建回读、后台库存、库存更新回读和状态更新回读。

- [ ] **Step 4: 实现管理员描述更新接口**

在商品管理接口附近新增：

```python
@app.patch("/admin/products/{product_id}/description")
def update_admin_product_description(
    product_id: int,
    req: AdminProductDescriptionUpdateRequest,
    authorization: str | None = Header(None),
):
    require_admin_user(authorization)
    description = normalize_product_description(req.description)
    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        "SELECT id FROM product WHERE id = %s AND is_deleted = 0 FOR UPDATE",
                        (product_id,),
                    )
                    if not cursor.fetchone():
                        raise HTTPException(status_code=404, detail="商品不存在或已删除")
                    cursor.execute(
                        "UPDATE product SET description = %s WHERE id = %s AND is_deleted = 0",
                        (description, product_id),
                    )
                conn.commit()
            except Exception:
                conn.rollback()
                raise
        return {"success": True, "product_id": product_id, "description": description}
    except HTTPException:
        raise
    except MySQLError as error:
        raise HTTPException(status_code=400, detail=f"修改商品介绍失败：{error}")
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"修改商品介绍失败：{error}")
```

- [ ] **Step 5: 运行定向和完整测试确认 GREEN**

Run: `npm.cmd test`

Expected: 数据库/后端描述契约测试通过；前端弹窗相关测试仍按下一任务预期失败。

Run: `backend\.venv\Scripts\python.exe -m py_compile backend\app\main.py backend\app\db.py`

Expected: exit 0。

---

### Task 3: 映射并安全展示真实商品介绍

**Files:**
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: API 行的 `description`、静态商品原有 `detail`、`escapeHtml()`。
- Produces: `normalizeProductDescription(value)`、数据库商品 `detail`、独立 `skuSummary`。

- [ ] **Step 1: 增加前端描述规范化函数**

```js
const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;

function normalizeProductDescription(value) {
  return typeof value === "string" ? value.trim() : "";
}
```

- [ ] **Step 2: 修正数据库商品聚合**

在 `convertApiProducts()` 首次建商品时使用：

```js
detail: normalizeProductDescription(row.description),
skuSummary: "",
```

聚合结束后只设置：

```js
product.skuSummary = `共 ${product.skuList.length} 个规格，库存 ${product.availableStock} 件，默认 SKU：${product.skuList[0]?.skuName || "无"}`;
```

不得再写入 `product.detail`。

- [ ] **Step 3: 安全渲染非空介绍**

在商品卡三种布局中统一生成：

```js
const detailMarkup = product.detail
  ? `<p class="product-card__detail">${escapeHtml(product.detail)}</p>`
  : "";
```

用 `${detailMarkup}` 替换直接插值。搜索函数继续包含 `product.detail`，静态商品结构不改。

- [ ] **Step 4: 增加多行普通文本样式**

在现有 `.product-card__detail` 规则中增加：

```css
white-space: pre-line;
overflow-wrap: anywhere;
```

- [ ] **Step 5: 运行测试确认 GREEN**

Run: `npm.cmd test`

Expected: 前台描述、空值、安全渲染、搜索和静态兜底测试通过；后台编辑器测试仍按下一任务预期失败。

Run: `node --check src\main.js`

Expected: exit 0。

---

### Task 4: 完成新增表单和后台介绍编辑弹窗

**Files:**
- Modify: `admin.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: `adminFetch()`、`refreshAdminProductsFromApi()`、`setFeedback()`、后台商品行中的 `description`。
- Produces: `data-admin-product-description-edit`、`data-admin-description-editor` 弹窗、PATCH 请求与状态管理。

- [ ] **Step 1: 统一新增表单字段**

将商品描述 textarea 改为：

```html
<textarea name="description" rows="4" maxlength="1000" placeholder="填写商品介绍，支持换行"></textarea>
<small>普通文本，最多 1000 个字符。</small>
```

提交处理在进入 API 前计算 `description`，超长时显示明确错误；`createAdminProductToApi()` 增加：

```js
formData.append("description", normalizeProductDescription(values.description));
```

- [ ] **Step 2: 增加独立弹窗结构**

在 `admin.html` 的现有管理弹窗旁增加 `data-admin-description-editor`，包含 backdrop、标题、商品摘要、textarea、字符计数、反馈、取消和保存钩子。textarea 设置 `maxlength="1000"`，弹窗初始 `hidden aria-hidden="true"`。

- [ ] **Step 3: 扩展后台商品数据和按钮**

`convertApiRowsToAdminProducts()` 首次建商品时增加：

```js
description: normalizeProductDescription(row.description),
```

渲染商品卡操作区时增加：

```html
<button type="button" class="ghost-button ghost-button--small" data-admin-product-description-edit="${row.productId}">编辑介绍</button>
```

- [ ] **Step 4: 实现编辑器状态与 PATCH 请求**

维护 `activeAdminDescriptionProduct`、`adminDescriptionInitialValue` 和 `adminDescriptionSubmitting`。实现打开、渲染、关闭、输入校验和提交函数。请求函数为：

```js
async function updateAdminProductDescriptionToApi(productId, description) {
  return adminFetch(`${API_BASE_URL}/admin/products/${productId}/description`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description: normalizeProductDescription(description) }),
  });
}
```

保存时先锁定控件和按钮，成功后 `await refreshAdminProductsFromApi()`；401/403 交给 `adminFetch()` 的现有认证清理；其他错误保留输入并显示反馈。关闭或切换商品清空旧反馈、字符数和提交状态。

- [ ] **Step 5: 增加弹窗和窄屏样式**

复用 `.admin-image-manager` 和 `.admin-sku-manager` 的 fixed、backdrop、panel 与按钮变量，新增专用类保证 textarea `width: 100%`、`max-width: 100%`、`box-sizing: border-box`、`resize: vertical`、`overflow-wrap: anywhere`。390px 媒体查询中让操作按钮纵向铺满且无横向溢出。

- [ ] **Step 6: 运行完整测试确认 GREEN**

Run: `npm.cmd test`

Expected: 所有原有测试和新增 `[DESCRIPTION-*]` 测试通过，0 失败。

Run: `node --check src\main.js`

Expected: exit 0。

---

### Task 5: 更新架构与执行说明

**Files:**
- Modify: `README.md`
- Modify: `docs/current-project-architecture.md`
- Test: `tests/site.test.js`

**Interfaces:**
- Consumes: 本次最终代码、迁移和真实验证结果。
- Produces: 06 号迁移执行顺序、商品介绍 API/数据流和阶段 4 完成状态。

- [ ] **Step 1: 更新 README**

在 SQL 执行顺序中将 `06_商品描述增量迁移.sql` 放在现有 01-05 之后，并明确 04 只用于测试库；记录商品介绍为最多 1000 字普通文本、空值为 NULL，以及 PATCH 管理员接口。

- [ ] **Step 2: 最小更新架构快照**

更新商品/API 表、`product` 与 `v_product_detail` 对象说明、商品新增与展示链路、后台编辑链路、SQL 顺序、测试数量和验收结果。文档头部以任务开始基线 `2933539` 为审计基线，并注明当前工作区实现。

- [ ] **Step 3: 运行文档契约测试**

Run: `npm.cmd test`

Expected: README、SQL 顺序和架构契约测试通过。

---

### Task 6: 本地迁移、API、浏览器和完整回归验收

**Files:**
- Verify: `sql语句/06_商品描述增量迁移.sql`
- Verify: all modified implementation files

**Interfaces:**
- Consumes: 本地 `frieren_cloth_shop_db`、8050 后端、5900 前端、管理员测试账号。
- Produces: 可复核的数据库、HTTP、浏览器和回归证据。

- [ ] **Step 1: 执行完整静态验证**

Run:

```powershell
npm.cmd test
node --check src\main.js
node --check src\sku-utils.js
node --check src\product-ordering.js
node --check src\ranking.js
backend\.venv\Scripts\python.exe -m py_compile backend\app\main.py
backend\.venv\Scripts\python.exe -m py_compile backend\app\db.py
git diff --check
```

Expected: 全部 exit 0；测试报告 0 失败、0 跳过。

- [ ] **Step 2: 审计并执行本地迁移**

先只读取数据库名、字段、视图定义和商品/SKU/库存数量，不输出凭据。确认数据库恰为 `frieren_cloth_shop_db`、迁移无破坏语句后执行 06。验证字段存在、视图包含 description、三个业务数量不变、NULL 与中文多行文本均可读取。再次执行 06 验证重复执行策略。

- [ ] **Step 3: 执行 API 冒烟**

启动本地后端并验证：`GET /products` 有 description；未认证 PATCH 返回 401/403；管理员 PATCH 可写入中文多行介绍；1001 字符被拒绝；不存在和已逻辑删除商品返回合理错误；空字符串清空；重新 GET 值一致。记录测试商品原值，并在结束前恢复和回读确认。

- [ ] **Step 4: 执行浏览器验收**

启动前端 5900，后台登录后检查编辑入口、当前内容、无变化禁用、提交中锁定、成功刷新和商品切换隔离。前台确认真实介绍、多行显示、空介绍隐藏、搜索、购买弹窗、多图预览和图片管理弹窗。分别检查桌面和约 390px 窄屏，无横向溢出且控制台无新增 error。

- [ ] **Step 5: 恢复测试数据并再次回归**

恢复测试商品原始 description，重新从 API/数据库确认；确保没有新增垃圾商品或上传文件。再次运行 `npm.cmd test` 和 `git diff --check`。

---

### Task 7: 创建阶段 4 提交并推送

**Files:**
- Stage only: `admin.html`
- Stage only: `src/main.js`
- Stage only: `src/styles.css`
- Stage only: `backend/app/main.py`
- Stage only: `sql语句/06_商品描述增量迁移.sql`
- Stage only: `tests/site.test.js`
- Stage only: `README.md`
- Stage only: `docs/current-project-architecture.md`
- Stage only: this plan if retained for the implementation record

**Interfaces:**
- Consumes: 所有验证证据与已恢复的本地测试数据。
- Produces: 独立阶段 4 实现提交和同步的 `origin/master`。

- [ ] **Step 1: 最终核对提交范围**

Run:

```powershell
git status --short
git diff --stat
git diff --check
git log --oneline origin/master..HEAD
git log --oneline HEAD..origin/master
```

Expected: 仅包含商品介绍闭环相关文件；远程没有本地未知提交。

- [ ] **Step 2: 精确暂存并提交**

使用精确路径 `git add -- <paths>`，检查 `git diff --cached --stat` 和 `git diff --cached --check` 后提交：

```powershell
git commit -m "feat: 完善商品介绍管理闭环"
```

- [ ] **Step 3: 正常推送并核对**

Run:

```powershell
git push origin master
git fetch origin
git rev-parse HEAD
git rev-parse origin/master
git status --short
```

Expected: push 成功，本地 HEAD 与 `origin/master` SHA 完全一致，工作区干净。
