import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

import {
  getAdminImageOptions,
  getAuthCheckoutContract,
  getCollections,
  getPersonalCenterContract,
  getProducts,
  getSiteCopy,
} from '../src/content.js';
import { getSalesRankMap, formatSalesRank } from '../src/ranking.js';
import {
  buildPurchaseOrder,
  getCartItemTotal,
  getCartTotals,
  getProductSalesRows,
  getStoredAddressBook,
  getStoredCart,
  getStoredCartSelections,
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
  saveStoredAddressBook,
  saveStoredCart,
  saveStoredCartSelections,
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

test('collections expose the remixed six-theme rail without the removed sleepwear section', () => {
  const collections = getCollections();

  assert.equal(collections.length, 6);
  assert.deepEqual(collections.map((item) => item.title), ['日常轻搭', '幻夜出行', '东风和韵', '纯白礼赞', '主题限定', '海岛假日']);
});

test('products render a curated set of seventeen image-led items after unsafe listings are removed', () => {
  const products = getProducts();

  assert.equal(products.length, 17);
  assert.ok(products.every((item) => typeof item.price === 'number' && item.price > 0));
  assert.equal(new Set(products.map((item) => item.category)).size, 6);
  assert.ok(products.every((item) => typeof item.image === 'string' && item.image.startsWith('./assets/products/')));
  assert.equal(products.some((item) => item.id === 'product-17'), true);
  assert.equal(products.some((item) => ['product-18', 'product-19'].includes(item.id)), false);
  assert.equal(products.some((item) => /睡衣|泳衣|浴衣/.test(item.name)), false);
});

test('theme-limited products keep curated promo badges', () => {
  const products = getProducts();
  const themedProducts = products.filter((item) => item.category === '主题限定');

  assert.equal(themedProducts.length, 3);
  assert.ok(themedProducts.every((item) => typeof item.badge === 'string' && item.badge.length > 0));
});

test('site copy reflects the new seventeen-product catalog', () => {
  const copy = getSiteCopy();

  assert.match(copy.note, /17/);
  assert.match(copy.intro, /17/);
});

test('product preview images are present in the workspace', () => {
  const products = getProducts();

  assert.equal(products.length, 17);

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

test('all products use the new price-sales-rank detail layout', () => {
  const products = getProducts();

  assert.equal(products.length, 17);
  assert.ok(products.every((item) => item.detailLayout === 'price-sales-rank'));
  assert.ok(products.every((item) => item.purchaseLayout === 'buy'));
});

test('admin seed data includes the new image option and excludes removed products', () => {
  const imageOptions = getAdminImageOptions();
  const orders = getStoredMockOrders(createMemoryStorage());

  assert.equal(imageOptions.some((item) => item.id === 'product-17'), true);
  assert.equal(imageOptions.some((item) => ['product-18', 'product-19'].includes(item.id)), false);
  assert.equal(orders.some((order) => order.items.some((item) => ['product-18', 'product-19'].includes(item.id))), false);
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

test('product shelf uses adaptive desktop columns instead of restoring four narrow cards', () => {
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(styles, /\.product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(min\(100%,\s*320px\),\s*1fr\)\);/);
  assert.match(styles, /@media \(min-width:\s*1280px\)\s*\{[\s\S]*?\.product-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(styles, /\.product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
});

test('product card copy protects readable wrapping on desktop and mobile', () => {
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(styles, /\.product-card h3\s*\{[\s\S]*-webkit-line-clamp:\s*2;[\s\S]*overflow:\s*hidden;/);
  assert.match(styles, /\.product-card__detail\s*\{[\s\S]*overflow-wrap:\s*break-word;[\s\S]*word-break:\s*normal;/);
  assert.match(styles, /@media \(max-width:\s*1024px\)\s*\{[\s\S]*?\.product-card__detail-grid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
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

test('cart totals can be limited to selected items', () => {
  const cart = [
    { id: 'product-01', price: 299, quantity: 2 },
    { id: 'product-02', price: 289, quantity: 1 },
  ];

  const selectedTotals = getCartTotals(cart, ['product-01']);
  const emptySelectionTotals = getCartTotals(cart, []);

  assert.equal(selectedTotals.distinctItems, 1);
  assert.equal(selectedTotals.totalQuantity, 2);
  assert.equal(selectedTotals.totalAmount, 598);
  assert.deepEqual(emptySelectionTotals, {
    distinctItems: 0,
    totalQuantity: 0,
    totalAmount: 0,
  });
});

test('cart selections round-trip through storage', () => {
  const storage = createMemoryStorage();
  const selections = ['product-01', 'product-03'];

  saveStoredCartSelections(storage, selections);

  assert.deepEqual(getStoredCartSelections(storage), selections);
});

test('cart selection affordance is wired into the source', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');

  assert.ok(mainJs.includes('data-cart-select-id'));
  assert.ok(mainJs.includes('getStoredCartSelections'));
  assert.ok(mainJs.includes('saveStoredCartSelections'));
  assert.ok(css.includes('.cart-item__select'));
  assert.ok(css.includes('.cart-item.is-selected'));
});

test('saved product shelves render an empty state when there are no items', () => {
  const rendered = renderSavedProductItems([], '暂无数据');

  assert.equal(rendered.emptyState, '暂无数据');
  assert.deepEqual(rendered.items, []);
});

test('sidebar layout uses a fixed visual anchor across sections', () => {
  const css = readFileSync('src/styles.css', 'utf8');

  assert.match(css, /--sidebar-layout-anchor-offset:\s*144px;/);
  assert.match(css, /\.sidebar__panel\s*\{[\s\S]*?align-content:\s*start;/);
  assert.match(css, /\.sidebar__layout\s*\{[\s\S]*?margin-top:\s*var\(--sidebar-layout-anchor-offset\);/);
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

