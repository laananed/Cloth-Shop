import test from 'node:test';
import assert from 'node:assert/strict';

import { getCollections, getProducts, getSiteCopy } from '../src/content.js';

test('site copy keeps the one-page brand-led direction', () => {
  const copy = getSiteCopy();

  assert.equal(copy.brandName, '蓝屿织梦');
  assert.match(copy.slogan, /二次元/);
  assert.equal(copy.primaryCta, '浏览新品');
  assert.equal(copy.secondaryCta, '查看风格');
});

test('collections expose exactly three style entrances', () => {
  const collections = getCollections();

  assert.equal(collections.length, 3);
  assert.deepEqual(collections.map((item) => item.title), ['学院风', '洛丽塔', '日常甜系']);
});

test('products render a curated set of eight items', () => {
  const products = getProducts();

  assert.equal(products.length, 8);
  assert.ok(products.every((item) => item.price > 0));
  assert.ok(products.some((item) => item.badge === '主推'));
});
