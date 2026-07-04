import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { getCollections, getProducts, getSiteCopy } from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';

test('site copy keeps the one-page brand-led direction', () => {
  const copy = getSiteCopy();

  assert.equal(typeof copy.brandName, 'string');
  assert.equal(typeof copy.slogan, 'string');
});

test('collections expose exactly three style entrances', () => {
  const collections = getCollections();

  assert.equal(collections.length, 3);
  assert.ok(collections.every((item) => typeof item.title === 'string' && item.title.length > 0));
});

test('products render a curated set of eight items', () => {
  const products = getProducts();

  assert.equal(products.length, 8);
  assert.ok(products.every((item) => item.price > 0));
});

test('product preview images are present in the workspace', () => {
  for (let index = 1; index <= 8; index += 1) {
    const fileName = `assets/products/product-${String(index).padStart(2, '0')}.png`;
    assert.equal(existsSync(fileName), true, `${fileName} should exist`);
  }
});

test('products expose per-item sales counts', () => {
  const products = getProducts();

  assert.ok(products.every((item) => typeof item.sales === 'string' && item.sales.length > 0));
  assert.equal(new Set(products.map((item) => item.sales)).size, products.length);
});

test('sales ranks are derived from the highest sales first', () => {
  const products = getProducts();
  const rankMap = getSalesRankMap(products);

  assert.equal(rankMap.get('product-3'), 1);
  assert.equal(rankMap.get('product-5'), 2);
  assert.equal(rankMap.get('product-1'), 3);
  assert.equal(formatSalesRank(rankMap.get('product-3')), '销量第1名');
});
