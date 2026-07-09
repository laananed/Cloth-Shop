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
import { compareProductsBySales, formatSalesRank, getSalesRankMap, parseSalesValue } from '../src/ranking.js';
import {
  compareProductsForCustomer,
  getProductUnavailableAt,
  isProductSellable,
  parseDateTimeValue,
} from '../src/product-ordering.js';
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

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = endMarker ? source.indexOf(endMarker, start >= 0 ? start : 0) : source.length;

  return source.slice(start, end);
}

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
  assert.ok(mainJs.includes('openPurchaseModal'));
  assert.ok(mainJs.includes('renderPurchaseModal'));
  assert.ok(mainJs.includes('createDirectOrderFromApi'));
  assert.ok(mainJs.includes('data-purchase-launch="buy"'));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'favorites')"));
});

test('purchase modal source keeps product selection before derived state', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderStart = mainJs.indexOf('function renderPurchaseModal() {');
  const renderEnd = mainJs.indexOf("async function openPurchaseModal(product, action = 'buy') {", renderStart);

  assert.ok(renderStart >= 0);
  assert.ok(renderEnd > renderStart);

  const renderBody = mainJs.slice(renderStart, renderEnd);
  const productIndex = renderBody.indexOf('const product = activePurchaseProduct;');
  const selectedSkuIndex = renderBody.indexOf('const selectedSku = getPurchaseSelectedSku(product);');
  const productStateIndex = renderBody.indexOf('getProductDisplayState(product)');
  const selectedSkuOnSaleIndex = renderBody.indexOf('selectedSkuOnSale');
  const addressToggleIndex = renderBody.indexOf('purchaseAddressSection.hidden = !actionConfig.showAddress;');
  const paymentToggleIndex = renderBody.indexOf('purchasePaymentSection.hidden = !actionConfig.showPayment;');

  assert.ok(productIndex >= 0);
  assert.ok(selectedSkuIndex >= 0);
  assert.ok(productStateIndex >= 0);
  assert.ok(selectedSkuOnSaleIndex >= 0);
  assert.ok(addressToggleIndex >= 0);
  assert.ok(paymentToggleIndex >= 0);
  assert.ok(productIndex < productStateIndex);
  assert.ok(selectedSkuIndex < selectedSkuOnSaleIndex);
});

test('purchase modal routes actions through the shared selection flow', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderModalBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");
  const addCartBody = sliceBetween(mainJs, 'async function addCartToApi(product, selectedSku = null, quantity = 1, { openSidebarAfterSuccess = true } = {}) {', 'function normalizePayMethod(method) {');
  const favoriteBody = sliceBetween(mainJs, 'function upsertFavorite(product, selectedSku = null, { openSidebarAfterSuccess = true } = {}) {', 'function upsertCartItem(product) {');
  const directOrderBody = sliceBetween(mainJs, 'async function createDirectOrderFromApi(product, quantity = 1, skuIdFromModal = null) {', 'function openSidebar(section = \'account\') {');
  const buyBranchStart = mainJs.indexOf("if (actionButton.dataset.purchaseLaunch === 'buy') {");
  const buyBranchEnd = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'favorites') {", buyBranchStart);
  const buyBranchBody = mainJs.slice(buyBranchStart, buyBranchEnd);
  const favoritesBranchStart = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'favorites') {");
  const favoritesBranchEnd = mainJs.indexOf("// if (actionButton.dataset.sidebarLaunch === 'cart') {", favoritesBranchStart);
  const favoritesBranchBody = mainJs.slice(favoritesBranchStart, favoritesBranchEnd);
  const cartBranchStart = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'cart') {", favoritesBranchStart);
  const cartBranchEnd = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'checkout') {", cartBranchStart);
  const cartBranchBody = mainJs.slice(cartBranchStart, cartBranchEnd);

  assert.ok(mainJs.includes('activePurchaseAction'));
  assert.ok(mainJs.includes('getPurchaseActionConfig'));
  assert.ok(mainJs.includes('canOpenProductActionModal'));
  assert.ok(mainJs.includes('purchaseAddressSection.hidden = !actionConfig.showAddress;'));
  assert.ok(mainJs.includes('purchasePaymentSection.hidden = !actionConfig.showPayment;'));
  assert.ok(mainJs.includes('purchaseTotalSection.hidden = !actionConfig.showTotal;'));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'favorites')"));
  assert.ok(mainJs.includes('addCartToApi(activePurchaseProduct, selectedSku, quantity, { openSidebarAfterSuccess: false })'));
  assert.ok(mainJs.includes('upsertFavorite(activePurchaseProduct, selectedSku, { openSidebarAfterSuccess: false })'));
  assert.match(
    mainJs,
    /createDirectOrderFromApi\(\s*activePurchaseProduct,\s*quantity,\s*selectedSku\?\.(?:skuId)\s*\)/,
  );
  assert.ok(mainJs.includes('请先选择商品规格。'));

  assert.ok(!renderModalBody.includes('skuList.length <= 1'));
  assert.ok(renderModalBody.includes('purchaseSkuOptions.innerHTML = skuList'));
  assert.ok(renderModalBody.includes('暂无可选规格'));
  assert.ok(renderModalBody.includes('purchaseSubmit.textContent = product'));

  assert.ok(addCartBody.includes('const actualSelectedSku = selectedSku || null;'));
  assert.ok(addCartBody.includes('const skuId = actualSelectedSku?.skuId;'));
  assert.ok(addCartBody.includes('quantity: nextQuantity'));
  assert.ok(addCartBody.includes('openSidebarAfterSuccess'));
  assert.ok(!addCartBody.includes('getPurchaseSelectedSku(product)'));

  assert.ok(favoriteBody.includes('const actualSelectedSku = selectedSku || null;'));
  assert.ok(favoriteBody.includes('const favoriteId = `${product.id}-sku-${actualSelectedSku.skuId}`;'));
  assert.ok(favoriteBody.includes('skuId: actualSelectedSku.skuId'));
  assert.ok(favoriteBody.includes('skuName: actualSelectedSku.skuName || \'默认规格\''));
  assert.ok(!favoriteBody.includes('favorites.some((item) => item.id === product.id)'));

  assert.ok(directOrderBody.includes('const selectedSku = skuList.find((sku) => Number(sku.skuId) === Number(skuIdFromModal)) || null;'));
  assert.ok(directOrderBody.includes('const skuId = selectedSku?.skuId;'));
  assert.ok(directOrderBody.includes('throw new Error("请先选择商品规格。")'));
  assert.ok(!directOrderBody.includes('getActionSelectedSku(product)'));

  assert.ok(buyBranchBody.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(favoritesBranchBody.includes("openPurchaseModal(product, 'favorites')"));
  assert.ok(cartBranchBody.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(!buyBranchBody.includes('validateSkuBeforeProductAction'));
  assert.ok(!favoritesBranchBody.includes('validateSkuBeforeProductAction'));
  assert.ok(!cartBranchBody.includes('validateSkuBeforeProductAction'));
});

test('purchase button click handling does not require a sidebar action hook', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes("event.target.closest('button')"));
  assert.ok(mainJs.indexOf("dataset.purchaseLaunch === 'buy'") < mainJs.indexOf("dataset.sidebarLaunch === 'favorites'"));
});

test('scroll tools route sidebar and page scrolling through the right targets', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const indexHtml = readFileSync('index.html', 'utf8');
  const adminHtml = readFileSync('admin.html', 'utf8');
  const initScrollToolsBody = sliceBetween(mainJs, 'function initScrollTools() {', 'function initAdminPage() {');

  assert.ok(mainJs.includes('function getActiveSidebarScrollContainer()'));
  assert.ok(mainJs.includes('.sidebar__panel'));
  assert.ok(initScrollToolsBody.includes('sidebarPanel.scrollTo({'));
  assert.ok(mainJs.includes('window.scrollTo({'));
  assert.ok(mainJs.includes('[data-scroll-to]'));
  assert.ok(mainJs.includes('scrollHeight'));
  assert.ok(mainJs.includes('sidebar.classList.contains(\'is-open\')'));
  assert.ok(indexHtml.includes('data-scroll-tools'));
  assert.ok(adminHtml.includes('data-scroll-tools'));
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

test('sellable products sort ahead of unavailable ones and keep sales ordering inside the sellable group', () => {
  const products = [
    {
      id: 'product-1',
      productId: 1,
      sales: 20,
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-01T08:00:00',
      skuList: [
        { skuId: 11, skuStatus: 'ON_SALE', availableStock: 3, inventoryUpdatedAt: '2026-07-01T08:00:00' },
      ],
    },
    {
      id: 'product-2',
      productId: 2,
      sales: '10',
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-01T08:00:00',
      skuList: [
        { skuId: 21, skuStatus: 'ON_SALE', availableStock: 4, inventoryUpdatedAt: '2026-07-01T08:00:00' },
      ],
    },
    {
      id: 'product-3',
      productId: 3,
      sales: 999,
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-04T10:00:00',
      skuList: [
        { skuId: 31, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-01T08:00:00' },
      ],
    },
    {
      id: 'product-4',
      productId: 4,
      sales: 888,
      productStatus: 'OFF_SALE',
      productUpdatedAt: '2026-07-05T10:00:00',
      skuList: [
        { skuId: 41, skuStatus: 'OFF_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-02T08:00:00' },
      ],
    },
    {
      id: 'product-5',
      productId: 5,
      sales: 1,
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-06T10:00:00',
      skuList: [
        { skuId: 51, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-08T12:00:00' },
      ],
    },
  ];

  assert.equal(parseSalesValue('5.2k'), 5200);
  assert.equal(parseSalesValue(12), 12);
  assert.equal(isProductSellable(products[0]), true);
  assert.equal(isProductSellable(products[1]), true);
  assert.equal(isProductSellable(products[2]), false);
  assert.equal(isProductSellable(products[3]), false);
  assert.equal(isProductSellable(products[4]), false);
  assert.equal(parseDateTimeValue('2026-07-01T08:00:00'), Date.parse('2026-07-01T08:00:00'));
  assert.deepEqual([...products].sort(compareProductsForCustomer).map((product) => product.id), ['product-1', 'product-2', 'product-3', 'product-4', 'product-5']);
  assert.ok(getProductUnavailableAt(products[2]) < getProductUnavailableAt(products[3]));
  assert.ok(getProductUnavailableAt(products[3]) < getProductUnavailableAt(products[4]));
  assert.equal(formatSalesRank(2), '销量第2名');
});

test('multi-sku products stay sellable while any on-sale sku has stock and use the latest inventory update when sold out', () => {
  const sellableProduct = {
    id: 'product-6',
    productId: 6,
    sales: 10,
    productStatus: 'ON_SALE',
    productUpdatedAt: '2026-07-02T09:00:00',
    skuList: [
      { skuId: 61, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-03T09:00:00' },
      { skuId: 62, skuStatus: 'ON_SALE', availableStock: 5, inventoryUpdatedAt: '2026-07-04T09:00:00' },
    ],
  };
  const soldOutProduct = {
    id: 'product-7',
    productId: 7,
    sales: 10,
    productStatus: 'ON_SALE',
    productUpdatedAt: '2026-07-02T09:00:00',
    skuList: [
      { skuId: 71, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-03T09:00:00' },
      { skuId: 72, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-04T09:00:00' },
    ],
  };

  assert.equal(isProductSellable(sellableProduct), true);
  assert.equal(isProductSellable(soldOutProduct), false);
  assert.equal(getProductUnavailableAt(soldOutProduct), Date.parse('2026-07-04T09:00:00'));
  assert.deepEqual([sellableProduct, soldOutProduct].sort(compareProductsForCustomer).map((product) => product.id), ['product-6', 'product-7']);
});

test('backend product queries expose inventory_updated_at from the view', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(backend.includes('inventory_updated_at'));
  assert.ok(backend.includes('get("/products")'));
  assert.ok(backend.includes('get("/admin/inventory")'));
  assert.ok(backend.includes('post("/admin/inventory/update-stock")'));
  assert.ok(backend.includes('post("/admin/products/update-status")'));
  assert.ok(backend.includes('post("/products")'));
  assert.ok(mainJs.includes('getSalesRankMap(products)'));
  assert.ok(mainJs.includes("salesRankLabel = isTopSeller"));
  assert.ok(!mainJs.includes('暂不可售'));
});

test('sales rank labels use the full catalog while sorting still keeps sellable products first', () => {
  const products = [
    {
      id: 'product-1',
      productId: 1,
      sales: 100,
      productStatus: 'OFF_SALE',
      productUpdatedAt: '2026-07-01T10:00:00',
      skuList: [
        { skuId: 11, skuStatus: 'OFF_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-01T10:00:00' },
      ],
    },
    {
      id: 'product-2',
      productId: 2,
      sales: 80,
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-02T10:00:00',
      skuList: [
        { skuId: 21, skuStatus: 'ON_SALE', availableStock: 0, inventoryUpdatedAt: '2026-07-02T10:00:00' },
      ],
    },
    {
      id: 'product-3',
      productId: 3,
      sales: 60,
      productStatus: 'ON_SALE',
      productUpdatedAt: '2026-07-03T10:00:00',
      skuList: [
        { skuId: 31, skuStatus: 'ON_SALE', availableStock: 2, inventoryUpdatedAt: '2026-07-03T10:00:00' },
      ],
    },
  ];

  const sorted = [...products].sort(compareProductsForCustomer);
  const rankMap = getSalesRankMap(products);

  assert.deepEqual(sorted.map((product) => product.id), ['product-3', 'product-1', 'product-2']);
  assert.equal(rankMap.get('product-1'), 1);
  assert.equal(rankMap.get('product-2'), 2);
  assert.equal(rankMap.get('product-3'), 3);
  assert.equal(formatSalesRank(rankMap.get('product-3')), '销量第3名');
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

test('admin product management source includes logical delete wiring', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(mainJs.includes('async function deleteAdminProductToApi(productId)'));
  assert.ok(mainJs.includes('data-admin-product-delete-id'));
  assert.ok(mainJs.includes('确定要删除这个商品吗？删除后前台和后台默认商品列表将不再显示，但历史订单数据不会被物理删除。'));
  assert.ok(mainJs.includes('await refreshAdminProductsFromApi();'));
  assert.ok(backend.includes('@app.post("/admin/products/delete")'));
  assert.ok(backend.includes('AdminProductDeleteRequest'));
  assert.ok(backend.includes("SET is_deleted = 1, status = 'OFF_SALE'"));
  assert.ok(backend.includes('WHERE product_id = %s'));
});

test('admin orders source is wired to database orders and not mock render helpers', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('@app.get("/admin/orders")') || mainJs.includes('/admin/orders'));
  assert.ok(mainJs.includes('async function loadAdminOrdersFromApi()'));
  assert.ok(mainJs.includes('function renderAdminOrders('));
  assert.ok(mainJs.includes('async function refreshAdminOrdersFromApi()'));
  assert.ok(mainJs.includes('data-admin-orders-body'));
  assert.ok(mainJs.includes('REFUNDED'));
  assert.ok(mainJs.includes('已退款'));

  const adminOrdersSectionStart = mainJs.indexOf('async function loadAdminOrdersFromApi()');
  const adminOrdersSectionEnd = mainJs.indexOf('function convertApiStatsToRenderedStats(result)', adminOrdersSectionStart);
  const adminOrdersSection = mainJs.slice(adminOrdersSectionStart, adminOrdersSectionEnd);

  assert.ok(adminOrdersSectionStart >= 0);
  assert.ok(adminOrdersSectionEnd > adminOrdersSectionStart);
  assert.ok(!adminOrdersSection.includes('getStoredMockOrders(storage)'));
  assert.ok(!adminOrdersSection.includes('renderAdminOrdersView(products, orders)'));
});

test('admin order detail and ship source wiring is present', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const html = readFileSync('admin.html', 'utf8');

  assert.ok(backend.includes('query_order_detail('));
  assert.ok(backend.includes('@app.get("/admin/orders/{order_id}")'));
  assert.ok(backend.includes('@app.post("/admin/orders/ship")'));
  assert.ok(backend.includes('AdminShipOrderRequest'));
  assert.ok(backend.includes('FOR UPDATE'));
  assert.ok(backend.includes("status IN ('PAID', 'SHIPPED', 'COMPLETED', 'REFUND_REQUESTED')"));
  assert.ok(backend.includes('require_admin_user(authorization)'));

  assert.ok(mainJs.includes('loadAdminOrderDetailFromApi'));
  assert.ok(mainJs.includes('shipAdminOrderToApi'));
  assert.ok(mainJs.includes('data-admin-order-detail-id'));
  assert.ok(mainJs.includes('data-admin-order-ship-id'));
  assert.ok(mainJs.includes('data-admin-order-detail-container'));
  assert.ok(mainJs.includes('data-admin-order-refund-approve-id'));
  assert.ok(mainJs.includes('data-admin-order-refund-reject-id'));
  assert.ok(mainJs.includes('approveAdminRefundToApi'));
  assert.ok(mainJs.includes('rejectAdminRefundToApi'));
  assert.ok(mainJs.includes('REFUND_REQUESTED'));

  assert.ok(html.includes('操作'));
});

test('admin order unship source wiring is present', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(backend.includes('AdminUnshipOrderRequest'));
  assert.ok(backend.includes('@app.post("/admin/orders/unship")'));
  assert.ok(backend.includes('ADMIN_UNSHIP_ORDER'));
  assert.ok(backend.includes("UPDATE order_main SET status = 'PAID'"));
  assert.ok(backend.includes('取消发货成功'));

  assert.ok(mainJs.includes('unshipAdminOrderToApi'));
  assert.ok(mainJs.includes('renderAdminOrderStatusBadge'));
  assert.ok(mainJs.includes('data-admin-order-unship-id'));
  assert.ok(mainJs.includes('无法发货'));
  assert.ok(mainJs.includes('取消发货'));
  assert.ok(mainJs.includes('activeAdminOrderDetailId = null'));
  assert.ok(mainJs.includes('data-admin-order-refund-approve-id'));
  assert.ok(mainJs.includes('data-admin-order-refund-reject-id'));
  assert.ok(mainJs.includes('REFUND_REQUESTED'));
  assert.ok(mainJs.includes('退款待处理'));

  assert.ok(styles.includes('.admin-status-badge'));
  assert.ok(styles.includes('.admin-status-badge--shipped'));
  assert.ok(styles.includes('.admin-status-badge--paid'));
  assert.ok(styles.includes('.admin-status-badge--pending'));
  assert.ok(styles.includes('.admin-status-badge--refund-requested'));
});

test('admin order status labels include shipped and the orders table keeps the operation column', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const html = readFileSync('admin.html', 'utf8');
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(mainJs.includes('SHIPPED'));
  assert.ok(mainJs.includes('已发货'));
  assert.ok(mainJs.includes('REFUND_REQUESTED'));
  assert.ok(mainJs.includes('退款待处理'));
  assert.ok(html.includes('<th>操作</th>'));
  assert.ok(backend.includes("status IN ('PAID', 'SHIPPED', 'COMPLETED', 'REFUND_REQUESTED')"));
});

test('admin product filtering source wiring is present', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(html.includes('data-admin-product-filter-bar'));
  assert.ok(html.includes('data-admin-product-summary') && html.includes('hidden'));
  assert.ok(mainJs.includes('activeAdminProductFilter'));
  assert.ok(mainJs.includes('data-admin-product-filter'));
  assert.ok(mainJs.includes('SOLD_OUT'));
  assert.ok(mainJs.includes('OFF_SALE'));
  assert.ok(mainJs.includes('ON_SALE'));
  assert.ok(mainJs.includes('productSummary.hidden = true'));
});

test('admin product search source wiring is present', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(html.includes('data-admin-product-search'));
  assert.ok(html.includes('data-admin-product-search-clear'));
  assert.ok(mainJs.includes('activeAdminProductSearchKeyword'));
  assert.ok(mainJs.includes('getAdminProductSearchText'));
  assert.ok(mainJs.includes('matchesAdminProductSearch'));
  assert.ok(mainJs.includes('data-admin-product-search'));
  assert.ok(mainJs.includes('data-admin-product-search-clear'));
  assert.ok(mainJs.includes('getFilteredAdminProductRows(rows)'));
  assert.ok(mainJs.includes('matchesAdminProductSearch(row)'));
  assert.ok(styles.includes('.admin-product-search'));
  assert.ok(styles.includes('.admin-product-search__input'));
});

test('admin authentication source wiring is present', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const sql = readFileSync('07_create_admin_user.sql', 'utf8');

  assert.ok(backend.includes('@app.post("/admin/login")'));
  assert.ok(backend.includes('AdminLoginRequest'));
  assert.ok(backend.includes('require_admin_user('));
  assert.ok(backend.includes('Header(None)'));
  assert.ok(backend.includes('@app.get("/admin/orders")'));
  assert.ok(backend.includes('@app.get("/admin/stats")'));
  assert.ok(backend.includes('@app.get("/admin/inventory")'));
  assert.ok(backend.includes('@app.post("/admin/inventory/update-stock")'));
  assert.ok(backend.includes('@app.post("/admin/products/update-status")'));
  assert.ok(backend.includes('@app.post("/admin/products/delete")'));
  assert.ok(backend.includes('@app.post("/products")'));
  assert.ok(backend.includes('require_admin_user(authorization)'));

  assert.ok(html.includes('data-admin-login-panel'));
  assert.ok(html.includes('data-admin-login-form'));
  assert.ok(html.includes('data-admin-login-feedback'));
  assert.ok(html.includes('data-admin-login-email'));
  assert.ok(html.includes('data-admin-login-password'));
  assert.ok(html.includes('data-admin-current-user'));
  assert.ok(html.includes('data-admin-logout'));
  assert.ok(html.includes('data-admin-shell'));
  assert.ok(html.includes('./src/styles.css?v=20260709-admin-auth-state'));
  assert.ok(html.includes('./src/main.js?v=20260709-admin-auth-state'));

  assert.ok(mainJs.includes('ADMIN_SESSION_STORAGE_KEY'));
  assert.ok(mainJs.includes('getStoredAdminSession'));
  assert.ok(mainJs.includes('saveStoredAdminSession'));
  assert.ok(mainJs.includes('clearStoredAdminSession'));
  assert.ok(mainJs.includes('getAdminAuthHeaders'));
  assert.ok(mainJs.includes('adminFetch'));
  assert.ok(mainJs.includes('loginAdmin'));
  assert.ok(mainJs.includes('renderAdminAuthState'));
  assert.ok(mainJs.includes('requireAdminSessionBeforeLoading'));
  assert.ok(mainJs.includes('sessionStorage'));
  assert.ok(mainJs.includes('/admin/login'));
  assert.ok(mainJs.includes('Authorization'));

  assert.ok(styles.includes('.admin-login'));
  assert.ok(styles.includes('.admin-login__panel'));
  assert.ok(styles.includes('.admin-login__form'));
  assert.ok(styles.includes('.admin-login__feedback'));
  assert.ok(styles.includes('.admin-user-chip'));

  assert.ok(sql.includes('admin@example.com'));
  assert.ok(sql.includes('admin123456'));
  assert.ok(sql.includes('is_admin'));
});

test('admin auth hidden UI state is enforced by CSS and source state', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const authStateBody = sliceBetween(mainJs, 'function renderAdminAuthState', 'async function loginAdmin');

  assert.ok(html.includes('data-admin-login-home'));
  assert.match(html, /<a[^>]+class="admin-login__home-link"[^>]+href="\.\/index\.html"[^>]+data-admin-login-home[\s\S]*?返回前台[\s\S]*?<\/a>/);
  assert.match(html, /<button[^>]+data-admin-logout[^>]+hidden[^>]+disabled[^>]*>/);
  assert.match(
    styles,
    /\.admin-login\[hidden\],[\s\S]*?\.admin-shell\[hidden\],[\s\S]*?\.admin-user-chip\[hidden\],[\s\S]*?\[data-admin-logout\]\[hidden\]\s*\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/,
  );
  assert.ok(styles.includes('.admin-login__home-link'));
  assert.ok(mainJs.includes('function getAdminIdentityLabel('));
  assert.ok(mainJs.includes('function setAdminIdentityVisible('));
  assert.ok(authStateBody.includes('adminLoginPanel.hidden = isLoggedIn'));
  assert.ok(authStateBody.includes('adminShell.hidden = !isLoggedIn'));
  assert.ok(authStateBody.includes('adminLogoutButton.hidden = !isLoggedIn'));
  assert.ok(authStateBody.includes('adminLogoutButton.disabled = !isLoggedIn'));
  assert.ok(authStateBody.includes("adminLogoutButton.setAttribute('aria-hidden', String(!isLoggedIn))"));
  assert.ok(authStateBody.includes('setAdminIdentityVisible(isLoggedIn, session)'));
  assert.ok(authStateBody.includes("document.body.classList.toggle('is-admin-authenticated', isLoggedIn)"));
});

test('admin initialization binds controls before session-gated loading', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const initStart = mainJs.indexOf('function initAdminPage() {');
  const initEnd = mainJs.indexOf('initScrollTools();', initStart);
  const initBody = mainJs.slice(initStart, initEnd);
  const sessionCheckIndex = initBody.indexOf('const hasAdminSession = requireAdminSessionBeforeLoading();');
  const loginBindingIndex = initBody.indexOf("adminLoginForm.addEventListener('submit'");
  const logoutBindingIndex = initBody.indexOf("adminLogoutButton.addEventListener('click'");
  const navBindingIndex = initBody.indexOf("navButtons.forEach((button) =>");

  assert.ok(initStart >= 0);
  assert.ok(initEnd > initStart);
  assert.ok(sessionCheckIndex >= 0);
  assert.ok(loginBindingIndex >= 0 && loginBindingIndex < sessionCheckIndex);
  assert.ok(logoutBindingIndex >= 0 && logoutBindingIndex < sessionCheckIndex);
  assert.ok(navBindingIndex >= 0 && navBindingIndex < sessionCheckIndex);
  assert.doesNotMatch(
    initBody,
    /renderProducts\(\);\s*refreshAdminOrdersFromApi\(\);\s*refreshAdminStatsFromApi\(\);/,
  );
});

test('admin auth state clears dashboard data on logout and auth failure', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const initStart = mainJs.indexOf('function initAdminPage() {');
  const initEnd = mainJs.indexOf('initScrollTools();', initStart);
  const initBody = mainJs.slice(initStart, initEnd);
  const clearStart = mainJs.indexOf('function clearAdminDashboardData(');
  const clearEnd = mainJs.indexOf('function getAdminAuthHeaders()', clearStart);
  const clearBody = mainJs.slice(clearStart, clearEnd);
  const logoutStart = initBody.indexOf("adminLogoutButton.addEventListener('click'");
  const logoutEnd = initBody.indexOf('});', logoutStart);
  const logoutBody = initBody.slice(logoutStart, logoutEnd);

  assert.ok(mainJs.includes('function clearAdminDashboardData('));
  assert.ok(mainJs.includes('ordersBody.innerHTML = `<tr><td colspan="7">'));
  assert.ok(mainJs.includes('statsSummary.innerHTML = \'\';'));
  assert.ok(mainJs.includes('statsRows.innerHTML = \'\';'));
  assert.ok(mainJs.includes('productList.innerHTML = `<div class="admin-empty">'));
  assert.ok(mainJs.includes('function resetAdminDashboardState()'));
  assert.ok(clearStart >= 0);
  assert.ok(clearEnd > clearStart);
  assert.doesNotMatch(clearBody, /\borders\s*=\s*\[\]/);
  assert.doesNotMatch(clearBody, /\bsummary\s*=\s*null/);
  assert.ok(initBody.includes('resetAdminDashboardState();'));
  assert.ok(initBody.includes("renderAdminAuthState('请先登录管理员账号')"));
  assert.ok(mainJs.includes('renderAdminAuthState(\'已退出管理员账号，请重新登录。\')'));
  assert.ok(mainJs.includes('function setAdminIdentityVisible('));
  assert.ok(mainJs.includes('node.hidden = !isLoggedIn'));
  assert.ok(mainJs.includes('node.textContent = label'));
  assert.ok(initStart >= 0);
  assert.ok(initEnd > initStart);
  assert.ok(initBody.includes('const dashboardTargets = {'));
  assert.ok(initBody.includes('clearAdminDashboardData(dashboardTargets);'));
  assert.ok(logoutStart >= 0);
  assert.ok(logoutBody.includes('clearStoredAdminSession();'));
  assert.ok(logoutBody.includes('resetAdminDashboardState();'));
  assert.ok(logoutBody.includes("renderAdminAuthState('已退出管理员账号，请重新登录。')"));
  assert.doesNotMatch(logoutBody, /loadAdminDashboardFromApi|refreshAdminData/);
  assert.ok(initBody.includes('if (hasAdminSession) {'));
  assert.ok(initBody.includes('} else {'));
  assert.ok(initBody.includes("activePanel = button.dataset.adminNavTarget || 'orders';"));
  assert.ok(initBody.includes('syncPanels();'));
});

test('refund request backend wiring is present in source', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(backend.includes('RefundOrderRequest'));
  assert.ok(backend.includes('@app.post("/orders/refund")'));
  assert.ok(backend.includes('REFUND_REQUESTED'));
  assert.ok(backend.includes('order_status_log'));
  assert.ok(backend.includes('payment_record'));
  assert.ok(backend.includes('product_sales_stat'));
  assert.ok(backend.includes('REFUND_RESTORE'));
  assert.ok(backend.includes('@app.post("/admin/orders/refund/approve")'));
  assert.ok(backend.includes('@app.post("/admin/orders/refund/reject")'));
  assert.ok(backend.includes('ADMIN_APPROVE_REFUND'));
  assert.ok(backend.includes('ADMIN_REJECT_REFUND'));
});

test('cart invalid-item source wiring is present', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(backend.includes('product_status'));
  assert.ok(backend.includes('product_is_deleted'));
  assert.ok(backend.includes('sku_status'));
  assert.ok(backend.includes('sku_is_deleted'));
  assert.ok(mainJs.includes('function getCartItemInvalidReason(item)'));
  assert.ok(mainJs.includes('function isCartItemCheckoutable(item)'));
  assert.ok(mainJs.includes('function getInvalidCartItems(cartItems)'));
  assert.ok(mainJs.includes('cart-item--invalid'));
  assert.ok(mainJs.includes('cart-item__warning'));
  assert.ok(mainJs.includes('商品已下架'));
  assert.ok(mainJs.includes('商品已删除'));
  assert.ok(mainJs.includes('当前规格已下架'));
  assert.ok(mainJs.includes('当前规格已删除'));
  assert.ok(mainJs.includes('库存不足'));
  assert.ok(mainJs.includes('getInvalidCartItems(selectedCartItems)'));
  assert.ok(mainJs.includes('getCartItemInvalidReason(item)'));
  assert.ok(styles.includes('.cart-item--invalid'));
  assert.ok(styles.includes('.cart-item__warning'));
});

test('frontend purchase record refund wiring is present', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('REFUND_REQUESTED'));
  assert.ok(mainJs.includes('退款待处理'));
  assert.ok(mainJs.includes('data-order-refund-id'));
  assert.ok(mainJs.includes('refundOrderFromApi'));
  assert.ok(mainJs.includes('handleRefundOrder'));
  assert.ok(mainJs.includes('refundingOrderIds'));
  assert.ok(mainJs.includes('/orders/refund'));
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

