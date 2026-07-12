# Complex SKU Implementation Plan

> **For agentic workers:** Execute inline in the current session. Do not dispatch subagents and do not commit Git. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add fixed color and size SKU dimensions across MySQL, FastAPI, admin product creation/management, and storefront purchasing while preserving legacy SKUs and real `sku_id` flow.

**Architecture:** Add nullable SKU columns and extend the existing product view; keep `product_sku.status` as the database sale-state source. Put deterministic matrix and selection logic in `src/sku-utils.js`, while `main.py` and `main.js` retain transaction, transport, DOM, image, address, and payment responsibilities.

**Tech Stack:** MySQL 8.0.28, FastAPI, PyMySQL, native HTML/CSS/JavaScript, Node.js `node:test`.

## Global Constraints

- Do not create generic attribute tables.
- Preserve `product_sku.sku_name`, all existing IDs, inventory references, cart references, order references, and historical order prices.
- SKU deletion is logical only; do not delete user files or upload images.
- Parameterize SQL and wrap writes with commit/rollback.
- Keep the existing multipart image field `images` and do not submit `image` in the new admin flow.
- Do not commit or push Git.

---

### Task 1: SKU schema and compatibility

**Files:**
- Create: `11_add_product_sku_dimensions.sql`
- Modify: `tests/site.test.js`

**Interfaces:**
- Produces columns `sku_code`, `color_name`, `size_name` and view aliases with unchanged SKU IDs.

- [ ] Add `[SKU-1]` tests for nullable dimensions, preserved `sku_name`, view image/inventory fields, no attribute tables, and legacy fallback markers.
- [ ] Run `node --test --test-name-pattern="SKU-1" tests/site.test.js`; expect failure because the migration and view fields are absent.
- [ ] Add the idempotent migration with parameter-free DDL only, no destructive data rewrite.
- [ ] Run the SKU-1 command, `python -m py_compile backend/app/main.py`, and `git diff --check`; require zero failures.
- [ ] Apply the migration with the project `.venv` only after static checks pass; query `information_schema` to verify real columns and view fields.

### Task 2: Backend SKU contract and manager API

**Files:**
- Modify: `backend/app/main.py`
- Modify: `tests/site.test.js`

**Interfaces:**
- Consumes database `status` and exposes `on_sale`; consumes `available_stock` or `stock` and exposes both response keys.
- Produces `GET/POST/PATCH/DELETE /admin/products/{product_id}/skus[/ {sku_id}]` with existing Bearer authentication.

- [ ] Add `[SKU-2]` tests for structured product reads, product creation JSON, duplicate validation, transactions, ownership, logical deletion, and checkout state checks.
- [ ] Run the SKU-2 pattern; expect missing fields/routes to fail.
- [ ] Add Pydantic request models and shared validation/response helpers.
- [ ] Extend `GET /products`, `POST /products`, and `/admin/inventory` queries without dropping `images`, `image_url`, or `inventory_updated_at`.
- [ ] Add authenticated manager routes with `SELECT ... FOR UPDATE`, parameterized writes, explicit commit/rollback, and final-SKU protection.
- [ ] Run SKU-2, Python compile, and whitespace checks; then perform rollback-safe real-DB integration probes.

### Task 3: Admin creation matrix

**Files:**
- Create: `src/sku-utils.js`
- Modify: `admin.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `tests/site.test.js`

**Interfaces:**
- `normalizeDimensionValues(value) -> string[]`
- `buildSkuMatrix(colors, sizes, previousRows, defaults) -> SkuRow[]`
- `createAdminProductToApi` serializes rows to `skus_json` and appends each image once as `images`.

- [ ] Add `[SKU-3]` unit/source tests for normalization, 2x3 cartesian generation, stable row values, editable fields, multipart data, error preservation, and success reset.
- [ ] Run SKU-3; expect missing module/DOM to fail.
- [ ] Implement pure matrix utilities, form DOM, render/update handlers, validation, and multipart submission.
- [ ] Run SKU-3, `node --check src/main.js`, and `git diff --check`; require zero failures.

### Task 4: Storefront structured selection

**Files:**
- Modify: `src/sku-utils.js`
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `tests/site.test.js`

**Interfaces:**
- `isStructuredSku(sku) -> boolean`
- `getSellableStructuredSkus(product) -> Sku[]`
- `selectSkuDimension(product, selection, dimension, value) -> {color,size,skuId}`
- `getDimensionOptions(product, selection, dimension) -> Option[]`

- [ ] Add `[SKU-4]` unit/source tests for merge preservation, both selection orders, incompatible clearing, disabled combinations, price/stock updates, real IDs, legacy fallback, and state isolation.
- [ ] Run SKU-4; expect missing structured selectors to fail.
- [ ] Preserve dimension fields in `convertApiProducts`, render separate controls, and update only SKU-derived state.
- [ ] Keep gallery/lightbox handlers free of SKU/address/payment resets and keep favorites SKU-optional.
- [ ] Run SKU-4, JavaScript syntax, and whitespace checks; require zero failures.

### Task 5: Existing-product SKU manager

**Files:**
- Modify: `admin.html`
- Modify: `src/main.js`
- Modify: `src/styles.css`
- Modify: `tests/site.test.js`

**Interfaces:**
- Uses the Task 2 manager routes and Task 3 matrix utilities.

- [ ] Add `[SKU-5]` tests for the entry button, modal, complete real-ID list, editing, missing-combination creation, auth, logical deletion, final-SKU protection, and preservation of filters/images/auth.
- [ ] Run SKU-5; expect missing manager DOM/wiring to fail.
- [ ] Add modal DOM and minimal styles; load all SKU rows from the authenticated API.
- [ ] Add submit locks, validation, edit/add/delete flows, refreshes that retain current search/filter values, and backend message display.
- [ ] Run SKU-5, JavaScript/Python syntax, and whitespace checks; require zero failures.

### Task 6: Full verification and evidence

**Files:**
- Verify all changed files only; do not commit.

- [ ] Run every SKU pattern independently and record pass/fail counts.
- [ ] Run `npm.cmd test`, `node --check src/main.js`, `python -m py_compile backend/app/main.py`, `git diff --check`, and `git status --short`.
- [ ] Query real MySQL schema, duplicate combinations/codes, SKU-inventory cardinality, logical deletions, and deleted-SKU order references.
- [ ] Inspect the final diff for unrelated edits, secrets, mojibake, upload files, and lost image logic.
- [ ] Report source-wiring, unit, real-MySQL, and browser-manual status separately with executable acceptance SQL and steps.
