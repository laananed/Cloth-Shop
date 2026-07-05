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

test('collections expose the expanded category rail', () => {
  const collections = getCollections();

  assert.equal(collections.length, 9);
  assert.deepEqual(collections.map((item) => item.title), [
    '鞋子',
    '帽子',
    '丝袜',
    '连衣裙',
    '上衣',
    '短裙',
    '首饰',
    '头饰',
    '包包',
  ]);
});

test('products render a curated set of twenty items', () => {
  const products = getProducts();

  assert.equal(products.length, 20);
  assert.ok(products.every((item) => typeof item.price === 'number' && item.price > 0));
  assert.equal(new Set(products.map((item) => item.category)).size, 9);
  assert.ok(products.every((item) => typeof item.image === 'string' && item.image.startsWith('./assets/products/')));
});

test('product preview images are present in the workspace', () => {
  const products = getProducts();

  assert.equal(products.length, 20);

  for (const product of products) {
    const fileName = product.image.replace(/^\.\//, '');
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
  const salesValue = (sales) => {
    const normalized = String(sales).trim().toLowerCase();

    if (normalized.endsWith('k')) {
      return Math.round(Number.parseFloat(normalized.slice(0, -1)) * 1000);
    }

    return Number.parseInt(normalized, 10);
  };
  const highest = [...products].sort((left, right) => salesValue(right.sales) - salesValue(left.sales))[0];
  const lowest = [...products].sort((left, right) => salesValue(left.sales) - salesValue(right.sales))[0];

  assert.equal(rankMap.size, products.length);
  assert.equal(rankMap.get(highest.id), 1);
  assert.equal(rankMap.get(lowest.id), products.length);
  assert.equal(formatSalesRank(rankMap.get(highest.id)).includes(String(rankMap.get(highest.id))), true);
});

test('auth modal shell stays closed on load', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-auth-modal'));
  assert.ok(html.includes('data-auth-tab-login'));
  assert.ok(html.includes('data-auth-tab-register'));
  assert.ok(html.includes('data-auth-close'));
  assert.ok(!html.includes('class="auth-modal is-open"'));
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

test('homepage keeps a continuous background while restoring the lead-in screen', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(html.includes('class="lead-screen"'));
  assert.ok(html.includes('data-hero-section'));
  assert.ok(html.includes('data-hero-title'));
  assert.ok(html.includes('data-hero-intro'));
  assert.ok(!html.includes('class="auth-modal is-open"'));
  assert.ok(mainJs.includes('heroBackgroundUrl'));
  assert.ok(mainJs.includes("new URL('../assets/hero-background.png', import.meta.url).href"));
  assert.equal(existsSync('assets/hero-background.png'), true);
  assert.ok(mainJs.includes('setInitialScrollPosition'));
  assert.ok(mainJs.includes('scrollRestoration'));
  assert.ok(mainJs.includes('scheduleHeroScrollState'));
  assert.ok(mainJs.includes('updateHeroScrollState'));
  assert.ok(!mainJs.includes('bg=page'));
  assert.ok(!mainJs.includes('openAuthModal();'));
  assert.ok(styles.includes('.hero {'));
  assert.ok(styles.includes('.lead-screen'));
  assert.ok(styles.includes('body::before'));
  assert.ok(styles.includes('body::after'));
  assert.ok(styles.includes('content: none;'));
  assert.ok(styles.includes('min-height: 100vh'));
  assert.ok(styles.includes('text-align: center'));
  assert.ok(styles.includes('background-size: cover'));
  assert.ok(styles.includes('.hero__content'));
});

test('homepage fades hero UI while later sections keep the pale blue wash', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(mainJs.includes('--hero-copy-opacity'));
  assert.ok(mainJs.includes('--hero-copy-shift'));
  assert.ok(mainJs.includes('--hero-copy-scale'));
  assert.ok(mainJs.includes('--hero-topbar-opacity'));
  assert.ok(mainJs.includes('--hero-topbar-shift'));
  assert.ok(mainJs.includes('--hero-topbar-scale'));
  assert.ok(styles.includes('opacity: var(--hero-copy-opacity'));
  assert.ok(styles.includes('scale(var(--hero-copy-scale'));
  assert.ok(styles.includes('translateY(var(--hero-copy-shift'));
  assert.ok(styles.includes('opacity: var(--hero-topbar-opacity'));
  assert.ok(styles.includes('scale(var(--hero-topbar-scale'));
  assert.ok(styles.includes('var(--hero-topbar-shift'));
  assert.ok(styles.includes('.section::before'));
  assert.ok(styles.includes('rgba(220, 239, 252, 0.34)'));
  assert.ok(styles.includes('body::before'));
  assert.ok(styles.includes('opacity: 1;'));
  assert.ok(!styles.includes('filter: saturate(0.84) brightness(1.12) contrast(0.96) blur(0.2px);'));
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
