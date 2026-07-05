import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  getAuthCheckoutContract,
  getCollections,
  getPersonalCenterContract,
  getProducts,
  getSiteCopy,
} from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';
import {
  buildPurchaseOrder,
  getStoredAddressBook,
  getStoredCart,
  getStoredFavorites,
  getStoredProfile,
  renderOrderItems,
  renderSavedProductItems,
  saveStoredAddressBook,
  saveStoredCart,
  saveStoredFavorites,
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
  assert.ok(mainJs.includes('data-purchase-launch'));
  assert.ok(mainJs.includes('data-purchase-modal'));
  assert.ok(mainJs.includes('data-purchase-total'));
  assert.ok(!mainJs.includes('<span>加入收藏夹</span>'));
  assert.ok(!mainJs.includes('<span>加入购物车</span>'));
  assert.ok(mainJs.includes('立即购买'));
});

test('hero background supports the page portrait overlay', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('--hero-image'));
  assert.ok(mainJs.includes('--page-portrait'));
});

test('purchase flow exposes modal hooks in the source and markup', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(html.includes('data-purchase-modal'));
  assert.ok(html.includes('data-purchase-close'));
  assert.ok(html.includes('data-purchase-address-list'));
  assert.ok(html.includes('data-purchase-payment-options'));
  assert.ok(mainJs.includes('data-purchase-launch'));
  assert.ok(mainJs.includes('data-purchase-total'));
});

test('purchase button click handling does not require a sidebar action hook', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes("event.target.closest('button')"));
  assert.ok(mainJs.indexOf("dataset.purchaseLaunch === 'buy'") < mainJs.indexOf("dataset.sidebarLaunch === 'favorites'"));
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
  assert.ok(html.includes('data-menu-open'));
  assert.ok(html.includes('data-menu-close'));
});

test('site exposes a purchase modal shell', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.ok(html.includes('data-purchase-modal'));
  assert.ok(html.includes('data-purchase-close'));
  assert.ok(html.includes('data-purchase-address-list'));
  assert.ok(html.includes('data-purchase-quantity-decrease'));
  assert.ok(html.includes('data-purchase-quantity-increase'));
  assert.ok(html.includes('data-purchase-payment-options'));
  assert.ok(html.includes('data-purchase-total'));
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

test('address book migrates legacy single address into a default address entry', () => {
  const storage = createMemoryStorage();

  saveStoredProfile(storage, {
    user: {
      email: 'demo@example.com',
      displayName: 'Demo User',
    },
    address: {
      recipientName: 'Demo User',
      phone: '13800000000',
      province: 'Guangdong',
      city: 'Guangzhou',
      detail: 'No. 88 Example Road',
    },
  });

  const book = getStoredAddressBook(storage);

  assert.equal(book.addresses.length, 1);
  assert.equal(book.defaultAddressId, 'address-1');
  assert.equal(book.addresses[0].isDefault, true);
  assert.equal(book.addresses[0].recipientName, 'Demo User');
});

test('address book round-trips multiple addresses through storage', () => {
  const storage = createMemoryStorage();
  const addressBook = {
    defaultAddressId: 'address-2',
    addresses: [
      {
        id: 'address-1',
        recipientName: 'Demo A',
        phone: '13800000000',
        province: 'Guangdong',
        city: 'Shenzhen',
        detail: 'Address line 1',
        isDefault: false,
      },
      {
        id: 'address-2',
        recipientName: 'Demo B',
        phone: '13900000000',
        province: 'Shanghai',
        city: 'Shanghai',
        detail: 'Address line 2',
        isDefault: true,
      },
    ],
  };

  saveStoredAddressBook(storage, addressBook);

  assert.deepEqual(getStoredAddressBook(storage), addressBook);
});

test('purchase orders capture selected address payment and total price', () => {
  const order = buildPurchaseOrder({
    product: {
      id: 'product-01',
      name: 'Sample Product',
      price: 299,
      badge: 'Featured',
    },
    quantity: 2,
    paymentMethod: 'alipay',
    address: {
      id: 'address-2',
      recipientName: 'Demo B',
      phone: '13900000000',
      province: 'Shanghai',
      city: 'Shanghai',
      detail: 'Address line 2',
      isDefault: true,
    },
  });

  assert.equal(order.status, '待支付');
  assert.equal(order.paymentMethod, 'alipay');
  assert.equal(order.quantity, 2);
  assert.equal(order.totalPrice, 598);
  assert.deepEqual(order.items, ['Sample Product × 2']);
  assert.equal(order.address.recipientName, 'Demo B');
  assert.equal(order.orderNo.startsWith('BUY-'), true);
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

test('favorite and cart shelves round-trip through storage', () => {
  const storage = createMemoryStorage();
  const favorites = [{ id: 'product-01', name: '示例收藏', price: 299, badge: '主推' }];
  const cart = [{ id: 'product-02', name: '示例购物车', price: 289, quantity: 2 }];

  saveStoredFavorites(storage, favorites);
  saveStoredCart(storage, cart);

  assert.deepEqual(getStoredFavorites(storage), favorites);
  assert.deepEqual(getStoredCart(storage), cart);
});

test('saved product shelves render an empty state when there are no items', () => {
  const rendered = renderSavedProductItems([], '暂无数据');

  assert.equal(rendered.emptyState, '暂无数据');
  assert.deepEqual(rendered.items, []);
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
