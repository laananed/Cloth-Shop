import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import { getAuthCheckoutContract, getCollections, getPersonalCenterContract, getProducts, getSiteCopy } from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';
import { resetScrollPositionToTop } from '../src/sidebar-ui.js';
import {
  getCartItemTotal,
  getCartTotals,
  getProductSalesRows,
  getStoredCart,
  getStoredAdminProducts,
  getStoredFavorites,
  getStoredMockOrders,
  getStoredProfile,
  getSalesSummary,
  addAdminProduct,
  renderAdminOrdersView,
  renderAdminProductsView,
  renderAdminStatsView,
  renderOrderItems,
  renderSavedProductItems,
  saveStoredCart,
  saveStoredAdminProducts,
  saveStoredFavorites,
  saveStoredMockOrders,
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

test('shoe products keep the full shoe visible in the preview', () => {
  const products = getProducts();
  const shoeProducts = products.filter((item) => item.category === '鞋子');

  assert.equal(shoeProducts.length, 4);
  assert.ok(shoeProducts.every((item) => item.imageFit === 'contain'));
  assert.ok(shoeProducts.every((item) => item.imageFocus === undefined));
  assert.ok(shoeProducts.every((item) => item.imageZoom === undefined));
});

test('stocking products keep the full silhouette visible in the preview', () => {
  const products = getProducts();
  const stockingProducts = products.filter((item) => item.category === '丝袜');

  assert.equal(stockingProducts.length, 4);
  assert.ok(stockingProducts.every((item) => item.imageFit === 'contain'));
  assert.ok(stockingProducts.every((item) => item.imageFocus === undefined));
  assert.ok(stockingProducts.every((item) => item.imageZoom === undefined));
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

test('first product uses the new price-sales-rank detail layout', () => {
  const products = getProducts();

  assert.equal(products.length, 20);
  assert.equal(products[0].detailLayout, 'price-sales-rank');
  assert.ok(products.slice(1).every((item) => item.detailLayout === 'split'));
  assert.ok(products.every((item) => item.purchaseLayout === 'buy'));
});

test('purchase cards hide text on the icon action buttons', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('getFavoriteIcon'));
  assert.ok(mainJs.includes('getCartIcon'));
  assert.ok(mainJs.includes('aria-label="加入收藏夹"'));
  assert.ok(mainJs.includes('aria-label="加入购物车"'));
  assert.ok(!mainJs.includes('<span>加入收藏夹</span>'));
  assert.ok(!mainJs.includes('<span>加入购物车</span>'));
  assert.ok(mainJs.includes('立即购买'));
});

test('hero background supports the page portrait overlay', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('--hero-image'));
  assert.ok(mainJs.includes('--page-portrait'));
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
  assert.ok(html.includes('data-sidebar-nav'));
  assert.ok(html.includes('data-sidebar-panel-account'));
  assert.ok(html.includes('data-sidebar-panel-address'));
  assert.ok(html.includes('data-sidebar-panel-orders'));
  assert.ok(html.includes('data-sidebar-panel-favorites'));
  assert.ok(html.includes('data-sidebar-panel-cart'));
  assert.ok(html.includes('data-sidebar-account'));
  assert.ok(html.includes('data-sidebar-address'));
  assert.ok(html.includes('data-sidebar-orders'));
  assert.ok(html.includes('data-sidebar-favorites'));
  assert.ok(html.includes('data-sidebar-cart'));
  assert.ok(html.includes('data-cart-summary'));
  assert.ok(html.includes('data-menu-open'));
  assert.ok(html.includes('data-menu-close'));
});

test('personal data contract exposes account address order favorite and cart fields', () => {
  const contract = getPersonalCenterContract();

  assert.deepEqual(contract.account.fields, ['email', 'displayName']);
  assert.deepEqual(contract.address.fields, ['recipientName', 'phone', 'province', 'city', 'detail']);
  assert.ok(contract.orders.fields.includes('orderNo'));
  assert.ok(contract.orders.fields.includes('status'));
  assert.ok(contract.orders.fields.includes('items'));
  assert.deepEqual(contract.favorites.fields, ['id', 'name', 'price', 'badge']);
  assert.deepEqual(contract.cart.fields, ['id', 'name', 'price', 'quantity']);
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

  assert.equal(orders.emptyState, '鏆傛棤璐拱璁板綍');
  assert.deepEqual(orders.items, []);
});

test('favorite and cart shelves round-trip through storage', () => {
  const storage = createMemoryStorage();
  const favorites = [{ id: 'product-01', name: '示例收藏', price: 299, badge: '主推' }];
  const cart = [{ id: 'product-02', name: '示例购物车', price: 289, quantity: 2 }];

  saveStoredFavorites(storage, favorites);
  saveStoredCart(storage, cart);

  assert.deepEqual(getStoredFavorites(storage), favorites);
  assert.deepEqual(getStoredCart(storage), cart);
});

test('cart item totals and summary totals are calculated from quantity', () => {
  const cart = [
    { id: 'product-01', price: 299, quantity: 1 },
    { id: 'product-02', price: 199, quantity: 3 },
  ];

  assert.equal(getCartItemTotal(cart[0]), 299);
  assert.equal(getCartItemTotal(cart[1]), 597);

  const totals = getCartTotals(cart);

  assert.equal(totals.distinctItems, 2);
  assert.equal(totals.totalQuantity, 4);
  assert.equal(totals.totalAmount, 896);
});

test('saved product shelves render an empty state when there are no items', () => {
  const rendered = renderSavedProductItems([], '暂无数据');

  assert.equal(rendered.emptyState, '暂无数据');
  assert.deepEqual(rendered.items, []);
});

test('sidebar updates reset the scroll position to the top', () => {
  const sidebarPanel = {
    scrollTop: 240,
    scrollLeft: 18,
  };
  let didRun = false;

  resetScrollPositionToTop(sidebarPanel, () => {
    didRun = true;
    sidebarPanel.scrollTop = 12;
    sidebarPanel.scrollLeft = 3;
  });

  assert.equal(didRun, true);
  assert.equal(sidebarPanel.scrollTop, 0);
  assert.equal(sidebarPanel.scrollLeft, 0);
});

test('admin storage seeds mock products and mock orders', () => {
  const storage = createMemoryStorage();
  const products = getStoredAdminProducts(storage);
  const orders = getStoredMockOrders(storage);

  assert.ok(products.length > 0);
  assert.ok(orders.length > 0);
});

test('sales summary aggregates total revenue and units', () => {
  const products = [
    { id: 'a', name: 'A', price: 100 },
    { id: 'b', name: 'B', price: 200 },
  ];
  const orders = [
    { orderNo: 'O1', items: [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }] },
  ];

  const summary = getSalesSummary(products, orders);

  assert.equal(summary.totalRevenue, 400);
  assert.equal(summary.totalUnitsSold, 3);
});

test('product sales rows aggregate per product sales and revenue', () => {
  const products = [
    { id: 'a', name: 'A', price: 100 },
    { id: 'b', name: 'B', price: 200 },
  ];
  const orders = [
    { orderNo: 'O1', items: [{ id: 'a', quantity: 2 }, { id: 'b', quantity: 1 }] },
    { orderNo: 'O2', items: [{ id: 'a', quantity: 1 }] },
  ];

  const rows = getProductSalesRows(products, orders);

  assert.deepEqual(rows.map((row) => row.id), ['a', 'b']);
  assert.equal(rows[0].unitsSold, 3);
  assert.equal(rows[0].revenue, 300);
  assert.equal(rows[1].unitsSold, 1);
  assert.equal(rows[1].revenue, 200);
});

test('admin page exposes order create and stats shells', () => {
  const html = readFileSync('admin.html', 'utf8');

  assert.ok(html.includes('data-admin-nav-orders'));
  assert.ok(html.includes('data-admin-nav-products'));
  assert.ok(html.includes('data-admin-nav-stats'));
  assert.ok(html.includes('data-admin-orders-table'));
  assert.ok(html.includes('data-admin-product-form'));
  assert.ok(html.includes('data-admin-stats-summary'));
});

test('admin orders view prepares rows for the table shell', () => {
  const storage = createMemoryStorage();
  const products = getStoredAdminProducts(storage);
  const orders = getStoredMockOrders(storage);

  const rendered = renderAdminOrdersView(products, orders);

  assert.ok(rendered.rows.length > 0);
  assert.equal(typeof rendered.rows[0].orderNo, 'string');
  assert.equal(typeof rendered.rows[0].amountLabel, 'string');
});

test('admin stats view prepares KPI cards and ranking rows', () => {
  const rendered = renderAdminStatsView(
    {
      totalRevenue: 400,
      totalOrders: 1,
      totalProducts: 2,
      totalUnitsSold: 3,
    },
    [
      { id: 'a', name: 'A', unitsSold: 3, revenue: 300 },
      { id: 'b', name: 'B', unitsSold: 1, revenue: 100 },
    ],
  );

  assert.equal(rendered.kpis.length, 4);
  assert.equal(rendered.rows.length, 2);
  assert.equal(rendered.rows[0].barWidth, '100%');
});

test('new admin product can be appended and persisted', () => {
  const storage = createMemoryStorage();
  const initial = getStoredAdminProducts(storage);
  const next = addAdminProduct(storage, {
    name: '新款连衣裙',
    category: '连衣裙',
    price: 399,
    image: './assets/products/product-12.png',
  });

  assert.equal(next.length, initial.length + 1);
  assert.equal(getStoredAdminProducts(storage).at(-1).name, '新款连衣裙');
});

test('admin product view prepares cards for the product list', () => {
  const storage = createMemoryStorage();
  const products = getStoredAdminProducts(storage);
  const rendered = renderAdminProductsView(products);

  assert.ok(rendered.rows.length > 0);
  assert.equal(typeof rendered.rows[0].name, 'string');
  assert.equal(typeof rendered.rows[0].priceLabel, 'string');
});

test('front page exposes a visible admin entry point', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('href="./admin.html"'));
  assert.ok(html.includes('管理后台'));
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
