import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const migrationPath = new URL('../11_catalog_metadata_favorites_tags.sql', import.meta.url);

function migrationSql() {
  return fs.readFileSync(migrationPath, 'utf8');
}

test('catalog metadata migration uses information_schema for repeatable column changes', () => {
  const sql = migrationSql();
  assert.match(sql, /information_schema\.COLUMNS/i);
  assert.match(sql, /product[\s\S]*description/i);
  assert.match(sql, /order_main[\s\S]*buyer_remark/i);
  assert.doesNotMatch(sql, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS/i);
});

test('catalog metadata migration creates product favorites and tag relations with unique keys', () => {
  const sql = migrationSql();
  assert.match(sql, /CREATE TABLE IF NOT EXISTS product_favorite/i);
  assert.match(sql, /UNIQUE KEY[^\n]*user[^\n]*product/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS product_tag\s*\(/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS product_tag_relation/i);
  assert.match(sql, /UNIQUE KEY[^\n]*product[^\n]*tag/i);
});

test('catalog metadata migration seeds protected uncategorized and six required categories idempotently', () => {
  const sql = migrationSql();
  for (const name of ['无分类', '日常轻搭', '幻夜出行', '东风和韵', '纯白礼赞', '主题限定', '海岛假日']) {
    assert.ok(sql.includes(name), `missing category seed: ${name}`);
  }
  assert.match(sql, /ON DUPLICATE KEY UPDATE/i);
  assert.match(sql, /is_protected/i);
});

test('catalog metadata migration extends operation log without recording sensitive payloads', () => {
  const sql = migrationSql();
  for (const column of ['operator_type', 'operator_id', 'module', 'action', 'target_type', 'target_id', 'request_method', 'request_path', 'result', 'summary']) {
    assert.match(sql, new RegExp(column, 'i'));
  }
  assert.doesNotMatch(sql, /request_body|authorization|password|token_value/i);
});

test('catalog metadata migration rebuilds product detail view with description and tags', () => {
  const sql = migrationSql();
  assert.match(sql, /CREATE OR REPLACE VIEW v_product_detail/i);
  assert.match(sql, /p\.description AS description/i);
  assert.match(sql, /GROUP_CONCAT\s*\(\s*DISTINCT\s+t\.name/i);
  assert.match(sql, /FROM product_tag_relation/i);
});

test('catalog metadata migration does not rewrite inventory orders images or product rows', () => {
  const sql = migrationSql();
  assert.doesNotMatch(sql, /\b(?:DELETE|TRUNCATE)\b/i);
  assert.doesNotMatch(sql, /UPDATE\s+(?:inventory|order_main|product_image|product)\b/i);
  assert.doesNotMatch(sql, /INSERT\s+INTO\s+(?:inventory|order_main|product_image|product)\b/i);
});
