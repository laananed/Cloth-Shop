import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const html = fs.readFileSync(new URL('../admin.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('admin catalog exposes category filter and bulk selection controls', () => {
  for (const hook of ['data-admin-category-filter', 'data-admin-select-filtered', 'data-admin-clear-selection', 'data-admin-selected-count', 'data-admin-bulk-tag-mode', 'data-admin-bulk-tag-submit']) {
    assert.ok(html.includes(hook), `missing ${hook}`);
  }
  assert.match(js, /selectedAdminProductIds = new Set/);
  assert.match(js, /activeAdminCategoryFilter/);
});

test('admin product cards expose metadata editing and real selection ids', () => {
  assert.match(js, /data-admin-product-select="\$\{row\.productId\}"/);
  assert.match(js, /data-admin-product-description/);
  assert.match(js, /updateAdminProductMetadataToApi/);
});

test('admin category and tag management use authenticated API wrapper', () => {
  for (const path of ['/admin/categories', '/admin/tags', '/admin/tags/bulk']) {
    assert.ok(js.includes(path), `missing ${path}`);
  }
  assert.match(js, /adminFetch\(`\$\{API_BASE_URL\}\/admin\/categories/);
  assert.match(js, /adminFetch\(`\$\{API_BASE_URL\}\/admin\/tags/);
});

test('image manager supports real main and sort updates', () => {
  assert.ok(html.includes('data-admin-image-manager-list'));
  assert.match(js, /reorderAdminProductImagesToApi/);
  assert.match(js, /\/images\/reorder/);
  assert.match(js, /is_main/);
  assert.match(js, /sort_order/);
});

test('admin mutations use adminFetch so expired auth clears the dashboard', () => {
  assert.match(js, /async function adminFetch/);
  assert.match(js, /response\.status === 401 \|\| response\.status === 403/);
  assert.match(js, /clearStoredAdminSession\(\)/);
  assert.doesNotMatch(js, /fetch\(`\$\{API_BASE_URL\}\/admin\/(?:categories|tags|products\/\$\{productId\}\/metadata)/);
});

test('new SKU UI preserves explicit zero and defaults blank stock to 50', () => {
  assert.match(js, /stockText === "" \? 50 : Number\(stockText\)/);
  assert.match(js, /available_stock: availableStock/);
});
