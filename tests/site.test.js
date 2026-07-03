import test from 'node:test';
import assert from 'node:assert/strict';

import { getCollections, getProducts, getSiteCopy } from '../src/content.js';

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

test('products expose per-item sales counts', () => {
  const products = getProducts();

  assert.ok(products.every((item) => typeof item.sales === 'string' && item.sales.length > 0));
  assert.equal(new Set(products.map((item) => item.sales)).size, products.length);
});
