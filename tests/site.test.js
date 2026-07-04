import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getAuthCheckoutContract, getCollections, getPersonalCenterContract, getProducts, getSiteCopy } from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';
import {
  getStoredProfile,
  renderOrderItems,
  saveStoredProfile,
  validateRegistration,
} from '../src/account-store.js';

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

test('auth modal opens on load and replaces the inline auth section', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-auth-modal'));
  assert.ok(html.includes('data-auth-tab-login'));
  assert.ok(html.includes('data-auth-tab-register'));
  assert.ok(html.includes('data-auth-close'));
  assert.ok(!html.includes('data-auth-entry'));
});

test('site exposes a personal sidebar shell', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-sidebar'));
  assert.ok(html.includes('data-sidebar-account'));
  assert.ok(html.includes('data-sidebar-address'));
  assert.ok(html.includes('data-sidebar-orders'));
  assert.ok(html.includes('data-menu-open'));
  assert.ok(html.includes('data-menu-close'));
});

test('personal data contract exposes account address and order fields', () => {
  const contract = getPersonalCenterContract();

  assert.deepEqual(contract.account.fields, ['email', 'displayName']);
  assert.deepEqual(contract.address.fields, ['recipientName', 'phone', 'province', 'city', 'detail']);
  assert.ok(contract.orders.fields.includes('orderNo'));
  assert.ok(contract.orders.fields.includes('status'));
  assert.ok(contract.orders.fields.includes('items'));
});

test('sidebar exposes an editable address form', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-sidebar-address-form'));
  assert.ok(html.includes('name="recipientName"'));
  assert.ok(html.includes('name="phone"'));
  assert.ok(html.includes('name="province"'));
  assert.ok(html.includes('name="city"'));
  assert.ok(html.includes('name="detail"'));
});

test('registration validation rejects mismatched passwords', () => {
  const result = validateRegistration({
    email: 'demo@example.com',
    password: '123456',
    confirmPassword: '654321',
  });

  assert.equal(result.ok, false);
  assert.equal(result.error, 'password-mismatch');
});

test('stored profile round-trips through storage', () => {
  const storage = createMemoryStorage();
  const profile = {
    user: {
      email: 'demo@example.com',
      displayName: '小蓝',
    },
    address: {
      recipientName: '小蓝',
      phone: '13800000000',
      province: '广东省',
      city: '广州市',
      detail: '天河区某街道 88 号',
    },
  };

  saveStoredProfile(storage, profile);

  assert.deepEqual(getStoredProfile(storage), profile);
});

test('orders panel renders an empty state when there are no orders', () => {
  const orders = renderOrderItems([]);

  assert.equal(orders.emptyState, '暂无购买记录');
  assert.deepEqual(orders.items, []);
});

function createMemoryStorage() {
  const data = new Map();

  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}
