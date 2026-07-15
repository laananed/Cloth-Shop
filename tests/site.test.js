import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

test('one-click launcher prefers the cloned backend virtual environment', () => {
  const launcher = readFileSync('start_dev.ps1', 'utf8');

  assert.ok(launcher.includes("Join-Path $backendDir '.venv\\Scripts\\python.exe'"));
  assert.ok(launcher.includes("Join-Path $rootDir '.venv\\Scripts\\python.exe'"));
});

test('frontend startup port stays aligned across launcher cors and readme', () => {
  const launcher = readFileSync('start_dev.ps1', 'utf8');
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const readme = readFileSync('README.md', 'utf8');

  assert.ok(launcher.includes("'http.server', '5900'"));
  assert.ok(launcher.includes('Wait-ForPort -Port 5900'));
  assert.ok(backend.includes('"http://127.0.0.1:5900"'));
  assert.ok(backend.includes('"http://localhost:5900"'));
  assert.ok(readme.includes('python -m http.server 5900'));
  assert.ok(readme.includes('http://127.0.0.1:5900/index.html'));
});

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
  resolveProductAvailabilityState,
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
import * as accountStore from '../src/account-store.js';
import {
  createImageLightboxState,
  normalizeLightboxImages,
  resolveLightboxIndex,
  wrapLightboxIndex,
} from '../src/image-lightbox.js';

function sliceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = endMarker ? source.indexOf(endMarker, start >= 0 ? start : 0) : source.length;

  return source.slice(start, end);
}

const mojibakeFragments = ['鐺', '锟', '鏂', '绾', '閿', '美亘', '闆', 'Ã', '�'];

function assertNoMojibake(source, fileName) {
  for (const fragment of mojibakeFragments) {
    assert.ok(!source.includes(fragment), `${fileName} should not contain mojibake fragment: ${fragment}`);
  }
}

test('[LIGHTBOX-12-1] image normalization removes invalid duplicates and keeps the main image first without mutation', () => {
  const product = {
    image_url: '/uploads/main.png',
    images: [
      null,
      { image_url: '  ' },
      { image_url: '/uploads/detail.png', sort_order: 2 },
      { image_url: '/uploads/main.png', is_main: 1, sort_order: 1 },
      { image_url: '/uploads/detail.png', sort_order: 3 },
      undefined,
    ],
  };
  const snapshot = structuredClone(product);

  const images = normalizeLightboxImages(product, 'http://127.0.0.1:8050');

  assert.deepEqual(images.map((image) => image.image_url), [
    'http://127.0.0.1:8050/uploads/main.png',
    'http://127.0.0.1:8050/uploads/detail.png',
  ]);
  assert.deepEqual(product, snapshot);
});

test('[LIGHTBOX-12-2] image normalization accepts a single fallback image and rejects an empty gallery', () => {
  assert.deepEqual(
    normalizeLightboxImages({ image: './assets/products/one.png' }),
    [{ id: null, image_url: './assets/products/one.png', is_main: 1, sort_order: 0 }],
  );
  assert.deepEqual(normalizeLightboxImages({ images: [null, '', {}] }), []);
});

test('[LIGHTBOX-12-3] selected indexes resolve safely and circular navigation never produces NaN', () => {
  const images = [{ image_url: 'a' }, { image_url: 'b' }, { image_url: 'c' }];

  assert.equal(resolveLightboxIndex(images, 'b'), 1);
  assert.equal(resolveLightboxIndex(images, 'missing'), 0);
  assert.equal(wrapLightboxIndex(3, -1), 2);
  assert.equal(wrapLightboxIndex(3, 3), 0);
  assert.equal(wrapLightboxIndex(1, 99), 0);
  assert.equal(wrapLightboxIndex(0, 99), 0);
});

test('[LIGHTBOX-12-4] unified lightbox state replaces gallery context and starts in a loading state', () => {
  const sourceElement = { focus() {} };
  const state = createImageLightboxState({
    product: {
      name: '海雾长裙',
      images: [{ image_url: 'first.webp' }, { image_url: 'second.webp' }],
    },
    selectedUrl: 'second.webp',
    sourceElement,
  });

  assert.equal(state.isOpen, true);
  assert.equal(state.context, '海雾长裙');
  assert.equal(state.index, 1);
  assert.equal(state.loading, true);
  assert.equal(state.error, false);
  assert.equal(state.sourceElement, sourceElement);
  assert.equal(createImageLightboxState({ product: { images: [] } }).isOpen, false);
});

test('site copy keeps only the brand title and the approved hero slogan', () => {
  const copy = getSiteCopy();

  assert.deepEqual(copy, {
    brandName: '汐雾衣橱',
    slogan: '把心动裁成裙摆，让每一次相遇都像动画开场。',
  });
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

test('homepage copy removes catalog statistics and keeps the streamlined sections', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const hero = sliceBetween(html, '<section class="hero"', '</section>');
  const productSection = sliceBetween(html, '<section class="section" id="products"', '</section>');
  const footer = sliceBetween(html, '<footer class="footer">', '</footer>');

  assert.ok(html.includes('少女心事，沿着海风轻轻上新'));
  assert.ok(hero.includes('把心动裁成裙摆，让每一次相遇都像动画开场。'));
  assert.ok(hero.includes('data-primary-cta'));
  assert.ok(hero.includes('data-secondary-cta'));
  assert.ok(!hero.includes('data-hero-intro'));
  assert.ok(!hero.includes('data-hero-note'));
  assert.ok(!hero.includes('图像重做'));
  assert.ok(!hero.includes('轻裁展示'));
  assert.ok(!hero.includes('清透配色 / 轻玻璃卡片 / 海天蓝渐变'));
  assert.ok(productSection.includes('<h2 id="products-title">新品商品</h2>'));
  assert.ok(!productSection.includes('保持轻盈但能卖'));
  assert.ok(!productSection.includes('轻互动展示，不打扰浏览'));
  assert.ok(!html.includes('data-product-count'));
  assert.ok(footer.includes('关于蓝笙织梦'));
  assert.ok(!footer.includes('配送提示'));
  assert.ok(!footer.includes('小红书'));
  assert.ok(!footer.includes('微博'));
  assert.ok(!footer.includes('B站'));
  assert.ok(!footer.includes('footer__utility'));
  assert.ok(!footer.includes('footer__social'));
  assert.ok(!mainJs.includes('productCountLabel'));
  assert.ok(!mainJs.includes('heroIntro'));
  assert.ok(!mainJs.includes('heroNote'));
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
  assert.ok(!mainJs.includes("openPurchaseModal(product, 'favorites')"));
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
  const paymentToggleIndex = renderBody.indexOf('purchasePaymentOptions.hidden = !actionConfig.showPayment;');

  assert.ok(productIndex >= 0);
  assert.ok(selectedSkuIndex >= 0);
  assert.ok(productStateIndex >= 0);
  assert.ok(selectedSkuOnSaleIndex >= 0);
  assert.ok(addressToggleIndex >= 0);
  assert.ok(paymentToggleIndex >= 0);
  assert.ok(productIndex < productStateIndex);
  assert.ok(selectedSkuIndex < selectedSkuOnSaleIndex);
});

test('purchase modal supports product image galleries without changing purchase actions', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(html.includes('data-purchase-modal'));
  assert.ok(html.includes('data-purchase-image'));
  assert.ok(html.includes('data-purchase-gallery'));
  assert.ok(mainJs.includes('function getProductImages('));
  assert.ok(mainJs.includes('product.images'));
  assert.ok(mainJs.includes('product.product_images'));
  assert.ok(mainJs.includes('data-purchase-gallery'));
  assert.ok(mainJs.includes('data-purchase-gallery-image'));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(!mainJs.includes("openPurchaseModal(product, 'favorites')"));
  assert.ok(styles.includes('.purchase-modal__gallery'));
  assert.ok(styles.includes('.purchase-modal__gallery-button.is-active'));
});

test('[LIGHTBOX-12-5] lightbox exposes one accessible dialog with stage loading error and live counter hooks', () => {
  const html = readFileSync('index.html', 'utf8');

  assert.match(html, /<div(?=[^>]*data-image-lightbox)(?=[^>]*hidden)(?=[^>]*aria-hidden="true")(?=[^>]*role="dialog")(?=[^>]*aria-modal="true")(?=[^>]*tabindex="-1")[^>]*>/);
  assert.ok(html.includes('data-image-lightbox-backdrop'));
  assert.ok(html.includes('data-image-lightbox-dialog'));
  assert.ok(html.includes('data-image-lightbox-stage'));
  assert.match(html, /data-image-lightbox-loading[^>]*hidden[^>]*>\s*图片加载中…/);
  assert.match(html, /data-image-lightbox-error[^>]*hidden[^>]*>\s*图片加载失败/);
  assert.match(html, /data-image-lightbox-image[^>]+alt=""/);
  assert.match(html, /data-image-lightbox-close[^>]+aria-label="关闭图片预览"/);
  assert.match(html, /data-image-lightbox-prev[^>]+aria-label="上一张图片"/);
  assert.match(html, /data-image-lightbox-next[^>]+aria-label="下一张图片"/);
  assert.match(html, /data-image-lightbox-counter[^>]+aria-live="polite"/);
  assert.ok(html.includes('data-image-lightbox-hint'));
  assert.equal((html.match(/data-image-lightbox(?:\s|=)/g) || []).length, 1);
  assert.doesNotMatch(sliceBetween(html, 'data-image-lightbox', '</div>\n    </div>'), /data-product-state-stamp|data-favorite|data-cart|data-purchase-price/);
});

test('[LIGHTBOX-12-6] lightbox styling uses a safe dynamic viewport checkerboard stage and non-overlapping controls', () => {
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(styles, /\.image-lightbox\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?inset:\s*0;[\s\S]*?z-index:\s*(?:[6-9]\d|\d{3,});/);
  assert.match(styles, /\.image-lightbox\s*\{[\s\S]*?height:\s*100vh;[\s\S]*?height:\s*100dvh;[\s\S]*?background:\s*rgba\(5,\s*10,\s*20,\s*0\.88\);/);
  assert.match(styles, /\.image-lightbox__stage\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*?grid-template-rows:\s*minmax\(0,\s*1fr\);[\s\S]*?linear-gradient[\s\S]*?background-size:\s*16px 16px;[\s\S]*?overflow:\s*hidden;/);
  assert.match(styles, /\.image-lightbox__viewer\s*\{[\s\S]*?grid-template-columns:\s*56px minmax\(0,\s*1fr\) 56px;/);
  assert.match(styles, /\.image-lightbox__image\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?max-height:\s*100%;[\s\S]*?object-fit:\s*contain;/);
  assert.match(styles, /body\.has-lightbox\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(styles, /@media \(max-width:\s*640px\)[\s\S]*?\.image-lightbox__viewer\s*\{[\s\S]*?grid-template-columns:\s*44px minmax\(0,\s*1fr\) 44px;/);
  assert.match(styles, /\.purchase-modal__image\s*\{[\s\S]*?cursor:\s*zoom-in;/);
});

test('[LIGHTBOX-12-7] lightbox owns one state object with race-safe loading preloading focus and cleanup', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const lightboxLogic = sliceBetween(
    mainJs,
    'function renderImageLightbox()',
    'function setPurchaseQuantity(nextQuantity)',
  );
  const keydownLogic = sliceBetween(
    mainJs,
    "window.addEventListener('keydown', (event) => {",
    "if ('scrollRestoration' in window.history)",
  );
  const closePurchaseLogic = sliceBetween(
    mainJs,
    'function closePurchaseModal()',
    'function renderImageLightbox()',
  );

  assert.ok(mainJs.includes("from './image-lightbox.js?v=20260715a'"));
  assert.ok(mainJs.includes('let lightboxState = createImageLightboxState();'));
  assert.ok(lightboxLogic.includes('createImageLightboxState'));
  assert.ok(lightboxLogic.includes('wrapLightboxIndex'));
  assert.ok(lightboxLogic.includes('lightboxState.requestId'));
  assert.ok(lightboxLogic.includes('new Image()'));
  assert.ok(lightboxLogic.includes('preloadAdjacentLightboxImages'));
  assert.ok(lightboxLogic.includes("document.body.classList.add('has-lightbox')"));
  assert.ok(lightboxLogic.includes("document.body.classList.remove('has-lightbox')"));
  assert.ok(lightboxLogic.includes('setLightboxBackgroundInert'));
  assert.ok(lightboxLogic.includes('restoreLightboxFocus'));
  assert.ok(lightboxLogic.includes("setFeedback(purchaseFeedback, '暂无可预览图片'"));
  assert.ok(closePurchaseLogic.includes('closeImageLightbox();'));
  assert.ok(mainJs.includes("purchaseImage.addEventListener('click', (event) => openImageLightbox(event.currentTarget))"));
  assert.ok(mainJs.includes("purchaseImage.addEventListener('keydown'"));
  assert.ok(mainJs.includes('event.target === event.currentTarget'));
  assert.ok(keydownLogic.includes('lightboxState.isOpen'));
  assert.ok(keydownLogic.includes("event.key === 'Escape'"));
  assert.ok(keydownLogic.includes("event.key === 'ArrowLeft'"));
  assert.ok(keydownLogic.includes("event.key === 'ArrowRight'"));
  assert.ok(keydownLogic.includes("event.key === 'Tab'"));
  assert.ok(keydownLogic.includes('trapImageLightboxFocus'));
  assert.equal((mainJs.match(/window\.addEventListener\('keydown'/g) || []).length, 1);
  assert.doesNotMatch(lightboxLogic, /openPurchaseModal\(|activePurchaseSkuId\s*=|activePurchaseQuantity\s*=|activePurchaseAddressId\s*=|activePurchasePaymentMethod\s*=/);
  assert.doesNotMatch(lightboxLogic, /window\.open\(/);
  assert.equal((mainJs.match(/function getProductImages\(/g) || []).length, 1);
});

test('[LIGHTBOX-12-8] lightbox keeps layered close behavior and excludes product state stamps', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const keydownLogic = sliceBetween(mainJs, "window.addEventListener('keydown', (event) => {", "if ('scrollRestoration' in window.history)");
  const lightboxLogic = sliceBetween(mainJs, 'function renderImageLightbox()', 'function setPurchaseQuantity(nextQuantity)');

  assert.ok(keydownLogic.indexOf('lightboxState.isOpen') < keydownLogic.indexOf("purchaseModal?.classList.contains('is-open')"));
  assert.match(keydownLogic, /closeImageLightbox\(\);\s*return;/);
  assert.doesNotMatch(lightboxLogic, /renderProductStateStamp|purchaseStateStamp|data-product-state-stamp/);
});
test('cart and buy route through the shared sku flow while favorites toggle directly', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderModalBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");
  const addCartBody = sliceBetween(mainJs, 'async function addCartToApi(product, selectedSku = null, quantity = 1) {', 'function normalizePayMethod(method) {');
  const favoriteBody = sliceBetween(mainJs, 'function toggleFavorite(product) {', 'function upsertCartItem(product) {');
  const directOrderBody = sliceBetween(mainJs, 'async function createDirectOrderFromApi(product, quantity = 1, skuIdFromModal = null, buyerRemark = null) {', 'function openSidebar(section = \'account\') {');
  const buyBranchStart = mainJs.indexOf("if (actionButton.dataset.purchaseLaunch === 'buy') {");
  const buyBranchEnd = mainJs.indexOf('if (actionButton.dataset.favoriteToggle !== undefined) {', buyBranchStart);
  const buyBranchBody = mainJs.slice(buyBranchStart, buyBranchEnd);
  const favoritesBranchStart = mainJs.indexOf('if (actionButton.dataset.favoriteToggle !== undefined) {');
  const favoritesBranchEnd = mainJs.indexOf("// if (actionButton.dataset.sidebarLaunch === 'cart') {", favoritesBranchStart);
  const favoritesBranchBody = mainJs.slice(favoritesBranchStart, favoritesBranchEnd);
  const cartBranchStart = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'cart') {", favoritesBranchStart);
  const cartBranchEnd = mainJs.indexOf("if (actionButton.dataset.sidebarLaunch === 'checkout') {", cartBranchStart);
  const cartBranchBody = mainJs.slice(cartBranchStart, cartBranchEnd);

  assert.ok(mainJs.includes('activePurchaseAction'));
  assert.ok(mainJs.includes('getPurchaseActionConfig'));
  assert.ok(mainJs.includes('canOpenProductActionModal'));
  assert.ok(mainJs.includes('purchaseAddressSection.hidden = !actionConfig.showAddress;'));
  assert.ok(mainJs.includes('purchasePaymentOptions.hidden = !actionConfig.showPayment;'));
  assert.ok(mainJs.includes('purchaseTotalSection.hidden = !actionConfig.showTotal;'));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(mainJs.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(!mainJs.includes("openPurchaseModal(product, 'favorites')"));
  assert.ok(mainJs.includes('addCartToApi(activePurchaseProduct, selectedSku, quantity)'));
  assert.ok(mainJs.includes('toggleProductFavorite(favorites, product)'));
  assert.match(
    mainJs,
    /createDirectOrderFromApi\(\s*activePurchaseProduct,\s*quantity,\s*selectedSku\?\.(?:skuId),\s*buyerRemark,\s*\)/,
  );
  assert.ok(mainJs.includes('请先选择商品规格。'));

  assert.ok(!renderModalBody.includes('skuList.length <= 1'));
  assert.ok(renderModalBody.includes('purchaseSkuOptions.innerHTML = skuList'));
  assert.ok(renderModalBody.includes('暂无可选规格'));
  assert.ok(renderModalBody.includes('purchaseSubmit.textContent = product'));

  assert.ok(addCartBody.includes('const actualSelectedSku = selectedSku || null;'));
  assert.ok(addCartBody.includes('const skuId = actualSelectedSku?.skuId;'));
  assert.ok(addCartBody.includes('quantity: nextQuantity'));
  assert.ok(!addCartBody.includes('openSidebar('));
  assert.ok(!addCartBody.includes('getPurchaseSelectedSku(product)'));

  assert.ok(favoriteBody.includes('getStoredFavorites(storage, products)'));
  assert.ok(favoriteBody.includes('isProductFavorited(favorites, product)'));
  assert.ok(favoriteBody.includes('saveStoredFavorites(storage, nextFavorites)'));
  assert.ok(!favoriteBody.includes('selectedSku'));

  assert.ok(directOrderBody.includes('const selectedSku = skuList.find((sku) => Number(sku.skuId) === Number(skuIdFromModal)) || null;'));
  assert.ok(directOrderBody.includes('const skuId = selectedSku?.skuId;'));
  assert.ok(directOrderBody.includes('throw new Error("请先选择商品规格。")'));
  assert.ok(!directOrderBody.includes('getActionSelectedSku(product)'));

  assert.ok(buyBranchBody.includes("openPurchaseModal(product, 'buy')"));
  assert.ok(favoritesBranchBody.includes('toggleFavorite(product)'));
  assert.ok(cartBranchBody.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(!buyBranchBody.includes('validateSkuBeforeProductAction'));
  assert.ok(!favoritesBranchBody.includes('validateSkuBeforeProductAction'));
  assert.ok(!cartBranchBody.includes('validateSkuBeforeProductAction'));
});

test('purchase button click handling does not require a sidebar action hook', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes("event.target.closest('button')"));
  assert.ok(mainJs.indexOf("dataset.purchaseLaunch === 'buy'") < mainJs.indexOf('dataset.favoriteToggle !== undefined'));
});

test('scroll tools route sidebar and page scrolling through the right targets', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const indexHtml = readFileSync('index.html', 'utf8');
  const adminHtml = readFileSync('admin.html', 'utf8');
  const initScrollToolsBody = sliceBetween(mainJs, 'function initScrollTools() {', 'function initAdminPage() {');

  assert.ok(mainJs.includes('function getActiveSidebarScrollContainer()'));
  assert.ok(mainJs.includes(".sidebar__content"));
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

test('[PRODUCT-STATE-11-1] product availability resolves available sold-out and off-sale from live sku data', () => {
  const availableProduct = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuStatus: 'ON_SALE', availableStock: 0 },
      { skuStatus: 'ON_SALE', availableStock: 3 },
    ],
  };
  const soldOutProduct = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuStatus: 'ON_SALE', availableStock: 0 },
      { skuStatus: 'ON_SALE', availableStock: -2 },
    ],
  };
  const offSaleProduct = {
    productStatus: 'OFF_SALE',
    skuList: [{ skuStatus: 'ON_SALE', availableStock: 8 }],
  };

  assert.equal(resolveProductAvailabilityState(availableProduct), 'AVAILABLE');
  assert.equal(resolveProductAvailabilityState(soldOutProduct), 'SOLD_OUT');
  assert.equal(resolveProductAvailabilityState(offSaleProduct), 'OFF_SALE');
  assert.equal(resolveProductAvailabilityState({ ...offSaleProduct, skuList: [{ skuStatus: 'ON_SALE', availableStock: 0 }] }), 'OFF_SALE');
  assert.equal(isProductSellable(availableProduct), true);
  assert.equal(isProductSellable(soldOutProduct), false);
});

test('[PRODUCT-STATE-11-2] sku sale state deletion and invalid stock follow the fixed priority rules', () => {
  assert.equal(resolveProductAvailabilityState({
    productStatus: 'ON_SALE',
    skuList: [
      { skuStatus: 'OFF_SALE', availableStock: 9 },
      { skuStatus: 'ON_SALE', availableStock: 4, skuIsDeleted: 1 },
    ],
  }), 'OFF_SALE');

  for (const invalidStock of [null, undefined, '', 'not-a-number', -1]) {
    assert.equal(resolveProductAvailabilityState({
      productStatus: 'ON_SALE',
      skuList: [{ skuStatus: 'ON_SALE', availableStock: invalidStock }],
    }), 'SOLD_OUT');
  }

  assert.equal(resolveProductAvailabilityState({
    productStatus: 'ON_SALE',
    skuList: [
      { skuStatus: 'ON_SALE', availableStock: 0, sku_is_deleted: 1 },
      { skuStatus: 'ON_SALE', availableStock: 2 },
    ],
  }), 'AVAILABLE');
});

test('[PRODUCT-STATE-11-3] static fallback products stay available and state resolution is pure', () => {
  const staticProduct = {
    id: 'product-static',
    name: '静态兜底商品',
    price: 99,
  };
  const snapshot = structuredClone(staticProduct);

  assert.equal(resolveProductAvailabilityState(staticProduct), 'AVAILABLE');
  assert.equal(resolveProductAvailabilityState({ ...staticProduct, saleState: 'OFF_SALE' }), 'OFF_SALE');
  assert.equal(resolveProductAvailabilityState({ ...staticProduct, saleState: 'SOLD_OUT' }), 'SOLD_OUT');
  assert.deepEqual(staticProduct, snapshot);
});

test('[PRODUCT-STATE-11-4] storefront favorite and detail views share stable state stamp contracts', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const stampBody = sliceBetween(mainJs, 'function renderProductStateStamp(', 'function getProductImages(');
  const renderProductsBody = sliceBetween(mainJs, 'function renderProducts() {', 'function updateView()');
  const favoritesBody = sliceBetween(mainJs, 'function renderFavoritesShelf(', 'function formatCartMoney(');
  const modalBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");

  assert.ok(mainJs.includes('resolveProductAvailabilityState'));
  assert.ok(renderProductsBody.includes('data-product-state="${productState.domValue}"'));
  assert.ok(renderProductsBody.includes("renderProductStateStamp(productState, 'card')"));
  assert.ok(favoritesBody.includes('data-product-state="${productState.domValue}"'));
  assert.ok(favoritesBody.includes("renderProductStateStamp(productState, 'favorite')"));
  assert.ok(stampBody.includes('data-product-state-stamp'));
  assert.match(html, /data-purchase-image-frame[\s\S]*data-product-state-stamp/);
  assert.ok(modalBody.includes('purchaseStateStamp'));
  assert.match(styles, /\.product-state-stamp\s*\{[\s\S]*?pointer-events:\s*none;[\s\S]*?transform:\s*rotate\(-8deg\);/);
  assert.ok(styles.includes('.product-state-stamp--sold-out'));
  assert.ok(styles.includes('.product-state-stamp--off-sale'));
});

test('[PRODUCT-STATE-11-5] unavailable purchase controls expose state-specific accessible labels', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderProductsBody = sliceBetween(mainJs, 'function renderProducts() {', 'function updateView()');
  const modalBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");

  assert.ok(renderProductsBody.includes('已售罄，暂不可加入购物车'));
  assert.ok(renderProductsBody.includes('商品已下架，暂不可购买'));
  assert.ok(renderProductsBody.includes('data-cart-state="${isInCart ? \'active\' : \'inactive\'}"'));
  assert.ok(modalBody.includes('productState.key !== "AVAILABLE"'));
  assert.ok(modalBody.includes('productState.label'));
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

test('backend product endpoints expose product image collections and accept multiple uploads', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(backend.includes('def query_product_images('));
  assert.ok(backend.includes('product_image'));
  assert.ok(backend.includes('images: list[UploadFile] | None = File(None)'));
  assert.ok(backend.includes('image_url'));
  assert.ok(backend.includes('image_count'));
  assert.ok(backend.includes('sort_order'));
  assert.ok(backend.includes('is_main'));
  assert.ok(backend.includes('"source": "product.image_url"'));
  assert.ok(backend.includes('FROM v_product_detail'));
});
test('backend and frontend source files do not contain obvious mojibake fragments', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assertNoMojibake(backend, 'backend/app/main.py');
  assertNoMojibake(mainJs, 'src/main.js');
  assert.ok(backend.includes('订单发货成功'));
  assert.ok(backend.includes('取消发货成功'));
  assert.ok(backend.includes('退款申请已提交'));
  assert.ok(backend.includes('退款已同意'));
  assert.ok(backend.includes('已拒绝退款申请'));
  assert.ok(backend.includes('管理员登录成功'));
  assert.ok(mainJs.includes('退款待处理'));
  assert.ok(mainJs.includes('同意退款'));
  assert.ok(mainJs.includes('拒绝退款'));
  assert.ok(mainJs.includes('无法发货'));
});

test('index html keeps the restored document structure and the search hook markup', () => {
  const html = readFileSync('index.html', 'utf8');
  const mojibakeFragments = ['?/title', '?/button', '?/p', '?/h3', '?/span', '?/strong', 'Ʒ', '֧Ʒ', '͹ؼ'];

  assert.ok(html.includes('<title>蓝笙织梦 · 二次元服装售卖首页</title>'));
  assert.ok(html.includes('./src/styles.css'));
  assert.ok(html.includes('./src/main.js'));
  assert.ok(html.includes('data-product-search'));
  assert.ok(html.includes('data-product-search-clear'));
  assert.ok(html.includes('data-product-grid'));
  assert.ok(!html.includes('data-product-count'));
  assert.ok(html.includes('data-active-collection'));
  assert.ok(html.includes('data-sidebar'));
  assert.ok(html.includes('data-purchase-modal'));
  assert.ok(html.includes('清空'));

  for (const fragment of mojibakeFragments) {
    assert.ok(!html.includes(fragment), `index.html should not contain mojibake fragment: ${fragment}`);
  }
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
  const purchaseCloseButton = html.match(/<button class="purchase-modal__close"[^>]*>([^<]*)<\/button>/);

  assert.ok(html.includes('data-purchase-modal'));
  assert.ok(html.includes('data-purchase-close'));
  assert.ok(html.includes('data-purchase-address-list'));
  assert.ok(html.includes('data-purchase-quantity-decrease'));
  assert.ok(html.includes('data-purchase-quantity-increase'));
  assert.ok(html.includes('data-purchase-payment-options'));
  assert.ok(html.includes('data-purchase-total'));
  assert.ok(purchaseCloseButton);
  assert.equal(purchaseCloseButton[1], '×');
  assert.ok(!purchaseCloseButton[1].includes('脳'));
  assert.match(purchaseCloseButton[0], /data-purchase-close/);
  assert.match(purchaseCloseButton[0], /aria-label="关闭"/);
});

test('homepage keeps a continuous background while restoring the lead-in screen', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.ok(html.includes('class="lead-screen"'));
  assert.ok(html.includes('data-hero-section'));
  assert.ok(html.includes('data-hero-title'));
  assert.ok(html.includes('data-hero-slogan'));
  assert.ok(!html.includes('data-hero-intro'));
  assert.ok(!html.includes('data-hero-note'));
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
  assert.match(styles, /\.hero p\s*\{[^}]*max-width:\s*52ch;/);
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
  assert.deepEqual(contract.favorites.fields, [
    'id',
    'productId',
    'name',
    'category',
    'image',
    'detail',
    'price',
    'badge',
  ]);
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
  const favorites = [{
    id: 'product-01',
    productId: 'product-01',
    name: '示例收藏',
    category: '',
    image: '',
    detail: '',
    price: 299,
    badge: '主推',
  }];
  const cart = [{ id: 'product-02', name: '示例购物车', price: 289, quantity: 2 }];

  saveStoredFavorites(storage, favorites);
  saveStoredCart(storage, cart);

  assert.deepEqual(getStoredFavorites(storage), favorites);
  assert.deepEqual(getStoredCart(storage), cart);
});

test('[FAVORITE-6-1] legacy sku favorites normalize to one current product record', async () => {
  const { normalizeProductFavorites } = await import('../src/account-store.js');
  assert.equal(typeof normalizeProductFavorites, 'function');

  const products = [{
    id: 'product-4',
    productId: 4,
    name: '海盐水手服',
    category: '海风学院',
    image: '/latest.jpg',
    detail: '最新商品介绍',
    price: 269,
    badge: '热卖',
  }];
  const legacyFavorites = [
    {
      id: 'product-4-sku-8',
      productId: 'product-4',
      skuId: 8,
      skuName: '白色 / M',
      name: '海盐水手服 / 白色 / M',
      category: '旧分类',
      image: '/old-a.jpg',
      price: 299,
    },
    {
      id: 'product-4-sku-9',
      productId: 'product-4',
      skuId: 9,
      skuName: '蓝色 / L',
      name: '海盐水手服 / 蓝色 / L',
      image: '/old-b.jpg',
      price: 309,
    },
  ];

  assert.deepEqual(normalizeProductFavorites(legacyFavorites, products), [{
    id: 'product-4',
    productId: 4,
    name: '海盐水手服',
    category: '海风学院',
    image: '/latest.jpg',
    detail: '最新商品介绍',
    price: 269,
    badge: '热卖',
  }]);
});

test('[FAVORITE-6-2] favorite migration is idempotent and safely preserves identifiable fallbacks', async () => {
  const { normalizeProductFavorites } = await import('../src/account-store.js');
  const legacyFavorites = [
    null,
    { broken: true },
    {
      id: 'legacy-product-sku-18',
      skuId: 18,
      skuName: '白色 / M',
      name: '遗留商品 / 白色 / M',
      category: '旧分类',
      image: '/legacy.jpg',
      detail: '旧介绍',
      price: 199,
      badge: '旧角标',
    },
  ];

  const once = normalizeProductFavorites(legacyFavorites, []);
  const twice = normalizeProductFavorites(once, []);

  assert.deepEqual(once, [{
    id: 'legacy-product',
    productId: 'legacy-product',
    name: '遗留商品',
    category: '旧分类',
    image: '/legacy.jpg',
    detail: '旧介绍',
    price: 199,
    badge: '旧角标',
  }]);
  assert.deepEqual(twice, once);
});

test('[FAVORITE-6-3] reading legacy favorites writes back the normalized product model', () => {
  const storage = createMemoryStorage();
  const products = [{ id: 'product-7', productId: 7, name: '星潮外套', price: 399 }];
  storage.setItem('blue-song-favorites', JSON.stringify([
    { id: 'product-7-sku-31', productId: 'product-7', skuId: 31, skuName: '黑色 / M', name: '星潮外套 / 黑色 / M' },
    { id: 'product-7-sku-32', productId: 'product-7', skuId: 32, skuName: '黑色 / L', name: '星潮外套 / 黑色 / L' },
  ]));

  const favorites = getStoredFavorites(storage, products);

  assert.equal(favorites.length, 1);
  assert.deepEqual(JSON.parse(storage.getItem('blue-song-favorites')), favorites);
  assert.equal(favorites[0].name, '星潮外套');
  assert.equal('skuId' in favorites[0], false);
  assert.equal('skuName' in favorites[0], false);
});

test('[FAVORITE-6-4] toggling favorites uses product identity and does not require sku data', async () => {
  const { isProductFavorited, toggleProductFavorite } = await import('../src/account-store.js');
  const productA = { id: 'product-1', productId: 1, name: '商品 A', price: 100 };
  const productB = { id: 'product-2', productId: 2, name: '商品 B', price: 200 };

  const addedA = toggleProductFavorite([], productA);
  const addedBoth = toggleProductFavorite(addedA, productB);
  const removedA = toggleProductFavorite(addedBoth, productA);

  assert.equal(addedA.length, 1);
  assert.equal(addedA[0].id, 'product-1');
  assert.equal('skuId' in addedA[0], false);
  assert.equal(isProductFavorited(addedBoth, productA), true);
  assert.equal(isProductFavorited(addedBoth, productB), true);
  assert.deepEqual(removedA.map((item) => item.id), ['product-2']);
});

test('[INDICATOR-8-1] favorite count uses normalized unique product records', () => {
  const favorites = [
    { id: 'product-4-sku-8', productId: 'product-4', name: '商品 A / 白色 / M', skuName: '白色 / M' },
    { id: 'product-4-sku-9', productId: 'product-4', name: '商品 A / 蓝色 / L', skuName: '蓝色 / L' },
    { id: 'product-5', productId: 5, name: '商品 B' },
    null,
    { broken: true },
  ];

  assert.equal(typeof accountStore.getFavoriteCount, 'function');
  assert.equal(accountStore.getFavoriteCount(favorites), 2);
  assert.equal(accountStore.getFavoriteCount([]), 0);
});

test('[INDICATOR-8-2] cart product state aggregates positive sku rows by product identity', () => {
  const product = { id: 'product-4', productId: 4 };
  const cart = [
    { id: 'sku-8', productId: 4, skuId: 8, quantity: 0 },
    { id: 'sku-9', productId: 4, skuId: 9, quantity: 2, invalidReason: '商品已下架' },
    { id: 'sku-11', productId: 4, skuId: 11, quantity: 1 },
    { id: 'sku-10', productId: 5, skuId: 10, quantity: 1 },
  ];

  assert.equal(typeof accountStore.isProductInCart, 'function');
  assert.equal(accountStore.isProductInCart(cart, product), true);
  assert.equal(accountStore.isProductInCart(cart.filter((item) => item.skuId !== 9), product), true);
  assert.equal(accountStore.isProductInCart([cart[0]], product), false);
  assert.equal(accountStore.isProductInCart(cart, { id: 'product-6', productId: 6 }), false);
});

test('[INDICATOR-8-3] cart badge totals safe non-negative integer quantities across all rows', () => {
  const cart = [
    { productId: 4, skuId: 8, quantity: 2 },
    { productId: 4, skuId: 9, quantity: '3' },
    { productId: 5, skuId: 10, quantity: 4.8, invalidReason: 'SKU 已下架' },
    { productId: 6, skuId: 11, quantity: -9 },
    { productId: 7, skuId: 12, quantity: 'not-a-number' },
    { productId: 8, skuId: 13, quantity: true },
    { productId: 9, skuId: 14, quantity: '' },
    { productId: 10, skuId: 15, quantity: null },
  ];

  assert.equal(typeof accountStore.getCartQuantityCount, 'function');
  assert.equal(accountStore.getCartQuantityCount(cart), 9);
  assert.equal(accountStore.getCartQuantityCount([]), 0);
});

test('[INDICATOR-8-4] badge formatting hides zero and caps visible text without losing source count', () => {
  assert.equal(typeof accountStore.formatCountBadge, 'function');
  assert.equal(accountStore.formatCountBadge(0), '');
  assert.equal(accountStore.formatCountBadge(1), '1');
  assert.equal(accountStore.formatCountBadge(99), '99');
  assert.equal(accountStore.formatCountBadge(100), '99+');
  assert.equal(accountStore.formatCountBadge(128), '99+');
});

test('[INDICATOR-8-5] storefront indicators expose stable state and badge hooks', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const renderProductsBody = sliceBetween(mainJs, 'function renderProducts() {', 'function updateView() {');
  const refreshIndicatorsBody = sliceBetween(mainJs, 'function refreshCommerceIndicators() {', 'function setFeedback(');
  const renderSidebarBody = sliceBetween(mainJs, 'function renderSidebar() {', 'function updateHeroParallax() {');
  const sidebarButtonStyles = sliceBetween(styles, '.sidebar-nav__button {', '.sidebar-nav__button.is-active');
  const favoriteVisualStyles = sliceBetween(styles, '.favorite-card__visual {', '.favorite-card__visual:disabled');

  assert.ok(html.includes('data-sidebar-count="favorites"'));
  assert.ok(html.includes('data-sidebar-count="cart"'));
  assert.ok(renderProductsBody.includes('data-favorite-state="${isFavorite ? \'active\' : \'inactive\'}"'));
  assert.ok(renderProductsBody.includes('data-cart-state="${isInCart ? \'active\' : \'inactive\'}"'));
  assert.ok(renderProductsBody.includes("is-in-cart"));
  assert.ok(renderProductsBody.includes("已在购物车，继续添加"));
  assert.ok(renderSidebarBody.includes('renderSidebarCountBadges'));
  assert.ok(mainJs.includes('function refreshCommerceIndicators('));
  assert.ok(refreshIndicatorsBody.includes('renderProducts();'));
  assert.ok(refreshIndicatorsBody.includes('renderSidebarCountBadges();'));
  assert.ok(refreshIndicatorsBody.includes('renderCommerceSidebarContent();'));
  assert.ok(!refreshIndicatorsBody.includes('renderSidebar();'));
  assert.ok(!refreshIndicatorsBody.includes('saveStored'));
  assert.ok(styles.includes('.ghost-button--icon-outline.is-favorited'));
  assert.ok(styles.includes('.ghost-button--icon-outline.is-in-cart'));
  assert.ok(styles.includes('.sidebar-nav__count'));
  assert.ok(sidebarButtonStyles.includes('display: flex'));
  assert.ok(sidebarButtonStyles.includes('justify-content: space-between'));
  assert.ok(!favoriteVisualStyles.includes('justify-content: space-between'));
});

test('[INDICATOR-8-6] cart api sync and initial load refresh indicators without clearing cache on failure', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const syncBody = sliceBetween(mainJs, 'async function syncCartFromApi(', 'async function addCartToApi(');
  const initBody = sliceBetween(mainJs, 'renderHero();', "window.addEventListener('scroll'");

  assert.ok(syncBody.includes('saveStoredCart(storage, cartItems)'));
  assert.ok(syncBody.includes('refreshCommerceIndicators()'));
  assert.doesNotMatch(syncBody, /catch[\s\S]*saveStoredCart\(storage, \[\]\)/);
  assert.ok(initBody.includes('syncCartFromApi(CURRENT_USER_ID)'));
  assert.ok(initBody.includes('refreshCommerceIndicators()'));
});

test('[FAVORITE-6-5] storefront favorite toggles directly while cart and buy keep sku modal semantics', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderProductsBody = sliceBetween(mainJs, 'function renderProducts() {', 'function updateView() {');
  const submitBody = sliceBetween(mainJs, 'async function submitPurchaseOrder() {', "function openSidebar(section = 'account') {");
  const cartSubmitBody = sliceBetween(submitBody, "} else if (actionConfig.key === 'cart') {", '} catch (error) {');
  const clickBody = sliceBetween(mainJs, "if (productGrid) {", "if (primaryCta) {");

  assert.ok(renderProductsBody.includes('aria-pressed="${isFavorite}"'));
  assert.ok(renderProductsBody.includes("aria-label=\"${isFavorite ? '取消收藏' : '加入收藏'}\""));
  assert.ok(renderProductsBody.includes("is-favorited"));
  assert.doesNotMatch(renderProductsBody, /data-sidebar-launch="favorites"[\s\S]{0,160}disabled/);
  assert.ok(clickBody.includes('toggleFavorite(product)'));
  assert.doesNotMatch(clickBody, /openPurchaseModal\(product, 'favorites'\)/);
  assert.ok(clickBody.includes("openPurchaseModal(product, 'cart')"));
  assert.ok(clickBody.includes("openPurchaseModal(product, 'buy')"));
  assert.doesNotMatch(submitBody, /actionConfig\.key === 'favorites'/);
  assert.doesNotMatch(cartSubmitBody, /openSidebar\(|closePurchaseModal\(/);
  assert.ok(submitBody.includes('openSidebar(actionConfig.openSidebar)'));
});

test('[FAVORITE-6-6] favorites shelf removal synchronizes storage cards and the open panel', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderShelfBody = sliceBetween(mainJs, 'function renderFavoritesShelf(', 'function formatCartMoney(');
  const removeFavoriteBody = sliceBetween(mainJs, 'function removeFavorite(', 'function upsertCartItem(');
  const favoriteEvents = sliceBetween(mainJs, 'if (favoritesList) {', 'if (cartList) {');

  assert.ok(renderShelfBody.includes('data-favorite-remove-id'));
  assert.ok(favoriteEvents.includes('removeFavorite('));
  assert.ok(removeFavoriteBody.includes('refreshCommerceIndicators();'));
});

test('[FAVORITE-7-1] favorite cards prefer live product fields and keep snapshot fallbacks', () => {
  const favorites = [{
    id: 'product-7',
    productId: 7,
    name: '旧名称',
    category: '旧分类',
    image: '/snapshot.jpg',
    detail: '快照介绍',
    price: 399,
    badge: '旧角标',
  }];
  const products = [{
    id: 'product-7',
    productId: 7,
    name: '实时名称',
    category: '实时分类',
    image: '/live.jpg',
    detail: '实时介绍',
    price: 359,
    badge: '实时角标',
  }];

  assert.equal(typeof accountStore.renderFavoriteProductItems, 'function');
  const live = accountStore.renderFavoriteProductItems(favorites, products, '暂无收藏夹');
  const snapshot = accountStore.renderFavoriteProductItems(favorites, [], '暂无收藏夹');

  assert.deepEqual(live.items[0], {
    id: 'product-7',
    productId: 7,
    currentProductId: 'product-7',
    name: '实时名称',
    category: '实时分类',
    image: '/live.jpg',
    detail: '实时介绍',
    price: 359,
    badge: '实时角标',
    isAvailable: true,
  });
  assert.equal(snapshot.items[0].name, '旧名称');
  assert.equal(snapshot.items[0].image, '/snapshot.jpg');
  assert.equal(snapshot.items[0].detail, '快照介绍');
  assert.equal(snapshot.items[0].isAvailable, false);
  assert.equal(snapshot.items[0].currentProductId, '');
});

test('[FAVORITE-7-1A] static catalog fallback is not treated as live favorite detail data', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const loaderBody = sliceBetween(mainJs, 'async function loadProductsFromApi()', 'const selectedSkuByProductId');
  const commerceSidebarBody = sliceBetween(mainJs, 'function renderCommerceSidebarContent() {', 'function renderSidebar() {');

  assert.ok(mainJs.includes('let hasLoadedProductsFromApi = false;'));
  assert.ok(loaderBody.includes('hasLoadedProductsFromApi = true;'));
  assert.ok(loaderBody.includes('hasLoadedProductsFromApi = false;'));
  assert.ok(commerceSidebarBody.includes("hasLoadedProductsFromApi ? products : []"));
});

test('[FAVORITE-7-2] favorite cards use neutral description text without leaking sku fields', () => {
  assert.equal(typeof accountStore.renderFavoriteProductItems, 'function');
  const rendered = accountStore.renderFavoriteProductItems([{
    id: 'product-8',
    productId: 8,
    name: '无介绍商品',
    detail: '',
    skuId: 88,
    skuName: '黑色 / M',
    color: '黑色',
    size: 'M',
  }], [], '暂无收藏夹');

  assert.equal(rendered.items[0].detail, '暂无商品介绍');
  assert.equal('skuId' in rendered.items[0], false);
  assert.equal('skuName' in rendered.items[0], false);
  assert.equal('color' in rendered.items[0], false);
  assert.equal('size' in rendered.items[0], false);
});

test('[FAVORITE-7-3] favorite shelf has accessible details and removal without changing cart markup', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const favoriteRenderer = sliceBetween(mainJs, 'function renderFavoritesShelf(', 'function formatCartMoney(');
  const cartRenderer = sliceBetween(mainJs, 'function renderCartShelf(', 'function renderCartSummary(');

  assert.ok(favoriteRenderer.includes('data-favorite-details-product-id'));
  assert.ok(favoriteRenderer.includes('data-favorite-remove-id'));
  assert.ok(favoriteRenderer.includes('点击查看更多图片'));
  assert.ok(favoriteRenderer.includes('aria-label="查看'));
  assert.ok(favoriteRenderer.includes('商品已不可用'));
  assert.ok(favoriteRenderer.includes('escapeHtml(item.detail)'));
  assert.doesNotMatch(favoriteRenderer, /skuName|color|size/);
  assert.doesNotMatch(favoriteRenderer, /更改图片/);
  assert.doesNotMatch(cartRenderer, /data-favorite-details-product-id|移除收藏|favorite-card__detail/);
  assert.match(styles, /\.favorite-card__description\s*\{[\s\S]*?-webkit-line-clamp:\s*3;/);
});

test('[FAVORITE-7-4] favorite image and details button open the shared read-only details mode', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const favoriteEvents = sliceBetween(mainJs, 'if (favoritesList) {', 'if (cartList) {');
  const openModalBody = sliceBetween(mainJs, "async function openPurchaseModal(product, action = 'buy') {", 'function closePurchaseModal() {');

  assert.ok(favoriteEvents.includes("openPurchaseModal(product, 'details')"));
  assert.ok(favoriteEvents.includes('[data-favorite-details-product-id]'));
  assert.ok(favoriteEvents.includes('productsById.get('));
  assert.doesNotMatch(favoriteEvents, /products\[0\]/);
  assert.ok(openModalBody.includes("actionConfig.key === 'details'"));
  assert.ok(openModalBody.includes('!actionConfig.showSku'));
  assert.doesNotMatch(
    sliceBetween(openModalBody, "if (actionConfig.key === 'details' && !actionConfig.showSku) {", '} else {'),
    /selectedSkuByProductId\.(?:set|delete)|resolveInitialSkuSelection/,
  );
});

test('[FAVORITE-7-5] details mode is read-only and hides every purchase-only control', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const detailsConfig = sliceBetween(mainJs, 'details: {', '\n  },\n};');
  const renderBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");
  const openModalBody = sliceBetween(mainJs, "async function openPurchaseModal(product, action = 'buy') {", 'function closePurchaseModal() {');

  assert.ok(html.includes('data-purchase-description'));
  assert.ok(html.includes('data-purchase-status'));
  assert.ok(html.includes('data-purchase-sku-summary'));
  const skuSection = sliceBetween(html, 'data-purchase-sku-section', '</section>');
  assert.ok(skuSection.includes('data-purchase-sku-options'));
  assert.ok(skuSection.includes('data-purchase-payment-options'));
  assert.ok(detailsConfig.includes("key: 'details'"));
  assert.ok(detailsConfig.includes('showSku: false'));
  assert.ok(detailsConfig.includes('showAddress: false'));
  assert.ok(detailsConfig.includes('showQuantity: false'));
  assert.ok(detailsConfig.includes('showPayment: false'));
  assert.ok(detailsConfig.includes('showTotal: false'));
  assert.ok(detailsConfig.includes('showSubmit: false'));
  assert.ok(detailsConfig.includes('showDescription: true'));
  assert.ok(renderBody.includes('purchaseSkuSection.hidden = !actionConfig.showSku;'));
  assert.ok(renderBody.includes('purchaseDescriptionSection.hidden = !actionConfig.showDescription;'));
  assert.ok(renderBody.includes('purchaseSubmit.hidden = !actionConfig.showSubmit;'));
  assert.ok(renderBody.includes("product?.detail || '暂无商品介绍'"));
  assert.ok(renderBody.includes('productState.label'));
  assert.ok(renderBody.includes('product?.skuSummary'));
  assert.doesNotMatch(openModalBody, /\/cart\/add|\/orders\/direct|\/orders\/pay/);
  assert.match(openModalBody, /if \(actionConfig\.showAddress\)[\s\S]*?loadAddressesFromApi/);
});

test('[FAVORITE-7-6] modal layering and Escape preserve the open favorites sidebar', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const keydownBody = sliceBetween(mainJs, "window.addEventListener('keydown', (event) => {", "if ('scrollRestoration' in window.history)");

  assert.match(styles, /\.sidebar\s*\{[\s\S]*?z-index:\s*45;/);
  assert.match(styles, /\.purchase-modal\s*\{[\s\S]*?z-index:\s*52;/);
  assert.match(styles, /\.image-lightbox\s*\{[\s\S]*?z-index:\s*90;/);
  assert.ok(keydownBody.includes("purchaseModal?.classList.contains('is-open')"));
  assert.match(keydownBody, /closePurchaseModal\(\);\s*return;/);
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

  assert.match(css, /\.sidebar__panel\s*\{[\s\S]*?overflow:\s*hidden;/);
  assert.match(css, /\.sidebar__panel\s*\{[\s\S]*?display:\s*grid;/);
});

test('sidebar keeps the five nav buttons visible while content scrolls independently', () => {
  const html = readFileSync('index.html', 'utf8');
  const css = readFileSync('src/styles.css', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(html.includes('data-sidebar-nav'));
  assert.ok(html.includes('data-sidebar-target="account"'));
  assert.ok(html.includes('data-sidebar-target="address"'));
  assert.ok(html.includes('data-sidebar-target="orders"'));
  assert.ok(html.includes('data-sidebar-target="favorites"'));
  assert.ok(html.includes('data-sidebar-target="cart"'));
  assert.match(css, /\.sidebar__panel\s*\{[\s\S]*?height:\s*100vh;/);
  assert.match(css, /\.sidebar-nav\s*\{[\s\S]*?position:\s*sticky;/);
  assert.match(css, /\.sidebar__content\s*\{[\s\S]*?overflow-y:\s*auto;/);
  assert.match(mainJs, /function getActiveSidebarScrollContainer\(\) \{[\s\S]*?return sidebar\.querySelector\('\.sidebar__content'\);/);
});

test('sidebar content starts at the top beside the left rail', () => {
  const css = readFileSync('src/styles.css', 'utf8');

  assert.match(css, /sidebar__panel[\s\S]*?display:\s*grid/);
  assert.match(css, /sidebar__layout[\s\S]*?display:\s*contents/);
  assert.match(css, /sidebar__content[\s\S]*?grid-column:\s*2/);
  assert.match(css, /sidebar__content[\s\S]*?grid-row:\s*1\s*\/\s*span\s*2/);
  assert.doesNotMatch(css, /sidebar__layout[\s\S]*?margin-top:\s*var\(--sidebar-layout-anchor-offset\)/);
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

test('admin product management supports multi-image upload and previews', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(html, /name="image"[^>]*multiple/);
  assert.match(html, /第一张[^<]*主图/);
  assert.ok(html.includes('data-admin-image-preview'));
  assert.ok(mainJs.includes('formData.append("images", file)'));
  assert.ok(mainJs.includes('getProductImages('));
  assert.ok(mainJs.includes('image_count'));
  assert.ok(mainJs.includes('URL.createObjectURL'));
  assert.ok(styles.includes('.admin-image-preview'));
  assert.ok(styles.includes('.admin-product-thumbnails'));
});

test('admin product image counts use the admin helper without changing the storefront image helper', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(mainJs.includes('function getAdminProductImageCount(product)'));
  assert.match(mainJs, /imageCount:\s*getAdminProductImageCount\(row\)/);
  assert.match(mainJs, /imageCount:\s*getAdminProductImageCount\(product\)/);
  assert.match(mainJs, /const imageCount = getAdminProductImageCount\(row\)/);
  assert.doesNotMatch(mainJs, /\bgetProductImageCount\s*\(/);
  assert.ok(mainJs.includes('function getProductImages(product)'));
});

test('admin API appends multiple images to an existing product without replacing its main image', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const endpoint = sliceBetween(
    backend,
    '@app.post("/admin/products/{product_id}/images")',
    '@app.delete("/admin/products/{product_id}/images/{image_id}")',
  );

  assert.match(endpoint, /images:\s*list\[UploadFile\]\s*\|\s*None\s*=\s*File\(None\)/);
  assert.ok(endpoint.includes('require_admin_user(authorization)'));
  assert.match(endpoint, /WHERE id = %s\s+AND is_deleted = 0/);
  assert.ok(endpoint.includes('SELECT MAX(sort_order) AS max_sort_order'));
  assert.ok(endpoint.includes('is_main') && endpoint.includes('sort_order'));
  assert.ok(endpoint.includes('query_product_images(conn, [product_id])'));
  assert.ok(endpoint.includes('conn.commit()'));
  assert.ok(endpoint.includes('conn.rollback()'));
  assert.ok(endpoint.includes('cleanup_saved_product_images(saved_images)'));
  assert.match(endpoint, /if first_upload_becomes_main:[\s\S]*?UPDATE product\s+SET image_url = %s/);
  assert.equal((endpoint.match(/UPDATE product\s+SET image_url = %s/g) || []).length, 1);
});

test('admin product cards expose only the unified image manager entry', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const productRenderer = sliceBetween(
    mainJs,
    '  function renderProducts()',
    '  function populateImageSelect()',
  );

  assert.ok(productRenderer.includes('data-admin-product-image-manage'));
  assert.ok(productRenderer.includes('管理图片'));
  assert.doesNotMatch(productRenderer, /data-admin-product-image-append/);
  assert.doesNotMatch(productRenderer, /追加图片/);
  assert.doesNotMatch(mainJs, /activeAdminProductImageAppendId/);
  assert.doesNotMatch(mainJs, /adminProductImageAppendPreviewUrls/);
});

test('admin image manager owns multi-file selection preview and explicit upload controls', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const managerMarkup = sliceBetween(
    html,
    '<section class="admin-image-manager"',
    '<section class="admin-sku-manager"',
  );
  const uploadHelper = sliceBetween(
    mainJs,
    'async function appendAdminProductImagesToApi(productId, imageFiles)',
    'async function deleteAdminProductImageToApi(productId, imageId)',
  );

  assert.match(managerMarkup, /data-admin-image-manager-input[^>]*multiple/);
  assert.match(managerMarkup, /accept="\.jpg,\.jpeg,\.png,\.webp,\.gif"/);
  assert.ok(managerMarkup.includes('data-admin-image-manager-pending'));
  assert.ok(managerMarkup.includes('data-admin-image-manager-upload'));
  assert.ok(managerMarkup.includes('data-admin-image-manager-clear'));
  assert.ok(managerMarkup.includes('data-admin-image-manager-list'));
  assert.ok(managerMarkup.includes('data-admin-image-manager-close'));
  assert.match(uploadHelper, /files\.forEach\(\(file\) => \{\s*formData\.append\("images", file\);/);
  assert.doesNotMatch(uploadHelper, /formData\.append\("image",/);
  assert.ok(uploadHelper.includes('adminFetch(`${API_BASE_URL}/admin/products/${productId}/images`'));
  assert.ok(styles.includes('.admin-image-manager__upload'));
  assert.ok(styles.includes('.admin-image-manager__pending'));
});

test('admin image manager keeps pending files local until explicit upload and releases preview urls', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const pendingFlow = sliceBetween(
    mainJs,
    'function getAdminImageFileKey(file)',
    'function renderProductImagePreview()',
  );

  assert.ok(pendingFlow.includes('adminImageManagerPendingFiles'));
  assert.ok(pendingFlow.includes('URL.createObjectURL(file)'));
  assert.ok(pendingFlow.includes('URL.revokeObjectURL(item.previewUrl)'));
  assert.ok(pendingFlow.includes('file.name'));
  assert.ok(pendingFlow.includes('file.size'));
  assert.ok(pendingFlow.includes('file.lastModified'));
  assert.ok(pendingFlow.includes('file.type'));
  assert.ok(pendingFlow.includes('data-admin-image-pending-remove'));
  assert.ok(pendingFlow.includes('adminImageManagerPendingFiles.splice'));
  assert.ok(pendingFlow.includes('clearAdminImageManagerPendingFiles'));
  assert.doesNotMatch(pendingFlow, /deleteAdminProductImageToApi/);
});

test('admin image manager blocks empty or duplicate uploads and refreshes the open product after success', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const submitFlow = sliceBetween(
    mainJs,
    'async function submitAdminImageManagerUpload()',
    'function renderProductImagePreview()',
  );

  assert.match(submitFlow, /if \(!activeAdminImageManagerProduct \|\| !adminImageManagerPendingFiles\.length \|\| adminImageManagerUploading\)/);
  assert.ok(submitFlow.includes('adminImageManagerUploading = true'));
  assert.ok(submitFlow.includes('adminImageManagerUpload.disabled = true'));
  assert.ok(submitFlow.includes('上传中...'));
  assert.ok(submitFlow.includes('await appendAdminProductImagesToApi(productId, imageFiles)'));
  assert.ok(submitFlow.includes('clearAdminImageManagerPendingFiles()'));
  assert.ok(submitFlow.includes('await refreshAdminProductsFromApi()'));
  assert.ok(submitFlow.includes('products.find((product) => product.productId === productId)'));
  assert.ok(submitFlow.includes('renderAdminProductImageManager()'));
  assert.ok(submitFlow.includes('adminImageManagerUploading = false'));
});

test('closing the admin image manager clears pending files input feedback and product state', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const closeFlow = sliceBetween(
    mainJs,
    'function closeAdminProductImageManager()',
    'function renderAdminProductImageManager()',
  );

  assert.ok(closeFlow.includes('clearAdminImageManagerPendingFiles()'));
  assert.ok(closeFlow.includes('adminImageManagerInput.value = ""'));
  assert.ok(closeFlow.includes('adminImageManagerFeedback.textContent = ""'));
  assert.ok(closeFlow.includes('activeAdminImageManagerProduct = null'));
});

test('admin API logically deletes product images and promotes a replacement main image', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const endpoint = sliceBetween(
    backend,
    '@app.delete("/admin/products/{product_id}/images/{image_id}")',
    'def query_user_addresses(conn, user_id: int):',
  );

  assert.ok(endpoint.includes('require_admin_user(authorization)'));
  assert.match(endpoint, /WHERE id = %s\s+AND is_deleted = 0/);
  assert.match(endpoint, /WHERE id = %s\s+AND product_id = %s\s+AND is_deleted = 0/);
  assert.ok(endpoint.includes('商品至少需要保留一张图片'));
  assert.match(endpoint, /UPDATE product_image\s+SET is_deleted = 1/);
  assert.match(endpoint, /ORDER BY sort_order ASC, id ASC/);
  assert.match(endpoint, /UPDATE product_image\s+SET is_main = 1/);
  assert.match(endpoint, /UPDATE product\s+SET image_url = %s/);
  assert.ok(endpoint.includes('query_product_images(conn, [product_id])'));
  assert.ok(endpoint.includes('conn.commit()'));
  assert.ok(endpoint.includes('conn.rollback()'));
  assert.doesNotMatch(endpoint, /unlink\(|cleanup_saved_product_images/);
});

test('admin image manager deletes by real image id and keeps card thumbnail limits intact', () => {
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const deleteHelper = sliceBetween(
    mainJs,
    'async function deleteAdminProductImageToApi(productId, imageId)',
    'function parseAdminSkuRows(values)',
  );
  const managerRenderer = sliceBetween(
    mainJs,
    'function renderAdminProductImageManager()',
    'function renderProductImagePreview()',
  );

  assert.ok(html.includes('data-admin-image-manager'));
  assert.ok(html.includes('data-admin-image-manager-list'));
  assert.ok(mainJs.includes('data-admin-product-image-manage'));
  assert.ok(managerRenderer.includes('getAdminProductImages(activeAdminImageManagerProduct)'));
  assert.doesNotMatch(managerRenderer, /\.slice\(/);
  assert.ok(managerRenderer.includes('image.id'));
  assert.ok(managerRenderer.includes('兼容主图暂不能直接删除'));
  assert.ok(managerRenderer.includes('至少保留一张图片'));
  assert.ok(deleteHelper.includes('method: "DELETE"'));
  assert.ok(deleteHelper.includes('adminFetch(`${API_BASE_URL}/admin/products/${productId}/images/${imageId}`'));
  assert.ok(mainJs.includes('window.confirm'));
  assert.ok(mainJs.includes('await deleteAdminProductImageToApi(productId, imageId);'));
  assert.ok(mainJs.includes('await refreshAdminProductsFromApi();'));
  assert.ok(mainJs.includes('getAdminProductImages(row).slice(0, 4)'));
  assert.ok(mainJs.includes('formData.append("images", file)'));
  assert.ok(mainJs.includes('function getProductImages(product)'));
  assert.ok(styles.includes('.admin-image-manager'));
});

test('admin authentication source wiring is present', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const html = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const sql = readFileSync('sql语句/05_账号与支付密码初始化.sql', 'utf8');

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

test('refund request contract stays order based and preserves business errors', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const requestStart = backend.indexOf('class RefundOrderRequest(BaseModel):');
  const requestEnd = backend.indexOf('\nclass ', requestStart + 1);
  const requestModel = backend.slice(requestStart, requestEnd);
  const routeStart = backend.indexOf('@app.post("/orders/refund")');
  const routeEnd = backend.indexOf('\n@app.', routeStart + 1);
  const refundRoute = backend.slice(routeStart, routeEnd);

  assert.ok(requestStart >= 0);
  assert.ok(routeStart >= 0);
  assert.match(requestModel, /user_id:\s*int/);
  assert.match(requestModel, /order_id:\s*int/);
  assert.match(requestModel, /remark:\s*str/);
  assert.doesNotMatch(requestModel, /sku_id|quantity/);
  assert.doesNotMatch(refundRoute, /req\.(?:sku_id|quantity)/);
  assert.doesNotMatch(refundRoute, /validate_sku_for_purchase\s*\(/);
  assert.match(refundRoute, /WHERE id = %s\s+AND user_id = %s\s+FOR UPDATE/);
  assert.match(refundRoute, /current_status not in \{"PAID", "SHIPPED"\}/);
  assert.match(refundRoute, /SET status = 'REFUND_REQUESTED'/);
  assert.ok(refundRoute.includes('未支付订单不能申请退款'));
  assert.ok(refundRoute.includes('已取消订单不能申请退款'));
  assert.ok(refundRoute.includes('退款申请已提交，请勿重复申请'));
  assert.ok(refundRoute.includes('订单已经退款'));
  assert.ok(refundRoute.includes('conn.commit()'));
  assert.ok(refundRoute.includes('conn.rollback()'));
  assert.match(refundRoute, /except HTTPException:\s+raise/);
});

test('frontend refund request contract sends only order level fields', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const functionStart = mainJs.indexOf('async function refundOrderFromApi(');
  const functionEnd = mainJs.indexOf('\nfunction ', functionStart + 1);
  const refundRequest = mainJs.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0);
  assert.ok(refundRequest.includes('user_id: CURRENT_USER_ID'));
  assert.ok(refundRequest.includes('order_id: Number(orderId)'));
  assert.ok(refundRequest.includes('remark'));
  assert.doesNotMatch(refundRequest, /sku_id|quantity/);
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

test('[SKU-1] product sku schema supports color and size dimensions', () => {
  const migrationPath = 'sql语句/01_数据库结构与增量迁移.sql';

  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);

  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /ALTER\s+TABLE\s+product_sku/i);
  assert.match(migration, /sku_code\s+VARCHAR\s*\(100\)\s+NULL/i);
  assert.match(migration, /color_name\s+VARCHAR\s*\(50\)\s+NULL/i);
  assert.match(migration, /size_name\s+VARCHAR\s*\(30\)\s+NULL/i);
  assert.match(migration, /product_id\s*,\s*color_name\s*,\s*size_name\s*,\s*is_deleted/i);
  assert.doesNotMatch(migration, /DROP\s+(COLUMN\s+)?sku_name/i);
  assert.doesNotMatch(migration, /CREATE\s+TABLE\s+(attribute|attribute_value|sku_attribute|sku_attribute_value)/i);
  assert.doesNotMatch(migration, /UPDATE\s+(product_sku|inventory|cart_item|order_item)\s+SET\s+(id|sku_id)/i);
});

test('[SKU-1] product detail view keeps dimensions inventory timestamps and image attachment', () => {
  const migrationPath = 'sql语句/02_视图.sql';

  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);

  const migration = readFileSync(migrationPath, 'utf8');
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.match(migration, /CREATE\s+OR\s+REPLACE\s+VIEW\s+v_product_detail/i);
  assert.match(migration, /s\.sku_name\s+AS\s+sku_name/i);
  assert.match(migration, /s\.sku_code\s+AS\s+sku_code/i);
  assert.match(migration, /s\.color_name\s+AS\s+color_name/i);
  assert.match(migration, /s\.size_name\s+AS\s+size_name/i);
  assert.match(migration, /i\.updated_at\s+AS\s+inventory_updated_at/i);
  assert.ok(backend.includes('rows = attach_product_images(conn, rows)'));
  assert.ok(backend.includes('row["images"] = images'));
  assert.ok(backend.includes('row["image_count"] = len(images)'));
});

test('[SKU-1] legacy skus retain sku names and a compatibility path', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const migration = readFileSync('sql语句/02_视图.sql', 'utf8');

  assert.ok(backend.includes('if not skus_json or not skus_json.strip():'));
  assert.ok(backend.includes('"sku_name"'));
  assert.ok(backend.includes('FROM v_product_detail'));
  assert.ok(migration.includes('s.is_deleted = 0'));
  assert.doesNotMatch(backend, /split\([^)]*sku_name|sku_name[^\n]*\.split\(/i);
});

test('[SKU-2] backend returns structured sku dimensions', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(backend.includes('def serialize_sku_rows('));
  assert.ok(backend.includes('"sku_code"'));
  assert.ok(backend.includes('"color"'));
  assert.ok(backend.includes('"size"'));
  assert.ok(backend.includes('"stock"'));
  assert.ok(backend.includes('"on_sale"'));
  assert.ok(backend.includes('sku_is_deleted'));
  assert.ok(backend.includes('inventory_updated_at'));
  assert.ok(backend.includes('rows = attach_product_images(conn, rows)'));
});

test('[SKU-2] product creation accepts structured sku combinations', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const parserBody = sliceBetween(backend, 'def normalize_structured_sku_rows(', '@app.post("/products")');
  const createBody = sliceBetween(backend, '@app.post("/products")', '@app.post("/admin/products/{product_id}/images")');

  assert.ok(parserBody.includes('row.get("sku_code")'));
  assert.ok(parserBody.includes('row.get("color")'));
  assert.ok(parserBody.includes('row.get("size")'));
  assert.ok(parserBody.includes('row.get("stock", row.get("available_stock"))'));
  assert.ok(parserBody.includes('row.get("on_sale", 1)'));
  assert.ok(parserBody.includes('seen_codes'));
  assert.ok(parserBody.includes('seen_dimensions'));
  assert.ok(createBody.includes('sku_code'));
  assert.ok(createBody.includes('color_name'));
  assert.ok(createBody.includes('size_name'));
  assert.ok(createBody.includes('INSERT INTO inventory'));
  assert.ok(createBody.includes('conn.commit()'));
  assert.ok(createBody.includes('conn.rollback()'));
  assert.ok(createBody.includes('cleanup_saved_product_images(saved_images)'));
});

test('[SKU-2] admin sku endpoints validate ownership and duplicates', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(backend.includes('@app.get("/admin/products/{product_id}/skus")'));
  assert.ok(backend.includes('@app.post("/admin/products/{product_id}/skus")'));
  assert.ok(backend.includes('@app.patch("/admin/products/{product_id}/skus/{sku_id}")'));
  assert.ok(backend.includes('@app.delete("/admin/products/{product_id}/skus/{sku_id}")'));
  assert.ok(backend.includes('def ensure_admin_sku_unique('));
  assert.ok(backend.includes('product_id = %s'));
  assert.ok(backend.includes('id <> %s'));
  assert.ok(backend.includes('FOR UPDATE'));
  assert.ok(backend.includes('SKU 编码已存在'));
  assert.ok(backend.includes('颜色和尺码组合已存在'));

  const skuRoutes = sliceBetween(
    backend,
    '@app.get("/admin/products/{product_id}/skus")',
    '@app.get("/admin/inventory")',
  );
  assert.ok(skuRoutes.includes('require_admin_user(authorization)'));
});

test('[SKU-2] checkout validates selected sku sale and stock state', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');

  assert.ok(backend.includes('def validate_sku_for_purchase('));
  assert.ok(backend.includes("s.status = 'ON_SALE'"));
  assert.ok(backend.includes('s.is_deleted = 0'));
  assert.ok(backend.includes("p.status = 'ON_SALE'"));
  assert.ok(backend.includes('p.is_deleted = 0'));
  assert.ok(backend.includes('available_stock'));
  assert.ok(backend.includes('validate_sku_for_purchase(conn, req.sku_id, req.quantity)'));
  assert.ok(backend.includes('CALL sp_create_order_from_cart'));
  assert.ok(backend.includes('CALL sp_create_order_from_selected_cart_items'));
});

test('[SKU-2] sku logical deletion preserves historical references', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const deleteRoute = sliceBetween(
    backend,
    '@app.delete("/admin/products/{product_id}/skus/{sku_id}")',
    '@app.get("/admin/inventory")',
  );

  assert.ok(deleteRoute.includes('SET is_deleted = 1'));
  assert.ok(deleteRoute.includes("status = 'OFF_SALE'"));
  assert.ok(deleteRoute.includes('最后一个未删除 SKU'));
  assert.doesNotMatch(deleteRoute, /DELETE\s+FROM\s+product_sku/i);
  assert.doesNotMatch(deleteRoute, /DELETE\s+FROM\s+order_item/i);
  assert.ok(backend.includes('JOIN order_item oi'));
});

test('[SKU-3] admin product form builds color size cartesian combinations', async () => {
  const modulePath = 'src/sku-utils.js';

  assert.equal(existsSync(modulePath), true, `${modulePath} should exist`);

  const { buildSkuMatrix, normalizeDimensionValues } = await import('../src/sku-utils.js');
  assert.deepEqual(normalizeDimensionValues(' 白色，黑色, 白色\n'), ['白色', '黑色']);
  assert.deepEqual(normalizeDimensionValues(' S\nM,L,M '), ['S', 'M', 'L']);

  const rows = buildSkuMatrix(['白色', '黑色'], ['S', 'M', 'L'], [], {
    productName: '复杂SKU验收测试商品',
    price: 199,
    stock: 50,
    onSale: 1,
  });

  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map((row) => `${row.color} / ${row.size}`), [
    '白色 / S', '白色 / M', '白色 / L',
    '黑色 / S', '黑色 / M', '黑色 / L',
  ]);
  assert.ok(rows.every((row) => row.sku_name === `${row.color} / ${row.size}`));
  assert.equal(new Set(rows.map((row) => row.sku_code)).size, 6);
  assert.ok(rows.every((row) => row.price === 199 && row.stock === 50 && row.on_sale === 1));
});

test('[SKU-3] admin sku matrix preserves edited values while dimensions change', async () => {
  const modulePath = 'src/sku-utils.js';

  assert.equal(existsSync(modulePath), true, `${modulePath} should exist`);

  const { buildSkuMatrix } = await import('../src/sku-utils.js');
  const initialRows = buildSkuMatrix(['白色'], ['S'], [], { price: 199, stock: 50 });
  const editedRows = initialRows.map((row) => row.size === 'S'
    ? { ...row, sku_code: 'WHITE-S-CUSTOM', price: 209, stock: 35, on_sale: 0 }
    : row);
  const regenerated = buildSkuMatrix(['白色'], ['S', 'M'], editedRows, { price: 199, stock: 50 });
  const preserved = regenerated.find((row) => row.color === '白色' && row.size === 'S');
  const added = regenerated.find((row) => row.color === '白色' && row.size === 'M');

  assert.equal(regenerated.length, 2);
  assert.deepEqual(
    { code: preserved.sku_code, price: preserved.price, stock: preserved.stock, onSale: preserved.on_sale },
    { code: 'WHITE-S-CUSTOM', price: 209, stock: 35, onSale: 0 },
  );
  assert.equal(added.stock, 50);
});

test('[SKU-3] new product sku defaults to 50 without changing existing-product sku defaults or stock edits', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const createMatrixBody = sliceBetween(mainJs, 'function rebuildAdminSkuMatrix() {', 'function updateAdminSkuMatrixValue(event) {');
  const existingProductGenerateBody = sliceBetween(
    mainJs,
    "adminSkuAddGenerate?.addEventListener('click', () => {",
    'function updateAdminSkuDraft(event) {',
  );
  const parseRowsBody = sliceBetween(mainJs, 'function parseAdminSkuRows(values) {', 'async function createAdminProductToApi(');
  const createApiBody = sliceBetween(mainJs, 'async function createAdminProductToApi(', 'async function appendAdminProductImagesToApi(');

  assert.match(createMatrixBody, /stock:\s*50,/);
  assert.match(existingProductGenerateBody, /stock:\s*0,/);
  assert.ok(parseRowsBody.includes('const stock = Number(sourceRow.stock);'));
  assert.ok(createApiBody.includes('formData.append("skus_json", JSON.stringify(skuRows))'));
  assert.match(mainJs, /<input type="number" min="0" step="1"[^>]*data-admin-sku-stock/);
});

test('[SKU-3] admin submits structured sku json with multi-image form data', () => {
  const adminHtml = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const createApiBody = sliceBetween(mainJs, 'async function createAdminProductToApi(', 'async function appendAdminProductImagesToApi(');
  const submitBody = sliceBetween(mainJs, "productForm.addEventListener('submit'", "if (productFilterBar)");

  assert.ok(adminHtml.includes('data-admin-sku-colors'));
  assert.ok(adminHtml.includes('data-admin-sku-sizes'));
  assert.ok(adminHtml.includes('data-admin-sku-matrix'));
  assert.ok(mainJs.includes("from './sku-utils.js"));
  assert.ok(mainJs.includes('buildSkuMatrix('));
  assert.ok(mainJs.includes('data-admin-sku-code'));
  assert.ok(mainJs.includes('data-admin-sku-price'));
  assert.ok(mainJs.includes('data-admin-sku-stock'));
  assert.ok(mainJs.includes('data-admin-sku-on-sale'));
  assert.ok(createApiBody.includes('formData.append("skus_json", JSON.stringify(skuRows))'));
  assert.ok(createApiBody.includes('formData.append("images", file)'));
  assert.doesNotMatch(createApiBody, /formData\.append\(["']image["']/);
  assert.ok(submitBody.includes('await createAdminProductToApi('));
  assert.ok(submitBody.indexOf('productForm.reset()') > submitBody.indexOf('await createAdminProductToApi('));
  assert.ok(submitBody.includes('await refreshAdminProductsFromApi()'));
});

test('[SKU-4] storefront keeps structured sku dimensions while merging products', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const convertBody = sliceBetween(mainJs, 'function convertApiProducts(apiRows)', 'async function loadProductsFromApi()');

  assert.ok(convertBody.includes('skuCode: row.sku_code'));
  assert.ok(convertBody.includes('color: row.color'));
  assert.ok(convertBody.includes('size: row.size'));
  assert.ok(convertBody.includes('skuIsDeleted:'));
  assert.equal((convertBody.match(/color:\s*row\.color/g) || []).length, 2);
  assert.equal((convertBody.match(/size:\s*row\.size/g) || []).length, 2);
  assert.ok(convertBody.includes('images: getProductImages(row)'));
  assert.ok(convertBody.includes('inventoryUpdatedAt: row.inventory_updated_at'));
});

test('[SKU-4] purchase modal selects color and size independently', async () => {
  const { getInitialSkuSelection, selectSkuDimension } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuId: 101, color: '白色', size: 'S', skuStatus: 'ON_SALE', availableStock: 10 },
      { skuId: 102, color: '白色', size: 'M', skuStatus: 'ON_SALE', availableStock: 8 },
      { skuId: 103, color: '黑色', size: 'S', skuStatus: 'ON_SALE', availableStock: 6 },
      { skuId: 104, color: '黑色', size: 'M', skuStatus: 'ON_SALE', availableStock: 4 },
    ],
  };

  const colorFirst = selectSkuDimension(product, {}, 'color', '黑色');
  assert.deepEqual(selectSkuDimension(product, colorFirst, 'size', 'M'), { color: '黑色', size: 'M', skuId: 104 });

  const sizeFirst = selectSkuDimension(product, {}, 'size', 'S');
  assert.deepEqual(selectSkuDimension(product, sizeFirst, 'color', '白色'), { color: '白色', size: 'S', skuId: 101 });

  const singleValue = getInitialSkuSelection({
    ...product,
    skuList: product.skuList.filter((sku) => sku.color === '白色' && sku.size === 'S'),
  });
  assert.deepEqual(singleValue, { color: '白色', size: 'S', skuId: 101 });
});

test('[SKU-4] unavailable color size combinations are disabled', async () => {
  const { getDimensionOptions, selectSkuDimension } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuId: 201, color: '白色', size: 'S', skuStatus: 'ON_SALE', availableStock: 10 },
      { skuId: 202, color: '白色', size: 'M', skuStatus: 'ON_SALE', availableStock: 0 },
      { skuId: 203, color: '黑色', size: 'M', skuStatus: 'ON_SALE', availableStock: 6 },
      { skuId: 204, color: '黑色', size: 'L', skuStatus: 'OFF_SALE', availableStock: 4 },
    ],
  };

  const colorOptions = getDimensionOptions(product, selectSkuDimension(product, {}, 'size', 'M'), 'color');
  assert.equal(colorOptions.find((item) => item.value === '白色').disabled, true);
  assert.equal(colorOptions.find((item) => item.value === '黑色').disabled, false);

  const sizeOptions = getDimensionOptions(product, selectSkuDimension(product, {}, 'color', '黑色'), 'size');
  assert.equal(sizeOptions.find((item) => item.value === 'S').disabled, true);
  assert.equal(sizeOptions.find((item) => item.value === 'M').disabled, false);
  assert.equal(sizeOptions.find((item) => item.value === 'L').disabled, true);

  const incompatible = selectSkuDimension(product, { color: '白色', size: 'S', skuId: 201 }, 'color', '黑色');
  assert.deepEqual(incompatible, { color: '黑色', size: null, skuId: null });
});

test('[SKU-4] selected sku drives price stock cart and direct purchase', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderPurchaseModal()', 'async function openPurchaseModal(');
  const selectionBody = sliceBetween(mainJs, 'function setPurchaseDimension(', 'function setPurchasePaymentMethod(');

  assert.ok(renderBody.includes('data-purchase-color'));
  assert.ok(renderBody.includes('data-purchase-size'));
  assert.ok(renderBody.includes('selectedSku?.price'));
  assert.ok(renderBody.includes('getSkuAvailableStock(selectedSku)'));
  assert.ok(selectionBody.includes('activePurchaseSkuId = nextSelection.skuId'));
  assert.ok(mainJs.includes('selectedSku?.skuId'));
  assert.ok(mainJs.includes('addCartToApi(activePurchaseProduct, selectedSku, quantity'));
});

test('[SKU-4] legacy sku products keep the previous specification flow', async () => {
  const { isStructuredProduct } = await import('../src/sku-utils.js');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const lightboxBody = sliceBetween(mainJs, 'function openImageLightbox()', 'function closeImageLightbox()');

  assert.equal(isStructuredProduct({
    skuList: [{ skuId: 301, skuName: '经典均码', color: null, size: null, availableStock: 3 }],
  }), false);
  assert.ok(mainJs.includes('data-purchase-sku-id'));
  assert.ok(mainJs.includes("sku.skuName || '默认规格'"));
  assert.doesNotMatch(lightboxBody, /activePurchase(Color|Size|SkuId|Quantity|AddressId|PaymentMethod)\s*=/);
});

test('[SKU-SYNC-1] purchase initialization restores a valid explicit sku and its dimensions', async () => {
  const { resolveInitialSkuSelection } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuId: 401, color: '白色', size: 'S', skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 5 },
      { skuId: 402, color: '黑色', size: 'M', skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 3 },
    ],
  };

  assert.deepEqual(resolveInitialSkuSelection(product, 402), {
    color: '黑色',
    size: 'M',
    skuId: 402,
  });
});

test('[SKU-SYNC-2] purchase initialization auto-selects only one sellable sku', async () => {
  const { resolveInitialSkuSelection } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuId: 411, skuStatus: 'OFF_SALE', skuIsDeleted: 0, availableStock: 8 },
      { skuId: 412, skuStatus: 'ON_SALE', skuIsDeleted: 1, availableStock: 8 },
      { skuId: 413, skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 0 },
      { skuId: 414, skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 2 },
    ],
  };

  assert.deepEqual(resolveInitialSkuSelection(product, 411), {
    color: null,
    size: null,
    skuId: 414,
  });
});

test('[SKU-SYNC-3] purchase initialization keeps multiple sellable skus unselected', async () => {
  const { resolveInitialSkuSelection } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'ON_SALE',
    skuList: [
      { skuId: 421, skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 2 },
      { skuId: 422, skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 4 },
    ],
  };

  assert.deepEqual(resolveInitialSkuSelection(product), {
    color: null,
    size: null,
    skuId: null,
  });
});

test('[SKU-SYNC-4] product and sku sale state both gate reusable selections', async () => {
  const { getSellableProductSkus, resolveInitialSkuSelection } = await import('../src/sku-utils.js');
  const product = {
    productStatus: 'OFF_SALE',
    skuList: [
      { skuId: 431, skuStatus: 'ON_SALE', skuIsDeleted: 0, availableStock: 5 },
    ],
  };

  assert.deepEqual(getSellableProductSkus(product), []);
  assert.deepEqual(resolveInitialSkuSelection(product, 431), {
    color: null,
    size: null,
    skuId: null,
  });
});

test('[SKU-SYNC-5] modal initialization and dimension changes keep the product cache synchronized', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const openModalBody = sliceBetween(mainJs, 'async function openPurchaseModal(product, action = \'buy\') {', 'function closePurchaseModal() {');
  const dimensionBody = sliceBetween(mainJs, 'function setPurchaseDimension(dimension, value) {', 'function setPurchasePaymentMethod(method) {');
  const skuBody = sliceBetween(mainJs, 'function setPurchaseSku(skuId) {', 'function setPurchaseDimension(dimension, value) {');

  assert.ok(openModalBody.includes('resolveInitialSkuSelection(product, cachedSkuId)'));
  assert.ok(openModalBody.includes('selectedSkuByProductId.delete(product.id)'));
  assert.ok(openModalBody.includes('updateView();'));
  assert.ok(dimensionBody.includes('selectedSkuByProductId.delete(activePurchaseProduct.id)'));
  assert.ok(skuBody.includes('activePurchaseQuantity = Math.min('));
});

test('[SKU-SYNC-6] storefront cache-busts the sku utility module after selection exports change', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const html = readFileSync('index.html', 'utf8');

  assert.ok(mainJs.includes("from './sku-utils.js?v=20260715a'"));
  assert.ok(html.includes('./src/main.js?v=20260715e'));
});

test('[SKU-SYNC-7] cart modal hides payment controls without hiding sku controls', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const html = readFileSync('index.html', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");

  assert.ok(html.includes('data-purchase-payment-title'));
  assert.ok(renderBody.includes('purchasePaymentTitle.hidden = !actionConfig.showPayment;'));
  assert.ok(renderBody.includes('purchasePaymentOptions.hidden = !actionConfig.showPayment;'));
  assert.ok(!mainJs.includes("favorites: {\n    key: 'favorites'"));
  assert.ok(!mainJs.includes("purchasePaymentOptions?.closest('.purchase-modal__section')"));
});

test('[SKU-5] admin product cards expose a sku manager', () => {
  const adminHtml = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.ok(adminHtml.includes('data-admin-sku-manager'));
  assert.ok(adminHtml.includes('data-admin-sku-manager-list'));
  assert.ok(adminHtml.includes('data-admin-sku-manager-close'));
  assert.ok(mainJs.includes('data-admin-product-sku-manage'));
  assert.ok(mainJs.includes('管理规格'));
  assert.ok(mainJs.includes('openAdminSkuManager'));
});

test('[SKU-5] sku manager loads every sku with real ids', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const loaderBody = sliceBetween(mainJs, 'async function loadAdminProductSkusToApi(', 'async function createAdminProductSkusToApi(');
  const rendererBody = sliceBetween(mainJs, 'function renderAdminSkuManager()', 'function closeAdminSkuManager()');

  assert.ok(loaderBody.includes('/admin/products/${productId}/skus'));
  assert.ok(loaderBody.includes('adminFetch('));
  assert.doesNotMatch(loaderBody, /\.slice\(/);
  assert.ok(rendererBody.includes('sku.skuId'));
  assert.ok(rendererBody.includes('sku.color'));
  assert.ok(rendererBody.includes('sku.size'));
  assert.ok(rendererBody.includes('sku.skuCode'));
  assert.ok(rendererBody.includes('sku.availableStock'));
  assert.ok(mainJs.includes('skuIsDeleted'));
});

test('[SKU-5] sku manager edits dimensions price sale state and inventory', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const updateBody = sliceBetween(mainJs, 'async function updateAdminProductSkuToApi(', 'async function deleteAdminProductSkuToApi(');

  assert.ok(updateBody.includes('method: "PATCH"'));
  assert.ok(updateBody.includes('/admin/products/${productId}/skus/${skuId}'));
  assert.ok(updateBody.includes('adminFetch('));
  assert.ok(mainJs.includes('data-admin-sku-edit-color'));
  assert.ok(mainJs.includes('data-admin-sku-edit-size'));
  assert.ok(mainJs.includes('data-admin-sku-edit-code'));
  assert.ok(mainJs.includes('data-admin-sku-edit-price'));
  assert.ok(mainJs.includes('data-admin-sku-edit-stock'));
  assert.ok(mainJs.includes('data-admin-sku-edit-on-sale'));
  assert.ok(mainJs.includes('skuManagerSubmitting'));
  assert.ok(mainJs.includes('await refreshAdminProductsFromApi()'));
});

test('[SKU-5] sku manager adds only missing color size combinations', async () => {
  const { getMissingSkuCombinations } = await import('../src/sku-utils.js');
  const existing = [
    { color: '白色', size: 'S' },
    { color: '白色', size: 'M' },
  ];
  const missing = getMissingSkuCombinations(existing, ['白色', '黑色'], ['S', 'M'], {
    productName: '测试商品',
    price: 199,
  });

  assert.deepEqual(missing.map((row) => `${row.color} / ${row.size}`), ['黑色 / S', '黑色 / M']);

  const mainJs = readFileSync('src/main.js', 'utf8');
  const createBody = sliceBetween(mainJs, 'async function createAdminProductSkusToApi(', 'async function updateAdminProductSkuToApi(');
  assert.ok(createBody.includes('method: "POST"'));
  assert.ok(createBody.includes('JSON.stringify({ skus })'));
  assert.ok(mainJs.includes('data-admin-sku-add-colors'));
  assert.ok(mainJs.includes('data-admin-sku-add-sizes'));
});

test('[SKU-5] sku manager logically deletes skus with final sku protection', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const deleteBody = sliceBetween(mainJs, 'async function deleteAdminProductSkuToApi(', 'function parseAdminSkuRows(');

  assert.ok(deleteBody.includes('method: "DELETE"'));
  assert.ok(deleteBody.includes('/admin/products/${productId}/skus/${skuId}'));
  assert.ok(mainJs.includes('window.confirm'));
  assert.ok(mainJs.includes('data-admin-sku-delete-id'));
  assert.ok(backend.includes('不允许删除最后一个未删除 SKU'));
  assert.ok(backend.includes('SET is_deleted = 1'));
  assert.ok(backend.includes("status = 'OFF_SALE'"));
  assert.doesNotMatch(backend, /DELETE\s+FROM\s+product_sku/i);
});

test('[DESCRIPTION-1] product description migration exists as a new numbered SQL file', () => {
  assert.ok(existsSync('sql语句/06_商品描述增量迁移.sql'));
});

test('[DESCRIPTION-2] migration adds nullable description and preserves the final product detail view', () => {
  const migration = readFileSync('sql语句/06_商品描述增量迁移.sql', 'utf8');

  assert.match(migration, /information_schema\.columns/i);
  assert.match(migration, /ALTER TABLE product ADD COLUMN description TEXT NULL/i);
  assert.match(migration, /CREATE OR REPLACE VIEW v_product_detail/i);
  assert.match(migration, /p\.description\s+AS\s+description/i);
  assert.match(migration, /s\.sku_code\s+AS\s+sku_code/i);
  assert.match(migration, /i\.updated_at\s+AS\s+inventory_updated_at/i);
  assert.doesNotMatch(migration, /DROP\s+DATABASE|TRUNCATE\s+TABLE|DELETE\s+FROM\s+(product|product_sku|inventory)/i);
});

test('[DESCRIPTION-3] product create and query APIs persist and expose descriptions', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const createBody = sliceBetween(backend, '@app.post("/products")', '@app.post("/admin/products/{product_id}/images")');
  const publicQuery = sliceBetween(backend, '@app.get("/products")', '@app.post("/admin/login")');
  const inventoryQuery = sliceBetween(backend, '@app.get("/admin/inventory")', '@app.post("/admin/inventory/update-stock")');

  assert.ok(createBody.includes('description: str = Form("")'));
  assert.ok(createBody.includes('normalize_product_description(description)'));
  assert.match(createBody, /INSERT INTO product\([\s\S]*description[\s\S]*VALUES\(%s, %s, %s, %s, 'ON_SALE', 0\)/);
  assert.match(publicQuery, /product_name,[\s\S]*description,[\s\S]*FROM v_product_detail/);
  assert.match(inventoryQuery, /product_name,[\s\S]*description,[\s\S]*FROM v_product_detail/);
  assert.match(createBody, /product_name,[\s\S]*description,[\s\S]*FROM v_product_detail/);
});

test('[DESCRIPTION-4] admin description update is authenticated transactional and supports clearing', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const routeBody = sliceBetween(
    backend,
    '@app.patch("/admin/products/{product_id}/description")',
    '@app.get("/admin/products/{product_id}/skus")',
  );

  assert.ok(backend.includes('class AdminProductDescriptionUpdateRequest(BaseModel):'));
  assert.ok(backend.includes('max_length=PRODUCT_DESCRIPTION_MAX_LENGTH'));
  assert.ok(backend.includes('return normalized or None'));
  assert.ok(routeBody.includes('require_admin_user(authorization)'));
  assert.ok(routeBody.includes('WHERE id = %s AND is_deleted = 0 FOR UPDATE'));
  assert.ok(routeBody.includes('UPDATE product SET description = %s WHERE id = %s AND is_deleted = 0'));
  assert.ok(routeBody.includes('(description, product_id)'));
  assert.ok(routeBody.includes('conn.commit()'));
  assert.ok(routeBody.includes('conn.rollback()'));
  assert.ok(routeBody.includes('except HTTPException:'));
});

test('[DESCRIPTION-5] storefront maps real descriptions without replacing them with sku summaries', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const converter = sliceBetween(mainJs, 'function convertApiProducts(apiRows)', 'async function loadProductsFromApi()');
  const renderer = sliceBetween(mainJs, 'function renderProducts()', 'function getLoginFormValues');

  assert.ok(converter.includes('detail: normalizeProductDescription(row.description)'));
  assert.ok(converter.includes('skuSummary: ""'));
  assert.ok(converter.includes('product.skuSummary = `共 ${product.skuList.length} 个规格'));
  assert.doesNotMatch(converter, /product\.detail\s*=\s*`共/);
  assert.ok(renderer.includes('const detailMarkup = product.detail'));
  assert.ok(renderer.includes('escapeHtml(product.detail)'));
  assert.ok(renderer.includes('${detailMarkup}'));
  assert.match(styles, /\.product-card__detail\s*\{[\s\S]*white-space:\s*pre-line;[\s\S]*overflow-wrap:\s*break-word;/);
});

test('[DESCRIPTION-6] admin create and edit UI use one safe description contract', () => {
  const adminHtml = readFileSync('admin.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const createHelper = sliceBetween(mainJs, 'async function createAdminProductToApi(', 'async function appendAdminProductImagesToApi(');
  const adminConverter = sliceBetween(mainJs, 'function convertApiRowsToAdminProducts(apiRows)', 'function renderAdminInventoryProductsView(');

  assert.match(adminHtml, /textarea[^>]*name="description"[^>]*maxlength="1000"/);
  assert.ok(createHelper.includes('formData.append("description"'));
  assert.ok(adminConverter.includes('description: normalizeProductDescription(row.description)'));
  assert.ok(adminHtml.includes('data-admin-description-editor'));
  assert.ok(adminHtml.includes('data-admin-description-editor-input'));
  assert.ok(adminHtml.includes('data-admin-description-editor-save'));
  assert.ok(mainJs.includes('data-admin-product-description-edit'));
  assert.ok(mainJs.includes('updateAdminProductDescriptionToApi'));
  assert.ok(mainJs.includes('/admin/products/${productId}/description'));
  assert.ok(mainJs.includes('adminDescriptionSubmitting'));
  assert.ok(mainJs.includes('refreshAdminProductsFromApi()'));
  assert.ok(mainJs.includes('PRODUCT_DESCRIPTION_MAX_LENGTH'));
});

test('[DESCRIPTION-7] admin description editor remains usable at narrow viewport', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  const narrowAdminStyles = sliceBetween(styles, '@media (max-width: 760px)', '.scroll-tools');

  assert.match(narrowAdminStyles, /\.admin-layout\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
  assert.match(narrowAdminStyles, /\.admin-nav\s*\{[\s\S]*position:\s*static;/);
  assert.match(narrowAdminStyles, /\.admin-description-editor__panel\s*\{[\s\S]*max-height:\s*calc\(100vh - 16px\);/);
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

test('[BUYER-REMARK-1] migration adds the nullable order remark through an idempotent compatible procedure', () => {
  assert.ok(existsSync('sql语句/07_订单买家备注增量迁移.sql'));
  const migration = readFileSync('sql语句/07_订单买家备注增量迁移.sql', 'utf8');

  assert.match(migration, /information_schema\.columns/i);
  assert.match(migration, /ALTER TABLE order_main ADD COLUMN buyer_remark VARCHAR\(500\) NULL/i);
  assert.match(migration, /DROP PROCEDURE IF EXISTS sp_create_direct_order_with_remark/i);
  assert.match(migration, /CREATE PROCEDURE sp_create_direct_order_with_remark/i);
  assert.match(migration, /INSERT INTO order_main\([\s\S]*buyer_remark[\s\S]*VALUES\([\s\S]*v_buyer_remark/i);
  assert.match(migration, /DECLARE EXIT HANDLER FOR SQLEXCEPTION[\s\S]*ROLLBACK[\s\S]*RESIGNAL/i);
  assert.match(migration, /CREATE OR REPLACE VIEW v_order_summary[\s\S]*o\.buyer_remark AS buyer_remark/i);
  assert.match(migration, /CREATE OR REPLACE VIEW v_user_order_detail[\s\S]*o\.buyer_remark AS buyer_remark/i);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DROP\s+DATABASE/i);
  assert.doesNotMatch(migration, /DROP PROCEDURE IF EXISTS sp_create_direct_order\s*(?:;|\$\$)/i);
});

test('[BUYER-REMARK-2] direct order model normalizes whitespace and enforces the 500 character boundary', () => {
  const script = String.raw`
import json
from pydantic import ValidationError
from app.main import DirectOrderRequest

base = {"user_id": 2, "address_id": 3, "sku_id": 1, "quantity": 1}
values = {}
for name, value in {
    "missing": ...,
    "null": None,
    "empty": "",
    "blank": "  \n ",
    "trimmed": "  \u8bf7\u653e\u95e8\u53e3\n\u7b2c\u4e8c\u884c  ",
    "five_hundred": "\u6d4b" * 500,
}.items():
    payload = dict(base)
    if value is not ...:
        payload["buyer_remark"] = value
    values[name] = DirectOrderRequest(**payload).buyer_remark

try:
    DirectOrderRequest(**base, buyer_remark="\u6d4b" * 501)
except ValidationError:
    values["five_hundred_one_rejected"] = True
else:
    values["five_hundred_one_rejected"] = False

try:
    DirectOrderRequest(**base, buyer_remark=123)
except ValidationError:
    values["non_string_rejected"] = True
else:
    values["non_string_rejected"] = False

print(json.dumps(values, ensure_ascii=True))
`;
  const result = spawnSync('backend\\.venv\\Scripts\\python.exe', ['-c', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'backend' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    missing: null,
    null: null,
    empty: null,
    blank: null,
    trimmed: '请放门口\n第二行',
    five_hundred: '测'.repeat(500),
    five_hundred_one_rejected: true,
    non_string_rejected: true,
  });
});

test('[BUYER-REMARK-3] direct order route uses the new parameterized procedure and returns the remark', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const route = sliceBetween(backend, '@app.post("/orders/direct")', '@app.post("/orders/cancel")');

  assert.ok(backend.includes('buyer_remark: str | None'));
  assert.ok(route.includes('validate_sku_for_purchase(conn, req.sku_id, req.quantity)'));
  assert.match(route, /CALL sp_create_direct_order_with_remark\([\s\S]*%s,[\s\S]*%s,[\s\S]*%s,[\s\S]*%s,[\s\S]*%s,/);
  assert.ok(route.includes('req.buyer_remark'));
  assert.match(route, /SELECT[\s\S]*buyer_remark,[\s\S]*FROM v_order_summary/);
});

test('[BUYER-REMARK-4] every explicit order summary and detail query exposes the remark', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const queryHeads = (viewName) => backend
    .split(`FROM ${viewName}`)
    .slice(0, -1)
    .map((chunk) => chunk.slice(chunk.lastIndexOf('SELECT')));
  const summaryQueries = queryHeads('v_order_summary')
    .filter((query) => /\border_id\s*,/.test(query));
  const detailQueries = queryHeads('v_user_order_detail');

  assert.ok(summaryQueries.length >= 8);
  assert.ok(detailQueries.length >= 4);
  assert.ok(summaryQueries.every((query) => /\bbuyer_remark\b/.test(query)));
  assert.ok(detailQueries.every((query) => /\bbuyer_remark\b/.test(query)));
});

test('[BUYER-REMARK-5] buy modal owns a counted textarea while cart and details keep it hidden', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderPurchaseModal() {', "async function openPurchaseModal(product, action = 'buy') {");

  assert.match(html, /data-purchase-remark-section/);
  assert.match(html, /data-purchase-buyer-remark[^>]*maxlength="500"/);
  assert.ok(html.includes('买家备注（选填）'));
  assert.ok(html.includes('可填写尺码偏好、配送说明等，最多 500 字'));
  assert.match(html, /data-purchase-buyer-remark-count>0 \/ 500</);
  assert.ok(mainJs.includes('activePurchaseBuyerRemark'));
  assert.ok(renderBody.includes("purchaseRemarkSection.hidden = actionConfig.key !== 'buy';"));
  assert.ok(renderBody.includes('purchaseBuyerRemarkCount.textContent = `${activePurchaseBuyerRemark.length} / 500`;'));
  assert.match(styles, /\.purchase-buyer-remark\s*\{[\s\S]*?max-width:\s*100%;/);
  assert.match(styles, /\.purchase-buyer-remark\s*\{[\s\S]*?resize:\s*vertical;/);
});

test('[BUYER-REMARK-6] remark state survives redraws, clears at session boundaries, and is locked during submit', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const openBody = sliceBetween(mainJs, "async function openPurchaseModal(product, action = 'buy') {", 'function closePurchaseModal() {');
  const closeBody = sliceBetween(mainJs, 'function closePurchaseModal() {', 'function renderImageLightbox() {');
  const submitBody = sliceBetween(mainJs, 'async function submitPurchaseOrder() {', "function openSidebar(section = 'account') {");

  assert.ok(mainJs.includes("purchaseBuyerRemark.addEventListener('input'"));
  assert.ok(openBody.includes("activePurchaseBuyerRemark = '';"));
  assert.ok(closeBody.includes("activePurchaseBuyerRemark = '';"));
  assert.ok(submitBody.includes('isPurchaseSubmitting'));
  assert.ok(submitBody.includes('purchaseBuyerRemark.disabled = true'));
  assert.ok(submitBody.includes('purchaseBuyerRemark.disabled = false'));
  assert.ok(submitBody.includes("activePurchaseBuyerRemark = '';"));
});

test('[BUYER-REMARK-7] only the direct-order request sends normalized buyer_remark', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const directBody = sliceBetween(mainJs, 'async function createDirectOrderFromApi(', 'async function createOrderFromCartFromApi()');
  const cartBody = sliceBetween(mainJs, 'async function createOrderFromCartFromApi()', 'async function createOrderFromSelectedCartFromApi(');
  const payBody = sliceBetween(mainJs, 'async function payOrderFromApi(', 'async function payOrderWithPasswordPrompt(');

  assert.ok(directBody.includes('buyer_remark: normalizedBuyerRemark || null'));
  assert.ok(directBody.includes('.trim()'));
  assert.doesNotMatch(cartBody, /buyer_remark/);
  assert.doesNotMatch(payBody, /buyer_remark/);
});

test('[BUYER-REMARK-8] shared user and admin order details safely render multiline remarks with an empty fallback', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const styles = readFileSync('src/styles.css', 'utf8');
  const detailBody = sliceBetween(mainJs, 'function renderApiOrderDetail(detail) {', 'async function showOrderDetail(orderId) {');

  assert.ok(detailBody.includes('买家备注：'));
  assert.ok(detailBody.includes('escapeHtml(summary.buyer_remark || "无")'));
  assert.match(detailBody, /order-detail__buyer-remark/);
  assert.match(styles, /\.order-detail__buyer-remark\s*\{[\s\S]*white-space:\s*pre-wrap;/);
});

test('[CART-CHECKOUT-10-1] selected-cart order model normalizes the optional buyer remark', () => {
  const script = String.raw`
import json
from pydantic import ValidationError
from app.main import OrderFromSelectedCartRequest

base = {"user_id": 2, "address_id": 3, "cart_item_ids": [11]}
values = {}
for name, value in {
    "missing": ...,
    "null": None,
    "blank": "  \n ",
    "trimmed": "  \u8bf7\u5206\u5f00\u5305\u88c5\n\u7b2c\u4e8c\u884c  ",
    "five_hundred": "\u6d4b" * 500,
}.items():
    payload = dict(base)
    if value is not ...:
        payload["buyer_remark"] = value
    values[name] = OrderFromSelectedCartRequest(**payload).buyer_remark

try:
    OrderFromSelectedCartRequest(**base, buyer_remark="\u6d4b" * 501)
except ValidationError:
    values["five_hundred_one_rejected"] = True
else:
    values["five_hundred_one_rejected"] = False

print(json.dumps(values, ensure_ascii=True))
`;
  const result = spawnSync('backend\\.venv\\Scripts\\python.exe', ['-c', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, PYTHONPATH: 'backend' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    missing: null,
    null: null,
    blank: null,
    trimmed: '请分开包装\n第二行',
    five_hundred: '测'.repeat(500),
    five_hundred_one_rejected: true,
  });
});

test('[CART-CHECKOUT-10-2] idempotent migration adds a compatible selected-cart remark procedure', () => {
  const migrationPath = 'sql语句/08_购物车选中项备注下单增量迁移.sql';
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);

  const migration = readFileSync(migrationPath, 'utf8');
  assert.match(migration, /CREATE PROCEDURE sp_create_order_from_selected_cart_items_with_remark/i);
  assert.match(migration, /IN p_cart_item_ids JSON[\s\S]*IN p_buyer_remark VARCHAR\(500\)/i);
  assert.match(migration, /INSERT INTO order_main\([\s\S]*buyer_remark[\s\S]*VALUES\([\s\S]*v_buyer_remark/i);
  assert.match(migration, /DECLARE EXIT HANDLER FOR SQLEXCEPTION[\s\S]*ROLLBACK[\s\S]*RESIGNAL/i);
  assert.match(migration, /INSERT IGNORE INTO tmp_selected_cart_item/i);
  assert.match(migration, /DELETE ci[\s\S]*JOIN tmp_selected_cart_item/i);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DROP\s+DATABASE/i);
  assert.doesNotMatch(migration, /DROP PROCEDURE IF EXISTS sp_create_order_from_selected_cart_items\s*(?:;|\$\$)/i);
});

test('[CART-CHECKOUT-10-3] selected-cart API sends remark to the compatible procedure and keeps pay unchanged', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const selectedRoute = sliceBetween(backend, '@app.post("/orders/from-cart-selected")', '@app.post("/orders/pay")');
  const payRoute = sliceBetween(backend, '@app.post("/orders/pay")', '@app.post("/orders/direct")');
  const legacyModel = sliceBetween(backend, 'class OrderFromCartRequest(BaseModel):', 'class OrderFromSelectedCartRequest(BaseModel):');
  const payModel = sliceBetween(backend, 'class PayOrderRequest(BaseModel):', 'class AddressAddRequest(BaseModel):');

  assert.ok(selectedRoute.includes('CALL sp_create_order_from_selected_cart_items_with_remark'));
  assert.ok(selectedRoute.includes('req.buyer_remark'));
  assert.match(selectedRoute, /SELECT[\s\S]*buyer_remark,[\s\S]*FROM v_order_summary/);
  assert.doesNotMatch(legacyModel, /buyer_remark/);
  assert.doesNotMatch(payModel, /buyer_remark/);
  assert.doesNotMatch(payRoute, /req\.buyer_remark/);
});

test('[CART-CHECKOUT-10-4] cart renders order-first checkout and owns an in-memory counted remark', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderCartSummary(', 'function getValidCartSelectionIds(');
  const createBody = sliceBetween(mainJs, 'async function createOrderFromSelectedCartFromApi(', 'function getSelectedCartItemIds(');

  assert.ok(mainJs.includes('const cartCheckoutState ='));
  assert.ok(mainJs.includes('buyerRemark'));
  assert.ok(mainJs.includes('checkoutStep'));
  assert.ok(renderBody.includes('data-cart-checkout-remark'));
  assert.ok(renderBody.includes('data-cart-checkout-remark-count'));
  assert.match(renderBody, /maxlength="500"/);
  assert.ok(renderBody.includes("? '正在下单…' : '下单'"));
  assert.ok(renderBody.includes('请先勾选要下单的商品'));
  assert.ok(createBody.includes('buyer_remark:'));
  assert.doesNotMatch(createBody, /pay_method|pay_password/);
});

test('[CART-CHECKOUT-10-5] payment UI appears only after order creation and never recreates the order', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderCartSummary(', 'function getValidCartSelectionIds(');
  const submitBody = sliceBetween(mainJs, 'async function submitCartCheckout()', 'function formatOrderStatus(');
  const payBody = sliceBetween(mainJs, 'async function submitCreatedCartOrderPayment()', 'function formatOrderStatus(');

  assert.ok(renderBody.includes("cartCheckoutState.checkoutStep === 'payment'"));
  assert.ok(renderBody.includes('选择支付方式'));
  assert.ok(renderBody.includes('输入支付密码'));
  assert.ok(renderBody.includes('稍后支付'));
  assert.ok(submitBody.includes('createOrderFromSelectedCartFromApi'));
  assert.doesNotMatch(submitBody, /payOrderWithPasswordPrompt|promptPaymentMethod/);
  assert.ok(payBody.includes('payOrderFromApi'));
  assert.doesNotMatch(payBody, /createOrderFromSelectedCartFromApi|from-cart-selected/);
});

test('[CART-CHECKOUT-10-6] cart checkout state clears only at successful or explicit session boundaries', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const closeBody = sliceBetween(mainJs, 'function closeSidebar()', 'function getActiveSidebarScrollContainer()');
  const submitBody = sliceBetween(mainJs, 'async function submitCartCheckout()', 'function formatOrderStatus(');
  const deleteBody = sliceBetween(mainJs, 'async function deleteCartItemFromApi(', 'function renderFavoritesShelf(');

  assert.ok(closeBody.includes("resetCartCheckoutState('cart')"));
  assert.ok(submitBody.includes("cartCheckoutState.checkoutStep = 'payment'"));
  assert.ok(submitBody.includes('cartCheckoutState.buyerRemark ='));
  assert.ok(deleteBody.includes('selectedCartItemIds'));
  assert.ok(mainJs.includes('正在下单…'));
  assert.ok(mainJs.includes('订单已创建，可在我的订单中继续支付'));
});

test('[CART-CHECKOUT-10-7] select-all targets only checkoutable rows and creation locks cart controls', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const renderBody = sliceBetween(mainJs, 'function renderCartSummary(', 'function getValidCartSelectionIds(');
  const selectAllBody = sliceBetween(mainJs, 'function toggleAllCheckoutableCartItems(', 'function updateCartQuantity(');
  const shelfBody = sliceBetween(mainJs, 'function renderCartShelf(', 'function renderCartSummary(');

  assert.ok(renderBody.includes('data-cart-select-all'));
  assert.ok(selectAllBody.includes('isCartItemCheckoutable(item)'));
  assert.ok(selectAllBody.includes('saveStoredCartSelections'));
  assert.ok(shelfBody.includes('cartCheckoutState.isCreatingOrder'));
  assert.ok(mainJs.includes('请先添加或选择收货地址'));
});

test('[CART-CHECKOUT-10-8] expected payment rejection stays out of browser error logs', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const payBody = sliceBetween(mainJs, 'async function submitCreatedCartOrderPayment()', 'function deferCreatedCartOrderPayment()');

  assert.ok(payBody.includes("console.warn('购物车订单支付失败：', error)"));
  assert.doesNotMatch(payBody, /console\.error\(['"]购物车订单支付失败/);
});

test('[CATEGORY-13-1] category helpers keep database identity stable and static fallbacks deterministic', async () => {
  const modulePath = 'src/category-utils.js';
  assert.equal(existsSync(modulePath), true, `${modulePath} should exist`);

  const {
    ALL_CATEGORY_KEY,
    createApiCategoryKey,
    createStaticCategoryKey,
    normalizeApiCategory,
  } = await import('../src/category-utils.js');
  const beforeRename = normalizeApiCategory({ category_id: 7, category_name: '连衣裙', sort_order: 10, product_count: 2 });
  const afterRename = normalizeApiCategory({ category_id: 7, category_name: '礼服裙', sort_order: 10, product_count: 2 });

  assert.equal(ALL_CATEGORY_KEY, 'all');
  assert.equal(createApiCategoryKey(7), 'category:7');
  assert.equal(createStaticCategoryKey(' 日常轻搭 '), 'static:日常轻搭');
  assert.equal(beforeRename.key, afterRename.key);
  assert.equal(afterRename.name, '礼服裙');
});

test('[CATEGORY-13-2] category helpers sort API rows and derive database categories without mutating products', async () => {
  assert.equal(existsSync('src/category-utils.js'), true, 'src/category-utils.js should exist');
  const { deriveApiCategoriesFromProducts, normalizeApiCategories } = await import('../src/category-utils.js');
  const rows = [
    { category_id: 3, category_name: '外套', sort_order: 20, product_count: 1 },
    { category_id: 2, category_name: '半身裙', sort_order: 10, product_count: 1 },
    { category_id: 1, category_name: '连衣裙', sort_order: 10, product_count: 0 },
  ];
  const products = [
    { productId: 1, categoryId: 3, category: '外套' },
    { productId: 2, categoryId: 3, category: '外套' },
    { productId: 3, categoryId: 2, category: '半身裙' },
  ];
  const snapshot = structuredClone(products);

  assert.deepEqual(normalizeApiCategories(rows).map((item) => item.categoryId), [2, 1, 3]);
  assert.deepEqual(deriveApiCategoriesFromProducts(products).map((item) => [item.categoryId, item.productCount]), [[2, 1], [3, 2]]);
  assert.deepEqual(products, snapshot);
});

test('[CATEGORY-13-3] category filtering combines stable category ids with search text and resets invalid keys', async () => {
  assert.equal(existsSync('src/category-utils.js'), true, 'src/category-utils.js should exist');
  const { filterProductsByCategory, resolveActiveCategoryKey } = await import('../src/category-utils.js');
  const products = [
    { productId: 1, categoryId: 7, category: '礼服裙', name: '海盐长裙' },
    { productId: 2, categoryId: 8, category: '外套', name: '星夜风衣' },
  ];
  const categories = [{ key: 'category:7' }, { key: 'category:8' }];

  assert.deepEqual(filterProductsByCategory(products, 'category:7', '海盐').map((item) => item.productId), [1]);
  assert.deepEqual(filterProductsByCategory(products, 'category:7', '风衣'), []);
  assert.equal(resolveActiveCategoryKey('category:7', categories), 'category:7');
  assert.equal(resolveActiveCategoryKey('category:99', categories), 'all');
});

test('[CATEGORY-13-4] backend exposes shared counted category queries and fixed public and admin routes', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const queryBody = sliceBetween(backend, 'def query_categories(', '@app.get("/categories")');
  const routes = sliceBetween(backend, '@app.get("/categories")', '@app.post("/products")');

  assert.ok(queryBody.includes('COUNT(DISTINCT CASE WHEN p.is_deleted = 0 THEN p.id END)'));
  assert.ok(queryBody.includes("p.status = 'ON_SALE'"));
  assert.ok(queryBody.includes("p.status <> 'ON_SALE'"));
  assert.ok(queryBody.includes('ORDER BY c.is_deleted ASC, c.sort_order ASC, c.name ASC, c.id ASC'));
  assert.ok(routes.includes('@app.get("/categories")'));
  assert.ok(routes.includes('@app.get("/admin/categories")'));
  assert.ok(routes.includes('require_admin_user(authorization)'));
});

test('[CATEGORY-13-5] category request models normalize names and enforce reserved name and sort boundaries', () => {
  const script = String.raw`
import json
from pydantic import ValidationError
from app.main import CategoryCreateRequest, CategoryUpdateRequest

result = {"trimmed": CategoryCreateRequest(name="  连衣裙  ", sort_order=10).name}
for key, payload in {
    "blank": {"name": "   ", "sort_order": 0},
    "reserved": {"name": "全部", "sort_order": 0},
    "too_long": {"name": "测" * 81, "sort_order": 0},
    "negative": {"name": "连衣裙", "sort_order": -1},
    "too_large": {"name": "连衣裙", "sort_order": 10000},
}.items():
    try:
        CategoryUpdateRequest(**payload)
    except ValidationError:
        result[key] = True
    else:
        result[key] = False
print(json.dumps(result, ensure_ascii=True))
`;
  const result = spawnSync('backend\\.venv\\Scripts\\python.exe', ['-c', script], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PYTHONPATH: 'backend' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    trimmed: '连衣裙', blank: true, reserved: true, too_long: true, negative: true, too_large: true,
  });
});

test('[CATEGORY-13-6] category mutation routes are authenticated transactional logical operations', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const categoryRoutes = sliceBetween(backend, '@app.get("/admin/categories")', '@app.patch("/admin/products/{product_id}/category")');

  for (const route of [
    '@app.post("/admin/categories")',
    '@app.patch("/admin/categories/{category_id}")',
    '@app.delete("/admin/categories/{category_id}")',
    '@app.post("/admin/categories/{category_id}/restore")',
  ]) assert.ok(categoryRoutes.includes(route), `${route} should exist`);
  assert.ok(categoryRoutes.includes('require_admin_user(authorization)'));
  assert.ok(categoryRoutes.includes('FOR UPDATE'));
  assert.ok(categoryRoutes.includes('conn.commit()'));
  assert.ok(categoryRoutes.includes('conn.rollback()'));
  assert.ok(categoryRoutes.includes('SET is_deleted = 1'));
  assert.ok(categoryRoutes.includes('分类下仍有商品，请先移动商品'));
  assert.doesNotMatch(categoryRoutes, /DELETE\s+FROM\s+category/i);
});

test('[CATEGORY-13-7] product category movement changes only category_id and reports idempotency', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const route = sliceBetween(backend, '@app.patch("/admin/products/{product_id}/category")', '@app.post("/products")');

  assert.ok(route.includes('require_admin_user(authorization)'));
  assert.match(route, /UPDATE product\s+SET category_id = %s\s+WHERE id = %s/);
  assert.ok(route.includes('changed'));
  assert.ok(route.includes('category_name'));
  assert.doesNotMatch(route, /UPDATE\s+product_sku|UPDATE\s+inventory|UPDATE\s+product_image/i);
});

test('[CATEGORY-13-8] product creation prefers category_id and never creates or restores categories implicitly', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const route = sliceBetween(backend, '@app.post("/products")', '@app.post("/admin/products/{product_id}/images")');

  assert.ok(route.includes('category_id: int | None = Form(None)'));
  assert.ok(route.includes('category_name: str | None = Form(None)'));
  assert.ok(route.includes('分类不存在，请先在分类管理中创建'));
  assert.doesNotMatch(route, /INSERT\s+INTO\s+category/i);
  assert.doesNotMatch(route, /ON\s+DUPLICATE\s+KEY\s+UPDATE/i);
});

test('[CATEGORY-13-9] admin markup exposes category management and existing-category product selection', () => {
  const html = readFileSync('admin.html', 'utf8');
  const categoryPanel = sliceBetween(html, 'data-admin-panel="categories"', 'data-admin-panel="product-create"');
  const productCreate = sliceBetween(html, 'data-admin-panel="product-create"', 'data-admin-panel="stats"');

  assert.ok(html.includes('data-admin-nav-target="categories"'));
  assert.ok(categoryPanel.includes('data-admin-category-form'));
  assert.ok(categoryPanel.includes('data-admin-category-filter'));
  assert.ok(categoryPanel.includes('data-admin-category-list'));
  assert.ok(productCreate.includes('<select name="category_id"'));
  assert.ok(productCreate.includes('data-admin-product-category-select'));
  assert.doesNotMatch(productCreate, /<input[^>]+name="category"/);
});

test('[CATEGORY-13-10] admin frontend owns category CRUD state and per-product category adjustment', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const cardRender = sliceBetween(mainJs, 'function renderProducts() {', 'async function updateAdminSkuStockToApi(');

  assert.ok(mainJs.includes('loadAdminCategoriesFromApi'));
  assert.ok(mainJs.includes('refreshAdminCategoriesFromApi'));
  assert.ok(mainJs.includes('createAdminCategoryToApi'));
  assert.ok(mainJs.includes('updateAdminCategoryToApi'));
  assert.ok(mainJs.includes('deleteAdminCategoryToApi'));
  assert.ok(mainJs.includes('restoreAdminCategoryToApi'));
  assert.ok(mainJs.includes('updateAdminProductCategoryToApi'));
  assert.ok(cardRender.includes('data-admin-product-category-select'));
  assert.ok(cardRender.includes('data-admin-product-category-save'));
});

test('[CATEGORY-13-11] storefront loads database categories and filters database products by category id', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const mapper = sliceBetween(mainJs, 'function convertApiProducts(', 'async function loadProductsFromApi()');
  const renderer = sliceBetween(mainJs, 'function renderCollections()', 'function renderProducts()');

  assert.ok(mainJs.includes("from './category-utils.js"));
  assert.ok(mainJs.includes('loadCategoriesFromApi'));
  assert.ok(mainJs.includes('deriveApiCategoriesFromProducts'));
  assert.ok(mapper.includes('categoryId: Number(row.category_id)'));
  assert.ok(renderer.includes('activeCategoryKey'));
  assert.ok(renderer.includes('filterProductsByCategory'));
  assert.ok(renderer.includes('aria-pressed'));
  assert.ok(renderer.includes('productCount > 0'));
});

test('[CATEGORY-13-12] category UI includes responsive editable list styling without changing SQL files', () => {
  const styles = readFileSync('src/styles.css', 'utf8');

  assert.match(styles, /\.admin-category-list\s*\{/);
  assert.match(styles, /\.admin-category-row\s*\{/);
  assert.match(styles, /\.admin-product-category-control\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.admin-category-row/);
  assert.equal(existsSync('sql语句/09_商品分类管理增量迁移.sql'), false);
});

test('[TAGS-14-1] tag helpers keep database identity stable and normalize counted API rows', async () => {
  assert.equal(existsSync('src/tag-utils.js'), true, 'src/tag-utils.js should exist');
  const {
    ALL_TAG_KEY,
    createApiTagKey,
    normalizeApiTag,
    normalizeApiTags,
  } = await import('../src/tag-utils.js');

  const beforeRename = normalizeApiTag({
    tag_id: 7,
    tag_name: ' 夏季新品 ',
    sort_order: 10,
    product_count: 3,
    on_sale_product_count: 2,
  });
  const afterRename = normalizeApiTag({ tag_id: 7, tag_name: '清凉系列', sort_order: 10 });

  assert.equal(ALL_TAG_KEY, 'all-tags');
  assert.equal(createApiTagKey(7), 'tag:7');
  assert.equal(beforeRename.key, afterRename.key);
  assert.equal(beforeRename.name, '夏季新品');
  assert.equal(beforeRename.productCount, 3);
  assert.equal(beforeRename.onSaleProductCount, 2);
  assert.deepEqual(
    normalizeApiTags([
      { tag_id: 3, tag_name: '外套', sort_order: 20 },
      { tag_id: 2, tag_name: '半身裙', sort_order: 10 },
      { tag_id: 1, tag_name: '连衣裙', sort_order: 10 },
      { tag_id: 2, tag_name: '重复项', sort_order: 99 },
    ]).map((item) => item.tagId),
    [2, 1, 3],
  );
  assert.deepEqual(
    normalizeApiTags([
      { tag_id: 3, tag_name: '外套', sort_order: 20 },
      { tag_id: 1, tag_name: '连衣裙', sort_order: 10 },
      { tag_id: 2, tag_name: '半身裙', sort_order: 10 },
    ], { preserveInputOrder: true }).map((item) => item.tagId),
    [3, 1, 2],
  );
});

test('[TAGS-14-2] product tag helpers deduplicate sort and preserve static badge fallbacks', async () => {
  const {
    createStaticProductTags,
    createStaticTagKey,
    getVisibleProductTags,
    normalizeProductTags,
  } = await import('../src/tag-utils.js');

  const tags = normalizeProductTags([
    { tag_id: 9, tag_name: '推荐', sort_order: 20 },
    { tag_id: 8, tag_name: '新品', sort_order: 10 },
    { tag_id: 9, tag_name: '重复推荐', sort_order: 0 },
    { tag_id: 7, tag_name: '热卖', sort_order: 15 },
    { tag_id: 6, tag_name: '夏季', sort_order: 30 },
  ]);
  const visible = getVisibleProductTags(tags, 3);
  const staticTags = createStaticProductTags(' 主题限定 ');

  assert.deepEqual(tags.map((tag) => tag.tagId), [8, 7, 9, 6]);
  assert.equal(visible.visible.length, 3);
  assert.equal(visible.overflowCount, 1);
  assert.equal(staticTags[0].key, createStaticTagKey('主题限定'));
  assert.equal(staticTags[0].name, '主题限定');
  assert.deepEqual(createStaticProductTags('   '), []);
});

test('[TAGS-14-3] tag filtering composes with category and search without mutating products', async () => {
  const {
    ALL_TAG_KEY,
    createApiTagKey,
    filterProductsByTag,
    resolveActiveTagKey,
  } = await import('../src/tag-utils.js');
  const products = [
    { productId: 1, name: '海盐长裙', tags: [{ tagId: 7, name: '夏季新品' }] },
    { productId: 2, name: '星夜风衣', tags: [{ tagId: 8, name: '通勤' }] },
  ];
  const snapshot = structuredClone(products);
  const tags = [{ key: createApiTagKey(7) }, { key: createApiTagKey(8) }];

  assert.deepEqual(filterProductsByTag(products, 'tag:7').map((item) => item.productId), [1]);
  assert.deepEqual(filterProductsByTag(products, ALL_TAG_KEY).map((item) => item.productId), [1, 2]);
  assert.equal(resolveActiveTagKey('tag:7', tags), 'tag:7');
  assert.equal(resolveActiveTagKey('tag:99', tags), ALL_TAG_KEY);
  assert.deepEqual(products, snapshot);
});

test('[TAGS-14-4] idempotent migration creates safe tag and product tag tables only', () => {
  const migrationPath = 'sql语句/09_商品多标签增量迁移.sql';
  assert.equal(existsSync(migrationPath), true, `${migrationPath} should exist`);
  const migration = readFileSync(migrationPath, 'utf8');

  assert.match(migration, /USE frieren_cloth_shop_db/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS tag\s*\(/i);
  assert.match(migration, /name VARCHAR\(40\) NOT NULL/i);
  assert.match(migration, /UNIQUE KEY uk_tag_name \(name\)/i);
  assert.match(migration, /KEY idx_tag_deleted_sort \(is_deleted, sort_order, name\)/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS product_tag\s*\(/i);
  assert.match(migration, /PRIMARY KEY \(product_id, tag_id\)/i);
  assert.match(migration, /KEY idx_product_tag_tag_product \(tag_id, product_id\)/i);
  assert.match(migration, /FOREIGN KEY \(product_id\) REFERENCES product\(id\)/i);
  assert.match(migration, /FOREIGN KEY \(tag_id\) REFERENCES tag\(id\)/i);
  assert.match(migration, /ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci/i);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM|INSERT\s+INTO\s+tag/i);
});

test('[TAGS-14-5] tag request models enforce names sort limits strict positive ids and five-tag maximum', () => {
  const script = String.raw`
import json
from pydantic import ValidationError
from app.main import TagCreateRequest, AdminProductTagsUpdateRequest

result = {"trimmed": TagCreateRequest(name="  夏季新品  ", sort_order=10).name}
for key, payload in {
    "blank": {"name": "   ", "sort_order": 0},
    "reserved_all_tags": {"name": "全部标签", "sort_order": 0},
    "reserved_all": {"name": "全部", "sort_order": 0},
    "too_long": {"name": "测" * 41, "sort_order": 0},
    "negative_sort": {"name": "夏季", "sort_order": -1},
    "large_sort": {"name": "夏季", "sort_order": 10000},
}.items():
    try:
        TagCreateRequest(**payload)
    except ValidationError:
        result[key] = True
    else:
        result[key] = False

for key, values in {
    "missing_rejected": None,
    "six_rejected": [1, 2, 3, 4, 5, 6],
    "zero_rejected": [0],
    "negative_rejected": [-1],
    "string_rejected": ["1"],
}.items():
    try:
        AdminProductTagsUpdateRequest() if values is None else AdminProductTagsUpdateRequest(tag_ids=values)
    except ValidationError:
        result[key] = True
    else:
        result[key] = False

result["deduplicated"] = AdminProductTagsUpdateRequest(tag_ids=[3, 1, 3, 2]).tag_ids
print(json.dumps(result, ensure_ascii=True))
`;
  const result = spawnSync('backend\\.venv\\Scripts\\python.exe', ['-c', script], {
    cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, PYTHONPATH: 'backend' },
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    trimmed: '夏季新品',
    blank: true,
    reserved_all_tags: true,
    reserved_all: true,
    too_long: true,
    negative_sort: true,
    large_sort: true,
    missing_rejected: true,
    six_rejected: true,
    zero_rejected: true,
    negative_rejected: true,
    string_rejected: true,
    deduplicated: [3, 1, 2],
  });
});

test('[TAGS-14-6] backend exposes shared counted tag queries and authenticated transactional routes', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const helpers = sliceBetween(backend, 'def query_tags(', '@app.get("/tags")');
  const routes = sliceBetween(backend, '@app.get("/tags")', '@app.patch("/admin/products/{product_id}/category")');

  assert.ok(helpers.includes('COUNT(DISTINCT CASE WHEN p.is_deleted = 0 THEN p.id END)'));
  assert.ok(helpers.includes("p.status = 'ON_SALE'"));
  assert.ok(helpers.includes('ORDER BY t.is_deleted ASC, t.sort_order ASC, t.name ASC, t.id ASC'));
  assert.ok(backend.includes('def query_product_tags('));
  assert.ok(backend.includes('def attach_product_tags('));
  assert.ok(backend.includes('def validate_active_tag_ids('));
  assert.ok(helpers.includes('tag_id=tag_id'));
  for (const route of [
    '@app.get("/tags")',
    '@app.get("/admin/tags")',
    '@app.post("/admin/tags")',
    '@app.patch("/admin/tags/{tag_id}")',
    '@app.delete("/admin/tags/{tag_id}")',
    '@app.post("/admin/tags/{tag_id}/restore")',
    '@app.patch("/admin/products/{product_id}/tags")',
  ]) {
    assert.ok(routes.includes(route), `${route} should exist`);
  }
  assert.ok(routes.includes('require_admin_user(authorization)'));
  assert.ok(routes.includes('FOR UPDATE'));
  assert.ok(routes.includes('conn.commit()'));
  assert.ok(routes.includes('conn.rollback()'));
  assert.ok(routes.includes('标签仍关联商品，请先解除关联'));
  for (const [routeStart, routeEnd, responseQuery] of [
    ['@app.post("/admin/tags")', '@app.patch("/admin/tags/{tag_id}")', 'query_tag_by_id(conn, tag_id)'],
    ['@app.patch("/admin/tags/{tag_id}")', '@app.delete("/admin/tags/{tag_id}")', 'query_tag_by_id(conn, tag_id)'],
    ['@app.post("/admin/tags/{tag_id}/restore")', '@app.patch("/admin/products/{product_id}/tags")', 'query_tag_by_id(conn, tag_id)'],
    ['@app.patch("/admin/products/{product_id}/tags")', '@app.get("/categories")', 'query_product_tags(conn, [product_id])'],
  ]) {
    const routeBody = sliceBetween(backend, routeStart, routeEnd);
    assert.ok(routeBody.indexOf(responseQuery) < routeBody.indexOf('conn.commit()'), `${routeStart} should build its response before commit`);
  }
});

test('[TAGS-14-7] product list inventory and creation share tags with the product transaction', () => {
  const backend = readFileSync('backend/app/main.py', 'utf8');
  const publicProducts = sliceBetween(backend, '@app.get("/products")', '@app.post("/admin/login")');
  const createProduct = sliceBetween(backend, '@app.post("/products")', '@app.post("/admin/products/{product_id}/images")');
  const inventory = sliceBetween(backend, '@app.get("/admin/inventory")', '@app.post("/admin/inventory/update-stock")');

  assert.ok(publicProducts.includes('attach_product_tags(conn, rows)'));
  assert.ok(inventory.includes('attach_product_tags(conn, rows)'));
  assert.ok(createProduct.includes('tag_ids_json: str | None = Form(None)'));
  assert.ok(createProduct.includes('parse_tag_ids_json(tag_ids_json)'));
  assert.ok(createProduct.includes('validate_active_tag_ids(cursor, tag_ids)'));
  assert.ok(createProduct.includes('INSERT INTO product_tag'));
  assert.ok(createProduct.includes('attach_product_tags(conn, rows)'));
  assert.ok(createProduct.indexOf('INSERT INTO product_tag') < createProduct.indexOf('conn.commit()'));
});

test('[TAGS-14-8] admin markup exposes tag management and replaces the legacy badge input', () => {
  const html = readFileSync('admin.html', 'utf8');
  const tagPanel = sliceBetween(html, 'data-admin-panel="tags"', 'data-admin-panel="product-create"');
  const productCreate = sliceBetween(html, 'data-admin-panel="product-create"', 'data-admin-panel="stats"');

  assert.ok(html.includes('data-admin-nav-target="tags"'));
  assert.ok(tagPanel.includes('data-admin-tag-form'));
  assert.ok(tagPanel.includes('data-admin-tag-filter'));
  assert.ok(tagPanel.includes('data-admin-tag-list'));
  assert.ok(productCreate.includes('data-admin-product-tag-options'));
  assert.ok(productCreate.includes('data-admin-product-tag-count'));
  assert.doesNotMatch(productCreate, /<input[^>]+name="badge"/);
});

test('[TAGS-14-9] admin frontend owns tag CRUD single-product assignment and product-create selection', () => {
  const mainJs = readFileSync('src/main.js', 'utf8');
  const adminRenderer = sliceBetween(mainJs, 'function renderProducts() {', 'async function updateAdminSkuStockToApi(');

  for (const helper of [
    'loadAdminTagsFromApi',
    'refreshAdminTagsFromApi',
    'createAdminTagToApi',
    'updateAdminTagToApi',
    'deleteAdminTagToApi',
    'restoreAdminTagToApi',
    'updateAdminProductTagsToApi',
  ]) {
    assert.ok(mainJs.includes(helper), `${helper} should exist`);
  }
  assert.ok(mainJs.includes('formData.append("tag_ids_json", JSON.stringify'));
  assert.ok(adminRenderer.includes('data-admin-product-tag-option'));
  assert.ok(adminRenderer.includes('data-admin-product-tags-save'));
  assert.ok(adminRenderer.includes('data-admin-product-tags-feedback'));
  assert.ok(mainJs.includes('已选择 ${selectedCount} / 5'));
  assert.ok(mainJs.includes('暂无可用标签，可先在标签管理中创建'));
  assert.ok(mainJs.includes('请先解除该标签的商品关联'));
  assert.ok(mainJs.includes('function validateAdminTagValues('));
  assert.ok(mainJs.includes("let adminTagCatalogState = 'idle'"));
  assert.ok(mainJs.includes("adminTagCatalogState = 'error'"));
  assert.ok(adminRenderer.includes('const canEditProductTags ='));
  assert.ok(adminRenderer.includes("canEditProductTags ? '' : 'disabled'"));
  assert.ok(mainJs.includes("if (adminTagCatalogState !== 'ready')"));
  assert.ok(mainJs.includes("productTagsSaveButton.textContent = '保存标签'"));
});

test('[TAGS-14-10] storefront maps displays searches and filters real tags without database badge fiction', () => {
  const html = readFileSync('index.html', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const mapper = sliceBetween(mainJs, 'function convertApiProducts(', 'async function loadProductsFromApi()');
  const searchAndFilter = sliceBetween(mainJs, 'function getProductSearchText(', 'function renderProducts()');
  const productRenderer = sliceBetween(mainJs, 'function renderProducts()', 'function updateView()');

  assert.ok(html.includes('data-product-tag-rail'));
  assert.ok(html.includes('data-active-tag'));
  assert.ok(html.includes('data-purchase-tags'));
  assert.ok(mainJs.includes("from './tag-utils.js"));
  assert.ok(mainJs.includes('loadTagsFromApi'));
  assert.ok(mapper.includes('const productTags = normalizeProductTags(row.tags, { preserveInputOrder: true })'));
  assert.ok(mapper.includes('tags: productTags'));
  assert.equal((mapper.match(/normalizeProductTags\(row\.tags,/g) || []).length, 1);
  assert.ok(mapper.includes("badge: productTags[0]?.name || ''"));
  assert.doesNotMatch(mapper, /badge:\s*["']数据库商品["']/);
  assert.ok(searchAndFilter.includes('product.tags'));
  assert.ok(searchAndFilter.includes('filterProductsByTag'));
  assert.ok(productRenderer.includes('data-product-tag-id'));
  assert.ok(mainJs.includes('tag.tagId ?? tag.key'));
  assert.ok(mainJs.includes('aria-label="商品标签：'));
  assert.ok(productRenderer.includes('const tagMarkup = renderProductTags'));
  assert.ok(productRenderer.includes('tagMarkup ?'));
  assert.ok(productRenderer.includes('overflowCount'));
});

test('[TAGS-14-11] favorite snapshots persist tags and live products remain authoritative', () => {
  const accountStore = readFileSync('src/account-store.js', 'utf8');
  const favoriteFactory = sliceBetween(accountStore, 'function createProductFavorite(', 'export function normalizeProductFavorites');
  const favoriteRenderer = sliceBetween(accountStore, 'export function renderFavoriteProductItems(', 'export function renderOrderItems');
  const mainJs = readFileSync('src/main.js', 'utf8');
  const shelfRenderer = sliceBetween(mainJs, 'function renderFavoritesShelf(', 'function formatCartMoney(');

  assert.ok(accountStore.includes("from './tag-utils.js"));
  assert.ok(favoriteFactory.includes('tags:'));
  assert.ok(favoriteFactory.includes('product?.tags'));
  assert.ok(favoriteFactory.includes('fallback?.tags'));
  assert.ok(favoriteRenderer.includes('tags:'));
  assert.ok(shelfRenderer.includes('renderProductTags'));
  assert.ok(shelfRenderer.includes('overflowCount'));
});

test('[TAGS-14-12] tag UI uses compact responsive controls without changing default ports', () => {
  const styles = readFileSync('src/styles.css', 'utf8');
  const mainJs = readFileSync('src/main.js', 'utf8');

  assert.match(styles, /\.product-tag-rail\s*\{/);
  assert.match(styles, /\.product-tags\s*\{/);
  assert.match(styles, /\.admin-tag-row\s*\{/);
  assert.match(styles, /\.admin-product-tags\s*\{/);
  assert.match(styles, /@media \(max-width: 720px\)[\s\S]*\.admin-tag-row/);
  assert.ok(mainJs.includes('const API_BASE_URL = "http://127.0.0.1:8050"'));
  assert.doesNotMatch(mainJs, /127\.0\.0\.1:8051/);
});

