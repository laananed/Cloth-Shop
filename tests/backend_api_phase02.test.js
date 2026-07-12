import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const backend = fs.readFileSync(new URL('../backend/app/main.py', import.meta.url), 'utf8');

test('products expose description tags and images from database-backed helpers', () => {
  assert.match(backend, /def query_product_tags\(/);
  assert.match(backend, /row\["tags"\]/);
  assert.match(backend, /description,/);
  assert.match(backend, /attach_product_metadata\(conn, rows\)/);
});

test('new SKU stock defaults to 50 while explicit zero remains valid', () => {
  assert.match(backend, /available_stock: int \| None = Form\(None\)/);
  assert.match(backend, /available_stock if available_stock is not None else 50/);
  assert.match(backend, /row\.get\("available_stock", 50\)/);
});

test('backend provides product-level favorite CRUD', () => {
  assert.match(backend, /@app\.get\("\/favorites\/user\/\{user_id\}"\)/);
  assert.match(backend, /@app\.post\("\/favorites"\)/);
  assert.match(backend, /@app\.delete\("\/favorites\/\{product_id\}"\)/);
  assert.match(backend, /UNIQUE KEY|ON DUPLICATE KEY UPDATE/);
});

test('admin catalog APIs remain bearer protected and use transactions', () => {
  for (const route of ['/admin/categories', '/admin/tags', '/admin/tags/bulk', '/admin/products/{product_id}/metadata', '/admin/products/{product_id}/images/reorder']) {
    assert.ok(backend.includes(route), `missing route ${route}`);
  }
  assert.match(backend, /class BulkTagRequest/);
  assert.match(backend, /require_admin_user\(authorization\)/);
  assert.match(backend, /conn\.commit\(\)/);
  assert.match(backend, /conn\.rollback\(\)/);
});

test('buyer remarks and payment idempotency are enforced separately', () => {
  assert.match(backend, /buyer_remark: str \| None/);
  assert.match(backend, /UPDATE order_main\s+SET buyer_remark = %s/i);
  assert.match(backend, /SELECT status\s+FROM order_main\s+WHERE id = %s AND user_id = %s\s+FOR UPDATE/i);
  assert.match(backend, /if order_state\["status"\] == "PAID"/);
});

test('safe operation logging never controls business transaction success', () => {
  assert.match(backend, /def write_operation_log\(/);
  assert.match(backend, /except Exception as log_error:/);
  assert.match(backend, /print\(f"operation log write failed:/);
  assert.match(backend, /@app\.get\("\/admin\/operation-logs"\)/);
});
