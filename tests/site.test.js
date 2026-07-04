import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getAuthCheckoutContract, getCollections, getProducts, getSiteCopy } from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';
import { loadStoredProfile, saveStoredProfile, validateRegistration } from '../src/account-state.js';

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

test('auth and checkout contract exposes the expected shapes', () => {
  const contract = getAuthCheckoutContract();

  assert.equal(contract.auth.loginMethod, 'email-password');
  assert.equal(contract.address.mode, 'single-default');
  assert.ok(contract.user.fields.includes('email'));
  assert.ok(contract.user.fields.includes('password'));
  assert.ok(contract.address.fields.includes('recipientName'));
  assert.ok(contract.address.fields.includes('phone'));
  assert.ok(contract.address.fields.includes('province'));
  assert.ok(contract.address.fields.includes('city'));
  assert.ok(contract.address.fields.includes('detail'));
});

test('page exposes login and register entry points', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-auth-entry'));
  assert.ok(html.includes('data-login-panel'));
  assert.ok(html.includes('data-register-panel'));
  assert.ok(html.includes('data-auth-toggle'));
});

test('checkout page exposes a saved-address form', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-checkout-entry'));
  assert.ok(html.includes('data-address-form'));
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
    user: { email: 'demo@example.com' },
    address: {
      recipientName: '小蓝',
      phone: '13800000000',
      province: '广东省',
      city: '广州市',
      detail: '天河区某街道 88 号',
    },
  };

  saveStoredProfile(storage, profile);

  assert.deepEqual(loadStoredProfile(storage), profile);
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
