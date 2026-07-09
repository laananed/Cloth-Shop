# Logical Product Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend logical-delete endpoint for products and wire an admin delete button that removes deleted products from default frontend and admin listings without touching historical order data.

**Architecture:** Keep the change limited to the existing FastAPI product-status area, the admin product-list rendering/event delegation in `src/main.js`, and the current danger button styling if needed. The backend only toggles soft-delete and `OFF_SALE` flags on `product` and `product_sku`; the frontend only adds a delete action and refreshes the admin list after success.

**Tech Stack:** FastAPI, MySQL, vanilla JavaScript, existing Node test suite

## Global Constraints

- Do not physically delete database rows.
- Do not change cart, order, payment, or statistics flows.
- Do not remove product image files.
- Preserve historical order visibility.
- Keep the change minimal and aligned with existing admin inventory/status patterns.

---

### Task 1: Add failing regression checks

**Files:**
- Modify: `tests/site.test.js`

**Interfaces:**
- Consumes: `src/main.js`, `backend/app/main.py`
- Produces: source-level regression coverage for the delete API and admin delete button wiring

- [ ] **Step 1: Write the failing test**

```js
test('admin product management source includes logical delete wiring', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(mainJs.includes('async function deleteAdminProductToApi(productId)'));
  assert.ok(mainJs.includes('data-admin-product-delete-id'));
  assert.ok(mainJs.includes('确定要删除这个商品吗？删除后前台和后台默认商品列表将不再显示，但历史订单数据不会被物理删除。'));
  assert.ok(mainJs.includes('await refreshAdminProductsFromApi();'));
  assert.ok(backend.includes('@app.post("/admin/products/delete")'));
  assert.ok(backend.includes('AdminProductDeleteRequest'));
  assert.ok(backend.includes("SET is_deleted = 1, status = 'OFF_SALE'"));
  assert.ok(backend.includes('WHERE product_id = %s'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site.test.js`
Expected: FAIL because the delete endpoint and frontend delete wiring are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

No production code yet for this task.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS after the backend and frontend changes are in place.

- [ ] **Step 5: Commit**

```bash
git add tests/site.test.js
git commit -m "test: cover logical product deletion wiring"
```

### Task 2: Implement backend logical delete

**Files:**
- Modify: `backend/app/main.py`

**Interfaces:**
- Consumes: `get_db()`, `HTTPException`, existing `product` and `product_sku` schema
- Produces: `AdminProductDeleteRequest`, `POST /admin/products/delete`

- [ ] **Step 1: Write the failing test**

Covered by Task 1 regression check.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site.test.js`
Expected: FAIL until the delete request model and endpoint exist.

- [ ] **Step 3: Write minimal implementation**

```python
class AdminProductDeleteRequest(BaseModel):
    product_id: int = Field(..., gt=0, description="要逻辑删除的商品 ID")


@app.post("/admin/products/delete")
def delete_admin_product(req: AdminProductDeleteRequest):
    product_id = req.product_id

    try:
        with get_db() as conn:
            try:
                with conn.cursor() as cursor:
                    cursor.execute(
                        """
                        SELECT id
                        FROM product
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (product_id,)
                    )
                    product = cursor.fetchone()

                    if not product:
                        raise HTTPException(
                            status_code=404,
                            detail="商品不存在或已删除"
                        )

                    cursor.execute(
                        """
                        UPDATE product
                        SET is_deleted = 1,
                            status = 'OFF_SALE'
                        WHERE id = %s
                          AND is_deleted = 0
                        """,
                        (product_id,)
                    )

                    cursor.execute(
                        """
                        UPDATE product_sku
                        SET is_deleted = 1,
                            status = 'OFF_SALE'
                        WHERE product_id = %s
                          AND is_deleted = 0
                        """,
                        (product_id,)
                    )

                conn.commit()

                return {
                    "success": True,
                    "message": "商品已逻辑删除",
                    "product_id": product_id,
                }

            except HTTPException:
                conn.rollback()
                raise

            except Exception:
                conn.rollback()
                raise

    except HTTPException:
        raise

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"商品逻辑删除失败：{str(e)}"
        )
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add logical product deletion endpoint"
```

### Task 3: Wire admin delete button

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `refreshAdminProductsFromApi()`, `setFeedback()`, `productList` event delegation
- Produces: `deleteAdminProductToApi(productId)`, delete button markup, delete click handler

- [ ] **Step 1: Write the failing test**

Covered by Task 1 regression check.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/site.test.js`
Expected: FAIL until the API helper, button, and event handling exist.

- [ ] **Step 3: Write minimal implementation**

```js
async function deleteAdminProductToApi(productId) {
  const response = await fetch(`${API_BASE_URL}/admin/products/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: Number(productId),
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "删除商品失败");
  }

  return result;
}
```

```js
<button
  type="button"
  class="ghost-button ghost-button--small ghost-button--danger"
  data-admin-product-delete-id="${row.productId}"
>
  删除商品
</button>
```

```js
const deleteButton = event.target.closest("[data-admin-product-delete-id]");

if (deleteButton) {
  const productId = Number(deleteButton.dataset.adminProductDeleteId);

  if (!Number.isInteger(productId) || productId <= 0) {
    setFeedback(productManageFeedback || productFeedback, "商品 ID 不正确，无法删除。", true);
    return;
  }

  const confirmed = window.confirm("确定要删除这个商品吗？删除后前台和后台默认商品列表将不再显示，但历史订单数据不会被物理删除。");
  if (!confirmed) {
    return;
  }

  try {
    deleteButton.disabled = true;
    deleteButton.textContent = "删除中...";

    await deleteAdminProductToApi(productId);
    setFeedback(productManageFeedback || productFeedback, `商品 ${productId} 已删除。`);
    await refreshAdminProductsFromApi();
  } catch (error) {
    console.error("后台删除商品失败：", error);
    setFeedback(productManageFeedback || productFeedback, `删除商品失败：${error.message}`, true);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "feat: add admin product delete action"
```

### Task 4: Verify styling and behavior

**Files:**
- Modify: `src/styles.css` only if `ghost-button--danger` is missing or differs materially

**Interfaces:**
- Consumes: admin delete button markup
- Produces: danger-action visual cue

- [ ] **Step 1: Inspect the current danger-button rules**

```css
.ghost-button--danger {
  border-color: rgba(217, 72, 72, 0.22);
  color: #c83f3f;
  background: rgba(255, 247, 247, 0.82);
}
```

- [ ] **Step 2: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS.

- [ ] **Step 3: Write minimal implementation**

No style change required unless the existing danger state diverges from the requested warning tone.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/site.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

No commit if no file changed.
