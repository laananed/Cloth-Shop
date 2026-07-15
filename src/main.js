import { getAdminImageOptions, getCollections, getProducts, getSiteCopy } from './content.js?v=20260705a';
import { formatSalesRank, getSalesRankMap, parseSalesValue } from './ranking.js?v=20260709b';
import {
  compareProductsForCustomer,
  getProductUnavailableAt,
  isProductSellable,
  resolveProductAvailabilityState,
} from './product-ordering.js?v=20260715a';
import {
  buildPurchaseOrder,
  getCartItemTotal,
  getCartTotals,
  getProductSalesRows,
  getSalesSummary,
  addAdminProduct,
  getStoredAdminProducts,
  getStoredAddressBook,
  formatCountBadge,
  getCartQuantityCount,
  getFavoriteCount,
  getStoredCart,
  getStoredCartSelections,
  getStoredFavorites,
  getStoredProfile,
  isProductFavorited,
  isProductInCart,
  renderAdminProductsView,
  renderAdminStatsView,
  renderFavoriteProductItems,
  saveStoredCart,
  saveStoredAdminProducts,
  saveStoredFavorites,
  saveStoredProfile,
  saveStoredAddressBook,
  saveStoredCartSelections,
  toggleProductFavorite,
  validateAddress,
  validateRegistration,
} from './account-store.js?v=20260715d';
import {
  buildSkuMatrix,
  getDimensionOptions,
  getMissingSkuCombinations,
  getSellableProductSkus,
  isStructuredProduct,
  normalizeDimensionValues,
  resolveInitialSkuSelection,
  selectSkuDimension,
} from './sku-utils.js?v=20260715a';
import {
  createImageLightboxState,
  normalizeLightboxImages,
  wrapLightboxIndex,
} from './image-lightbox.js?v=20260715a';
import {
  ALL_CATEGORY_KEY,
  createStaticCategories,
  deriveApiCategoriesFromProducts,
  filterProductsByCategory,
  normalizeApiCategory,
  normalizeApiCategories,
  resolveActiveCategoryKey,
} from './category-utils.js?v=20260715a';

const API_BASE_URL = "http://127.0.0.1:8050";
const PRODUCT_DESCRIPTION_MAX_LENGTH = 1000;

const CURRENT_USER_ID = 2;
const CURRENT_ADDRESS_ID = 3;

const copy = getSiteCopy();
const staticCollections = getCollections();
// const products = getProducts();
// const salesRankMap = getSalesRankMap(products);
// const productsById = new Map(products.map((product) => [product.id, product]));

// 先保留原来的静态商品，用它提供图片、样式等前端展示信息
const staticProducts = getProducts();

// products 改成 let，后面会用数据库商品替换
let products = staticProducts;
let salesRankMap = getSalesRankMap(products);
let productsById = new Map(products.map((product) => [product.id, product]));
let hasLoadedProductsFromApi = false;
let hasLoadedCategoriesFromApi = false;
let apiCategoryOptions = [];
let categoryOptions = createStaticCategories(staticCollections, staticProducts);

const heroTitle = document.querySelector('[data-hero-title]');
const heroSlogan = document.querySelector('[data-hero-slogan]');
const primaryCta = document.querySelector('[data-primary-cta]');
const secondaryCta = document.querySelector('[data-secondary-cta]');
const collectionRail = document.querySelector('[data-collection-rail]');
const productGrid = document.querySelector('[data-product-grid]');
const productSearchInput = document.querySelector('[data-product-search]');
const productSearchClear = document.querySelector('[data-product-search-clear]');
const activeCollectionLabel = document.querySelector('[data-active-collection]');
const heroSection = document.querySelector('[data-hero-section]');
const hero = document.querySelector('.hero');

const authModal = document.querySelector('[data-auth-modal]');
const authCloseButtons = document.querySelectorAll('[data-auth-close]');
const authTabLogin = document.querySelector('[data-auth-tab-login]');
const authTabRegister = document.querySelector('[data-auth-tab-register]');
const loginForm = document.querySelector('[data-auth-login-form]');
const registerForm = document.querySelector('[data-auth-register-form]');
const authFeedback = document.querySelector('[data-auth-feedback]');

const purchaseModal = document.querySelector('[data-purchase-modal]');
const purchaseCloseButtons = document.querySelectorAll('[data-purchase-close]');
const purchaseTitle = document.querySelector('[data-purchase-title]');
const purchaseCategory = document.querySelector('[data-purchase-category]');
const purchaseBadge = document.querySelector('[data-purchase-badge]');
const purchasePrice = document.querySelector('[data-purchase-price]');
const purchaseSales = document.querySelector('[data-purchase-sales]');
const purchaseStatus = document.querySelector('[data-purchase-status]');
const purchaseSkuSummary = document.querySelector('[data-purchase-sku-summary]');
const purchaseDescription = document.querySelector('[data-purchase-description]');
const purchaseDescriptionSection = document.querySelector('[data-purchase-description-section]');
const purchaseImageFrame = document.querySelector('[data-purchase-image-frame]');
const purchaseImage = document.querySelector('[data-purchase-image]');
const purchaseStateStamp = purchaseModal?.querySelector('[data-product-state-stamp]') || null;
const purchaseGallery = document.querySelector('[data-purchase-gallery]');
const imageLightbox = document.querySelector('[data-image-lightbox]');
const imageLightboxStage = document.querySelector('[data-image-lightbox-stage]');
const imageLightboxImage = document.querySelector('[data-image-lightbox-image]');
const imageLightboxCounter = document.querySelector('[data-image-lightbox-counter]');
const imageLightboxHint = document.querySelector('[data-image-lightbox-hint]');
const imageLightboxLoading = document.querySelector('[data-image-lightbox-loading]');
const imageLightboxError = document.querySelector('[data-image-lightbox-error]');
const imageLightboxPrev = document.querySelector('[data-image-lightbox-prev]');
const imageLightboxNext = document.querySelector('[data-image-lightbox-next]');
const imageLightboxCloseButtons = document.querySelectorAll('[data-image-lightbox-close]');
const purchaseAddressList = document.querySelector('[data-purchase-address-list]');
const purchaseQuantityValue = document.querySelector('[data-purchase-quantity-value]');
const purchaseQuantityDecrease = document.querySelector('[data-purchase-quantity-decrease]');
const purchaseQuantityIncrease = document.querySelector('[data-purchase-quantity-increase]');
const purchasePaymentOptions = document.querySelector('[data-purchase-payment-options]');
const purchasePaymentTitle = document.querySelector('[data-purchase-payment-title]');
const purchaseSkuOptions = document.querySelector('[data-purchase-sku-options]');
const purchaseTotal = document.querySelector('[data-purchase-total]');
const purchaseSubmit = document.querySelector('[data-purchase-submit]');
const purchaseFeedback = document.querySelector('[data-purchase-feedback]');
const purchaseEyebrow = document.querySelector('.purchase-modal__eyebrow');
const purchaseAddressSection = purchaseAddressList?.closest('.purchase-modal__section') || null;
const purchaseQuantitySection = purchaseQuantityValue?.closest('.purchase-modal__section') || null;
const purchaseSkuSection = document.querySelector('[data-purchase-sku-section]');
const purchaseTotalSection = purchaseTotal?.closest('.purchase-modal__total') || null;
const purchaseRemarkSection = document.querySelector('[data-purchase-remark-section]');
const purchaseBuyerRemark = document.querySelector('[data-purchase-buyer-remark]');
const purchaseBuyerRemarkCount = document.querySelector('[data-purchase-buyer-remark-count]');

const sidebar = document.querySelector('[data-sidebar]');
const menuOpenButton = document.querySelector('[data-menu-open]');
const menuCloseButtons = document.querySelectorAll('[data-menu-close]');
const sidebarTitle = document.querySelector('[data-sidebar-title]');
const sidebarSubtitle = document.querySelector('[data-sidebar-subtitle]');
const sidebarNavButtons = document.querySelectorAll('[data-sidebar-target]');
const sidebarPanels = document.querySelectorAll('[data-sidebar-panel]');
const sidebarAddressList = document.querySelector('[data-sidebar-address-list]');
const sidebarAddressForm = document.querySelector('[data-sidebar-address-form]');
const sidebarAddressFeedback = document.querySelector('[data-sidebar-address-feedback]');
const sidebarFavoritesFeedback = document.querySelector('[data-sidebar-favorites-feedback]');
const sidebarCartFeedback = document.querySelector('[data-sidebar-cart-feedback]');
const favoritesList = document.querySelector('[data-favorites-list]');
const cartList = document.querySelector('[data-cart-list]');
const cartSummary = document.querySelector('[data-cart-summary]');
const sidebarFavoriteCount = document.querySelector('[data-sidebar-count="favorites"]');
const sidebarCartCount = document.querySelector('[data-sidebar-count="cart"]');
const ordersList = document.querySelector('[data-orders-list]');
const accountEmail = document.querySelector('[data-account-email]');
const accountDisplayName = document.querySelector('[data-account-display-name]');
const isAdminPage = Boolean(document.querySelector('[data-admin-shell]'));
const ADMIN_SESSION_STORAGE_KEY = 'cloth_shop_admin_session';
const adminShell = document.querySelector('[data-admin-shell]');
const adminLoginPanel = document.querySelector('[data-admin-login-panel]');
const adminLoginForm = document.querySelector('[data-admin-login-form]');
const adminLoginFeedback = document.querySelector('[data-admin-login-feedback]');
const adminCurrentUser = document.querySelector('[data-admin-current-user]');
const adminCurrentUserNodes = document.querySelectorAll('[data-admin-current-user]');
const adminUserChipNodes = document.querySelectorAll('[data-admin-user-chip], [data-admin-current-user]');
const adminLogoutButton = document.querySelector('[data-admin-logout]');

const storage = window.localStorage;
const pageRoot = document.documentElement;
const heroBackgroundUrl = new URL('../assets/hero-background.png', import.meta.url).href;
let activePurchaseProduct = null;
let activePurchaseImageUrl = '';
let lightboxState = createImageLightboxState();
let lightboxScrollY = 0;
const lightboxBackgroundInertState = new Map();
let activePurchaseSkuId = null;
let activePurchaseColor = null;
let activePurchaseSize = null;
let activePurchaseQuantity = 1;
let activePurchasePaymentMethod = 'alipay';
let activePurchaseAddressId = CURRENT_ADDRESS_ID;
let activePurchaseAction = 'buy';
let activePurchaseBuyerRemark = '';
let isPurchaseSubmitting = false;
let dbAddressList = [];
const cartCheckoutState = {
  selectedCartItemIds: [],
  selectedAddressId: CURRENT_ADDRESS_ID,
  buyerRemark: '',
  createdOrderId: null,
  createdOrderNo: '',
  createdOrderAmount: 0,
  createdOrderStatus: '',
  createdOrderRemark: null,
  createdOrderAddress: '',
  checkoutStep: 'cart',
  selectedPayMethod: '',
  payPassword: '',
  isCreatingOrder: false,
  isPaying: false,
  errorMessage: '',
  successMessage: '',
};
let isCartQuantityUpdating = false;
const cancellingOrderIds = new Set();
const refundingOrderIds = new Set();

function getStoredAdminSession() {
  try {
    const raw = sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      adminToken: String(parsed.admin_token || parsed.adminToken || '').trim(),
      email: String(parsed.email || '').trim(),
      adminUserId: Number(parsed.admin_user_id || parsed.adminUserId || 0),
    };
  } catch (error) {
    console.warn('读取管理员登录态失败：', error);
    return null;
  }
}

function saveStoredAdminSession(session) {
  sessionStorage.setItem(
    ADMIN_SESSION_STORAGE_KEY,
    JSON.stringify({
      admin_token: String(session?.adminToken || session?.admin_token || '').trim(),
      email: String(session?.email || '').trim(),
      admin_user_id: Number(session?.adminUserId || session?.admin_user_id || 0),
      created_at: new Date().toISOString(),
    }),
  );
}

function clearStoredAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

function getAdminIdentityLabel(session) {
  if (!session?.adminToken) {
    return '未登录';
  }

  const email = session.email || '管理员';
  const id = session.adminUserId ? ` · ID ${session.adminUserId}` : '';

  return `${email}${id}`;
}

function setAdminIdentityVisible(isLoggedIn, session) {
  const label = isLoggedIn ? getAdminIdentityLabel(session) : '';

  adminCurrentUserNodes.forEach((node) => {
    node.textContent = label;
    node.hidden = !isLoggedIn;
    node.setAttribute('aria-hidden', String(!isLoggedIn));
  });

  adminUserChipNodes.forEach((node) => {
    node.hidden = !isLoggedIn;
    node.setAttribute('aria-hidden', String(!isLoggedIn));
  });
}

function clearAdminDashboardData(targets = {}) {
  const {
    ordersBody,
    statsSummary,
    statsRows,
    productList,
    productSummary,
    categoryList,
    operationLogList,
  } = targets;
  const emptyMessage = '请先登录管理员账号';

  if (ordersBody) {
    ordersBody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">${escapeHtml(emptyMessage)}</div></td></tr>`;
  }

  if (statsSummary) {
    statsSummary.innerHTML = '';
  }

  if (statsRows) {
    statsRows.innerHTML = '';
  }

  if (productList) {
    productList.innerHTML = `<div class="admin-empty">${escapeHtml(emptyMessage)}</div>`;
  }

  if (productSummary) {
    productSummary.hidden = true;
    productSummary.innerHTML = '';
  }

  if (categoryList) {
    categoryList.innerHTML = `<div class="admin-empty">${escapeHtml(emptyMessage)}</div>`;
  }

  if (operationLogList) {
    operationLogList.innerHTML = `<div class="admin-empty">${escapeHtml(emptyMessage)}</div>`;
  }
}

function getAdminAuthHeaders() {
  const session = getStoredAdminSession();
  const headers = {};

  if (session?.adminToken) {
    headers.Authorization = `Bearer ${session.adminToken}`;
  }

  return headers;
}

async function adminFetch(url, options = {}) {
  const headers = new Headers(options.headers || {});
  const authHeaders = getAdminAuthHeaders();

  if (authHeaders.Authorization) {
    headers.set('Authorization', authHeaders.Authorization);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  let result = null;

  try {
    result = await response.json();
  } catch (error) {
    result = null;
  }

  if (response.status === 401 || response.status === 403) {
    const authError = new Error(result?.detail || '管理员登录已失效，请重新登录');
    authError.status = response.status;
    authError.detail = result?.detail || authError.message;
    throw authError;
  }

  if (!response.ok) {
    const error = new Error(result?.detail || `请求失败：${response.status}`);
    error.status = response.status;
    error.detail = result?.detail || error.message;
    throw error;
  }

  return result;
}

function renderAdminAuthState(message = '') {
  const session = getStoredAdminSession();
  const isLoggedIn = Boolean(session?.adminToken);

  document.body.classList.toggle('is-admin-authenticated', isLoggedIn);

  if (adminShell) {
    adminShell.hidden = !isLoggedIn;
    adminShell.setAttribute('aria-hidden', String(!isLoggedIn));
  }

  if (adminLoginPanel) {
    adminLoginPanel.hidden = isLoggedIn;
    adminLoginPanel.setAttribute('aria-hidden', String(isLoggedIn));
  }

  setAdminIdentityVisible(isLoggedIn, session);

  if (adminLogoutButton) {
    adminLogoutButton.hidden = !isLoggedIn;
    adminLogoutButton.disabled = !isLoggedIn;
    adminLogoutButton.setAttribute('aria-hidden', String(!isLoggedIn));
  }

  if (adminLoginFeedback) {
    adminLoginFeedback.textContent = String(message || '');
    adminLoginFeedback.classList.toggle('is-error', Boolean(message));
  }

  if (adminLoginForm) {
    const emailInput = adminLoginForm.querySelector('[data-admin-login-email]');
    const passwordInput = adminLoginForm.querySelector('[data-admin-login-password]');

    if (emailInput) {
      emailInput.value = isLoggedIn ? session.email || '' : emailInput.value;
    }

    if (passwordInput && !isLoggedIn) {
      passwordInput.value = '';
    }
  }
}

async function loginAdmin(email, password) {
  const response = await fetch(`${API_BASE_URL}/admin/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    const error = new Error(result.detail || '管理员登录失败');
    error.status = response.status;
    throw error;
  }

  saveStoredAdminSession(result);

  return result;
}

function requireAdminSessionBeforeLoading() {
  const session = getStoredAdminSession();

  renderAdminAuthState(session?.adminToken ? '' : '请先登录管理员账号');

  return Boolean(session?.adminToken);
}

const purchasePaymentMethods = [
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信支付' },
  { value: 'cod', label: '先用后付' },
];

const purchaseActionConfigs = {
  buy: {
    key: 'buy',
    label: '立即购买',
    eyebrow: '立即购买',
    submitLabel: (totalText) => `立即支付 ${totalText}`,
    pendingLabel: '正在创建待支付订单...',
    showAddress: true,
    showSku: true,
    showQuantity: true,
    showPayment: true,
    showTotal: true,
    showSubmit: true,
    showDescription: false,
    openSidebar: 'orders',
  },
  cart: {
    key: 'cart',
    label: '加入购物车',
    eyebrow: '加入购物车',
    submitLabel: () => '加入购物车',
    pendingLabel: '正在加入购物车...',
    showAddress: true,
    showSku: true,
    showQuantity: true,
    showPayment: false,
    showTotal: true,
    showSubmit: true,
    showDescription: false,
    openSidebar: 'cart',
  },
  details: {
    key: 'details',
    label: '商品详情',
    eyebrow: '商品详情',
    submitLabel: () => '',
    pendingLabel: '',
    showAddress: false,
    showSku: false,
    showQuantity: false,
    showPayment: false,
    showTotal: false,
    showSubmit: false,
    showDescription: true,
    openSidebar: '',
  },
};

function getPurchaseActionConfig(action = 'buy') {
  return purchaseActionConfigs[action] || purchaseActionConfigs.buy;
}

function getPaymentMethodLabel(method) {
  return purchasePaymentMethods.find((item) => item.value === method)?.label || '支付宝';
}

function setCartPaymentMethod(method) {
  const isAllowed = purchasePaymentMethods.some((item) => item.value === method);
  cartCheckoutState.selectedPayMethod = isAllowed ? method : '';
  cartCheckoutState.payPassword = '';
  cartCheckoutState.errorMessage = '';
  renderSidebar();
}

function setCartAddress(addressId) {
  cartCheckoutState.selectedAddressId = Number(addressId);
  cartCheckoutState.errorMessage = '';
  renderSidebar();
}

function resetCartCheckoutState(step = 'cart') {
  cartCheckoutState.selectedCartItemIds = [];
  cartCheckoutState.buyerRemark = '';
  cartCheckoutState.createdOrderId = null;
  cartCheckoutState.createdOrderNo = '';
  cartCheckoutState.createdOrderAmount = 0;
  cartCheckoutState.createdOrderStatus = '';
  cartCheckoutState.createdOrderRemark = null;
  cartCheckoutState.createdOrderAddress = '';
  cartCheckoutState.checkoutStep = step;
  cartCheckoutState.selectedPayMethod = '';
  cartCheckoutState.payPassword = '';
  cartCheckoutState.isCreatingOrder = false;
  cartCheckoutState.isPaying = false;
  cartCheckoutState.errorMessage = '';
  cartCheckoutState.successMessage = '';
}

const sidebarMeta = {
  account: {
    title: '账号信息',
    subtitle: '登录后这里会显示你的账号资料。',
  },
  address: {
    title: '收货地址',
    subtitle: '把常用地址收进这里，查看和修改都更快。',
  },
  orders: {
    title: '购买记录',
    subtitle: '这里会按时间展示你的历史订单。',
  },
  favorites: {
    title: '收藏夹',
    subtitle: '收藏过的商品会集中显示在这里。',
  },
  cart: {
    title: '购物车',
    subtitle: '你加入购物车的商品会集中显示在这里。',
  },
};

let activeCategoryKey = ALL_CATEGORY_KEY;
let activeProductSearchKeyword = '';
let activeSidebarSection = 'account';
let activeOrderStatusFilter = 'ALL';

const orderStatusFilters = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING_PAYMENT', label: '待支付' },
  { value: 'PAID', label: '已支付' },
  { value: 'REFUND_REQUESTED', label: '退款待处理' },
  { value: 'CANCELLED', label: '已取消' },
  { value: 'REFUNDED', label: '已退款' },
];
let scrollFrame = 0;

async function testLoadProductsFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);
    const result = await response.json();

    console.log("后端商品接口返回：", result);
  } catch (error) {
    console.error("请求后端商品接口失败：", error);
  }
}

function normalizeStatus(status) {
  return String(status || "").trim().toUpperCase();
}

function isOnSale(status) {
  return normalizeStatus(status) === "ON_SALE";
}

function getProductDisplayState(product) {
  const state = resolveProductAvailabilityState(product);
  const states = {
    AVAILABLE: {
      key: "AVAILABLE",
      domValue: "available",
      label: "可购买",
      message: "",
      stampAriaLabel: "",
      priority: 0,
    },
    SOLD_OUT: {
      key: "SOLD_OUT",
      domValue: "sold-out",
      label: "已售罄",
      message: "该商品已售罄，暂不可购买",
      stampAriaLabel: "商品状态：已售罄",
      priority: 1,
    },
    OFF_SALE: {
      key: "OFF_SALE",
      domValue: "off-sale",
      label: "已下架",
      message: "该商品已下架，暂不可购买",
      stampAriaLabel: "商品状态：已下架",
      priority: 2,
    },
  };

  return states[state] || states.AVAILABLE;
}

function renderProductStateStamp(productState, variant = '') {
  if (productState.key === 'AVAILABLE') {
    return '';
  }

  const variantClass = variant ? ` product-state-stamp--${variant}` : '';
  return `<span class="product-state-stamp product-state-stamp--${productState.domValue}${variantClass}" data-product-state-stamp role="img" aria-label="${productState.stampAriaLabel}">${productState.label}</span>`;
}

function getProductImages(product) {
  return normalizeLightboxImages(product, API_BASE_URL);
}

function getProductMainImage(product) {
  return getProductImages(product)[0]?.image_url || String(product?.image || '').trim();
}

function normalizeProductDescription(value) {
  return typeof value === "string" ? value.trim() : "";
}

function convertApiProducts(apiRows) {
  const productMap = new Map();

  apiRows.forEach((row, index) => {
    const productId = Number(row.product_id);
    const skuId = Number(row.sku_id);

    if (!productMap.has(productId)) {
      const imageSource =
        staticProducts[(productId - 1) % staticProducts.length] ||
        staticProducts[index % staticProducts.length] ||
        staticProducts[0];

      const dbImageUrl = String(row.image_url || "").trim();
      const productImage = dbImageUrl
        ? `${API_BASE_URL}${dbImageUrl}`
        : imageSource.image;

      productMap.set(productId, {
        // 前端原有 ranking.js 需要 id 是字符串
        id: `product-${productId}`,

        // 数据库字段
        productId,
        categoryId: Number(row.category_id),
        skuId,
        defaultSkuId: skuId,

        name: row.product_name,
        category: row.category_name,
        productStatus: normalizeStatus(row.product_status || "ON_SALE"),
        badge: "数据库商品",

        price: Number(row.price || 0),
        sales: parseSalesValue(row.total_sold_count),

        availableStock: Number(row.available_stock || 0),
        lockedStock: Number(row.locked_stock || 0),
        productUpdatedAt: row.product_updated_at || "",

        skuList: [
          {
            skuId,
            skuCode: row.sku_code,
            color: row.color,
            size: row.size,
            skuName: row.sku_name,
            price: Number(row.price || 0),
            availableStock: Number(row.available_stock || 0),
            lockedStock: Number(row.locked_stock || 0),
            skuIsDeleted: Number(row.sku_is_deleted || 0),
            inventoryUpdatedAt: row.inventory_updated_at || "",
            skuStatus: normalizeStatus(row.sku_status || "ON_SALE"),
          },
        ],

        detail: normalizeProductDescription(row.description),
        skuSummary: "",

        // 优先使用数据库图片；没有 image_url 时才复用原来的静态图片
        image: productImage,
        images: getProductImages(row),
        imageFit: dbImageUrl ? "cover" : imageSource.imageFit,
        imageFocus: dbImageUrl ? "center top" : imageSource.imageFocus,
        imageZoom: dbImageUrl ? 1 : imageSource.imageZoom,

        detailLayout: imageSource.detailLayout || "price-sales-rank",
        purchaseLayout: imageSource.purchaseLayout || "buy",
      });

      return;
    }

    const product = productMap.get(productId);

    product.skuList.push({
      skuId,
      skuCode: row.sku_code,
      color: row.color,
      size: row.size,
      skuName: row.sku_name,
      price: Number(row.price || 0),
      availableStock: Number(row.available_stock || 0),
      lockedStock: Number(row.locked_stock || 0),
      skuIsDeleted: Number(row.sku_is_deleted || 0),
      inventoryUpdatedAt: row.inventory_updated_at || "",
      skuStatus: normalizeStatus(row.sku_status || "ON_SALE"),
    });

    product.price = Math.min(product.price, Number(row.price || 0));
    product.sales += parseSalesValue(row.total_sold_count);
    product.availableStock += Number(row.available_stock || 0);
    product.lockedStock += Number(row.locked_stock || 0);
  });

  return Array.from(productMap.values())
    .map((product) => {
      const state = getProductDisplayState(product);

      product.skuSummary = `共 ${product.skuList.length} 个规格，库存 ${product.availableStock} 件，默认 SKU：${product.skuList[0]?.skuName || "无"}`;
      product.skuId = product.defaultSkuId;
      product.unavailableAt = getProductUnavailableAt(product);
      product.saleState = state.key;
      product.saleStateLabel = state.label;
      product.saleStateMessage = state.message;

      return product;
    })
    .sort(compareProductsForCustomer);
}

async function loadProductsFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/products`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error("后端返回的数据格式不正确");
    }

    products = convertApiProducts(result.data);
    hasLoadedProductsFromApi = true;
    salesRankMap = getSalesRankMap(products);
    productsById = new Map(products.map((product) => [product.id, product]));
    syncStorefrontCategoryOptions();
    const refreshedActiveProduct = activePurchaseProduct
      ? productsById.get(activePurchaseProduct.id)
      : null;
    if (refreshedActiveProduct) {
      activePurchaseProduct = refreshedActiveProduct;
    }

    updateView();
    renderSidebar();
    if (purchaseModal?.classList.contains('is-open')) {
      renderPurchaseModal();
    }

    console.log("已使用后端数据库商品渲染页面：", {
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("加载后端商品失败，继续使用静态商品：", error);

    // 失败时保留原来的静态商品，页面不会空白
    products = staticProducts;
    hasLoadedProductsFromApi = false;
    salesRankMap = getSalesRankMap(products);
    productsById = new Map(products.map((product) => [product.id, product]));
    syncStorefrontCategoryOptions();
    updateView();
    renderSidebar();
  }
}

function syncStorefrontCategoryOptions() {
  if (!hasLoadedProductsFromApi) {
    categoryOptions = createStaticCategories(staticCollections, staticProducts);
  } else if (hasLoadedCategoriesFromApi) {
    categoryOptions = apiCategoryOptions;
  } else {
    categoryOptions = deriveApiCategoriesFromProducts(products);
  }
  activeCategoryKey = resolveActiveCategoryKey(activeCategoryKey, categoryOptions);
}

async function loadCategoriesFromApi() {
  try {
    const response = await fetch(`${API_BASE_URL}/categories`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) throw new Error('后端返回的分类数据格式不正确');
    apiCategoryOptions = normalizeApiCategories(result.data);
    hasLoadedCategoriesFromApi = true;
  } catch (error) {
    console.warn('加载分类接口失败，使用当前商品派生分类：', error);
    apiCategoryOptions = [];
    hasLoadedCategoriesFromApi = false;
  }
  syncStorefrontCategoryOptions();
  updateView();
}

const selectedSkuByProductId = new Map();

function getProductSkuList(product) {
  return Array.isArray(product?.skuList) ? product.skuList : [];
}

function getExplicitSelectedSku(product) {
  const selectedSkuId = selectedSkuByProductId.get(product?.id);
  const selectedSku = getSellableProductSkus(product)
    .find((sku) => Number(sku.skuId) === Number(selectedSkuId)) || null;

  if (!selectedSku && product?.id) {
    selectedSkuByProductId.delete(product.id);
  }

  return selectedSku;
}


function getSkuAvailableStock(sku) {
  return Math.max(0, Number(sku?.availableStock || 0));
}

function isSkuInStock(sku) {
  return getSkuAvailableStock(sku) > 0;
}

function getStockLabel(stock) {
  if (stock <= 0) {
    return "已售罄";
  }

  if (stock <= 5) {
    return `库存紧张，仅剩 ${stock} 件`;
  }

  return `库存 ${stock} 件`;
}

function findOverStockCartItems(cartItems) {
  return cartItems.filter((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const availableStock = Math.max(0, Number(item.availableStock || 0));

    return availableStock <= 0 || quantity > availableStock;
  });
}

function getCartItemInvalidReason(item) {
  const productIsDeleted = Number(item?.productIsDeleted ?? item?.product_is_deleted ?? 0);
  const productStatus = normalizeStatus(item?.productStatus || item?.product_status || item?.status || "");
  const skuIsDeleted = Number(item?.skuIsDeleted ?? item?.sku_is_deleted ?? 0);
  const skuStatus = normalizeStatus(item?.skuStatus || item?.sku_status || item?.skuStatusLabel || "");
  const availableStock = Math.max(0, Number(item?.availableStock ?? item?.available_stock ?? 0));
  const quantity = Math.max(1, Number(item?.quantity || 1));

  if (productIsDeleted === 1) {
    return "商品已删除，不能结算";
  }

  if (productStatus && productStatus !== "ON_SALE") {
    return "商品已下架，不能结算";
  }

  if (skuIsDeleted === 1) {
    return "当前规格已删除，不能结算";
  }

  if (skuStatus && skuStatus !== "ON_SALE") {
    return "当前规格已下架，不能结算";
  }

  if (availableStock <= 0) {
    return "当前规格已售罄，不能结算";
  }

  if (quantity > availableStock) {
    return `库存不足，仅剩 ${availableStock} 件，不能结算`;
  }

  return "";
}

function isCartItemCheckoutable(item) {
  return !getCartItemInvalidReason(item);
}

function getInvalidCartItems(cartItems) {
  return (Array.isArray(cartItems) ? cartItems : []).filter((item) => !isCartItemCheckoutable(item));
}

function setSelectedSku(productId, skuId) {
  const product = productsById.get(productId);
  const selectedSku = getSellableProductSkus(product)
    .find((sku) => Number(sku.skuId) === Number(skuId)) || null;

  if (selectedSku) {
    selectedSkuByProductId.set(productId, Number(selectedSku.skuId));
  } else {
    selectedSkuByProductId.delete(productId);
  }
  updateView();
}

function getPurchaseSelectedSku(product) {
  const skuList = getProductSkuList(product);
  return skuList.find((sku) => Number(sku.skuId) === Number(activePurchaseSkuId)) || null;
}

function getAvailableProductSkuList(product) {
  return getSellableProductSkus(product);
}

function canOpenProductActionModal(product) {
  const productState = getProductDisplayState(product);
  return productState.key === "AVAILABLE" && getAvailableProductSkuList(product).length > 0;
}

function renderProductSkuOptions(product) {
  const skuList = getProductSkuList(product);
  const renderableSkuList = skuList.length
    ? skuList
    : product?.skuId
      ? [{
          skuId: product.skuId,
          skuName: '默认规格',
          price: product.price,
          availableStock: product.availableStock || 0,
          skuStatus: product.skuStatus || product.status || 'ON_SALE',
        }]
      : [];
  const selectedSku = getExplicitSelectedSku(product);
  const productOnSale = isOnSale(product.productStatus || product.status);
  const selectionHint = !selectedSku
    ? '<p class="product-card__sku-hint">请选择规格后再加入购物车或购买。</p>'
    : '';

  return `
    <div class="product-card__sku-options" aria-label="选择商品规格">
      ${renderableSkuList
        .map((sku) => {
          const skuDisabled =
            !productOnSale ||
            !isOnSale(sku.skuStatus || sku.status) ||
            Number(sku.availableStock || 0) <= 0;

          return `
            <button
              class="product-card__sku-button ${Number(sku.skuId) === Number(selectedSku?.skuId) ? 'is-active' : ''} ${skuDisabled ? 'is-disabled' : ''}"
              type="button"
              data-product-sku-id="${sku.skuId}"
              ${skuDisabled ? 'disabled' : ''}
            >
              ${escapeHtml(sku.skuName || '默认规格')}${skuDisabled ? '（无货）' : ''}
            </button>
          `;
        })
        .join('')}
      ${selectionHint}
    </div>
  `;
}

async function loadAddressesFromApi(userId = CURRENT_USER_ID) {
  const response = await fetch(`${API_BASE_URL}/addresses/user/${userId}`);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "查询用户地址失败");
  }

  dbAddressList = Array.isArray(result.data) ? result.data : [];

  const defaultAddress =
    dbAddressList.find((address) => Number(address.is_default) === 1) ||
    dbAddressList[0];

  if (defaultAddress) {
    if (!dbAddressList.some((address) => Number(address.id) === Number(activePurchaseAddressId))) {
      activePurchaseAddressId = Number(defaultAddress.id);
    }

    if (!dbAddressList.some((address) => Number(address.id) === Number(cartCheckoutState.selectedAddressId))) {
      cartCheckoutState.selectedAddressId = Number(defaultAddress.id);
    }
  }

  console.log("已加载数据库地址：", dbAddressList);

  return dbAddressList;
}


async function addAddressToApi(values) {
  const detail = [
    values.province,
    values.city,
    values.detail,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ');

  const response = await fetch(`${API_BASE_URL}/addresses/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      recipient_name: String(values.recipientName || '').trim(),
      phone: String(values.phone || '').trim(),
      detail,
      is_default: Boolean(values.isDefault),
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "新增收货地址失败");
  }

  dbAddressList = Array.isArray(result.data) ? result.data : [];

  console.log("新增数据库地址成功：", result);

  return result;
}

async function setDefaultAddressToApi(addressId) {
  const response = await fetch(`${API_BASE_URL}/addresses/set-default`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: Number(addressId),
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "设置默认地址失败");
  }

  dbAddressList = Array.isArray(result.data) ? result.data : [];

  console.log("设置默认地址成功：", result);

  return result;
}

async function deleteAddressFromApi(addressId) {
  const address = getDbAddressById(addressId);

  const confirmed = window.confirm(
    `确定要删除这个收货地址吗？\n\n${address ? `${address.recipient_name} ${address.phone}\n${formatDbAddress(address)}` : ''}`
  );

  if (!confirmed) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/addresses/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: Number(addressId),
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "删除收货地址失败");
  }

  dbAddressList = Array.isArray(result.data) ? result.data : [];

  const defaultAddress = getDefaultDbAddress();

  if (defaultAddress) {
    activePurchaseAddressId = Number(defaultAddress.id);
    cartCheckoutState.selectedAddressId = Number(defaultAddress.id);
  } else {
    activePurchaseAddressId = CURRENT_ADDRESS_ID;
    cartCheckoutState.selectedAddressId = CURRENT_ADDRESS_ID;
  }

  console.log("删除收货地址成功：", result);

  return result;
}

function formatDbAddress(address) {
  if (!address) {
    return "暂无地址";
  }

  return address.detail || "暂无详细地址";
}

function getDbAddressById(addressId) {
  return dbAddressList.find((address) => Number(address.id) === Number(addressId)) || null;
}

function getDefaultDbAddress() {
  return (
    dbAddressList.find((address) => Number(address.is_default) === 1) ||
    dbAddressList[0] ||
    null
  );
}

function getActivePurchaseAddressId() {
  const selectedAddress = getDbAddressById(activePurchaseAddressId) || getDefaultDbAddress();
  return selectedAddress ? Number(selectedAddress.id) : CURRENT_ADDRESS_ID;
}

function getActiveCartAddressId() {
  const selectedAddress = getDbAddressById(cartCheckoutState.selectedAddressId) || getDefaultDbAddress();
  return selectedAddress ? Number(selectedAddress.id) : null;
}

function renderDbAddressButtons(activeAddressId, dataAttribute, disabled = false) {
  if (!dbAddressList.length) {
    return '<p class="purchase-empty">暂无数据库收货地址，请先在数据库 user_address 表中添加地址。</p>';
  }

  return dbAddressList
    .map((address) => {
      const isActive = Number(address.id) === Number(activeAddressId);

      return `
        <button
          type="button"
          class="db-address-option ${isActive ? 'is-active' : ''}"
          ${dataAttribute}="${address.id}"
          ${disabled ? 'disabled' : ''}
        >
          <strong>${escapeHtml(address.recipient_name || '未命名收货人')}</strong>
          <span>${escapeHtml(address.phone || '')}</span>
          <small>${escapeHtml(formatDbAddress(address))}</small>
          ${Number(address.is_default) === 1 ? '<em>默认地址</em>' : ''}
        </button>
      `;
    })
    .join('');
}

function convertApiCartRows(apiRows) {
  return apiRows.map((row) => {
    const matchedProduct =
      products.find((product) => product.productId === Number(row.product_id)) ||
      products.find((product) => product.skuId === Number(row.sku_id)) ||
      products[0];
    const productStatus = normalizeStatus(row.product_status || "ON_SALE");
    const productIsDeleted = Number(row.product_is_deleted || 0);
    const skuStatus = normalizeStatus(row.sku_status || "ON_SALE");
    const skuIsDeleted = Number(row.sku_is_deleted || 0);
    const availableStock = Number(row.available_stock || 0);
    const quantity = Number(row.quantity || 1);
    const invalidReason = getCartItemInvalidReason({
      productStatus,
      productIsDeleted,
      skuStatus,
      skuIsDeleted,
      availableStock,
      quantity,
    });

    return {
      id: `sku-${row.sku_id}`,
      productId: Number(row.product_id),
      skuId: Number(row.sku_id),

      cartItemId: Number(row.cart_item_id),

      name: `${row.product_name} / ${row.sku_name}`,
      category: matchedProduct?.category || "商品",
      badge: "数据库购物车",
      image: matchedProduct?.image || staticProducts[0]?.image || "",

      price: Number(row.price || 0),
      quantity,
      availableStock,
      lockedStock: Number(row.locked_stock || 0),
      productStatus,
      productIsDeleted,
      skuStatus,
      skuIsDeleted,
      productIsValid: productIsDeleted !== 1 && productStatus === "ON_SALE",
      skuIsValid: skuIsDeleted !== 1 && skuStatus === "ON_SALE",
      invalidReason,
      checkoutable: !invalidReason,
      cartStatus: String(row.cart_status || "").trim(),
      itemAmount: Number(row.item_amount || 0),
    };
  });
}


async function syncCartFromApi(userId = CURRENT_USER_ID) {
  const response = await fetch(`${API_BASE_URL}/cart/${userId}`);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const result = await response.json();

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error("后端购物车返回格式不正确");
  }

  const cartItems = convertApiCartRows(result.data);

  // 暂时仍然复用原前端购物车展示逻辑，但数据来源改成后端
  saveStoredCart(storage, cartItems);
  refreshCommerceIndicators();

  console.log("已同步后端购物车：", {
    count: cartItems.length,
    cartItems,
  });

  return cartItems;
}


async function addCartToApi(product, selectedSku = null, quantity = 1) {
  const actualSelectedSku = selectedSku || null;
  const skuId = actualSelectedSku?.skuId;

  if (!skuId) {
    throw new Error("请先选择商品规格，再加入购物车。");
  }

  const nextQuantity = Math.max(1, Number(quantity) || 1);
  const availableStock = getSkuAvailableStock(actualSelectedSku);

  if (!isOnSale(actualSelectedSku.skuStatus || actualSelectedSku.status || "ON_SALE")) {
    throw new Error("当前规格已下架。");
  }

  if (availableStock <= 0) {
    throw new Error("当前规格库存不足。");
  }

  if (nextQuantity > availableStock) {
    throw new Error(`当前规格最多只能购买 ${availableStock} 件。`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/cart/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        sku_id: skuId,
        quantity: nextQuantity,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.detail || "加入购物车失败");
    }

    await syncCartFromApi(CURRENT_USER_ID);

    setFeedback(
      sidebarCartFeedback,
      `已加入数据库购物车，规格：${actualSelectedSku?.skuName || '默认规格'}。`
    );
    console.log("加入购物车成功：", result);
    return result;
  } catch (error) {
    console.error("加入购物车失败：", error);

    setFeedback(
      sidebarCartFeedback,
      `加入购物车失败：${error.message}`,
      true
    );
    throw error;
  }
}

function normalizePayMethod(method) {
  const payMethodMap = {
    alipay: "ALIPAY",
    wechat: "WECHAT",
    cod: "COD",
  };

  return payMethodMap[method] || "ALIPAY";
}

async function payOrderFromApi(orderId, paymentMethod, payPassword) {
  const response = await fetch(`${API_BASE_URL}/orders/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      order_id: orderId,
      pay_method: normalizePayMethod(paymentMethod),
      pay_password: payPassword,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "支付订单失败");
  }

  console.log("订单支付成功：", result);
  return result;
}

function promptPayPassword() {
  const password = window.prompt(
    "订单已创建，状态为待支付。\n请输入 6 位支付密码完成支付。\n测试支付密码：123456\n\n点击取消或留空，则订单保留为待支付。"
  );

  if (password === null) {
    return null;
  }

  const trimmedPassword = password.trim();

  if (!trimmedPassword) {
    return null;
  }

  return trimmedPassword;
}

async function payOrderWithPasswordPrompt(orderId, paymentMethod, feedbackTarget) {
  const payPassword = promptPayPassword();

  if (!payPassword) {
    setFeedback(
      feedbackTarget,
      `订单 ${orderId} 已创建，当前状态为待支付。你可以在购买记录中继续支付或取消订单。`
    );
    return {
      paid: false,
      reason: "skip",
    };
  }

  if (!/^\d{6}$/.test(payPassword)) {
    setFeedback(
      feedbackTarget,
      `支付密码必须是 6 位数字。订单 ${orderId} 已保留为待支付。`,
      true
    );
    return {
      paid: false,
      reason: "invalid_password_format",
    };
  }

  const payResult = await payOrderFromApi(orderId, paymentMethod, payPassword);

  return {
    paid: true,
    payment: payResult,
  };
}

function promptPaymentMethod(defaultMethod = "alipay") {
  const input = window.prompt(
    "请选择支付方式：\n1 = 支付宝\n2 = 微信支付\n3 = 先用后付\n\n直接回车默认使用支付宝。",
    "1"
  );

  if (input === null) {
    return null;
  }

  const value = input.trim();

  if (value === "2") {
    return "wechat";
  }

  if (value === "3") {
    return "cod";
  }

  if (value === "1" || value === "") {
    return defaultMethod || "alipay";
  }

  return defaultMethod || "alipay";
}

async function createDirectOrderFromApi(product, quantity = 1, skuIdFromModal = null, buyerRemark = null) {
  const skuList = getProductSkuList(product);
  const selectedSku = skuList.find((sku) => Number(sku.skuId) === Number(skuIdFromModal)) || null;

  const skuId = selectedSku?.skuId;

  if (!skuId) {
    throw new Error("请先选择商品规格。");
  }

  const normalizedBuyerRemark = String(buyerRemark || '').trim();

  const response = await fetch(`${API_BASE_URL}/orders/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: getActivePurchaseAddressId(),
      sku_id: skuId,
      quantity: Math.max(1, Number(quantity) || 1),
      buyer_remark: normalizedBuyerRemark || null,
    }),
  });

  const orderResult = await response.json();

  if (!response.ok || !orderResult.success) {
    throw new Error(orderResult.detail || "直接下单失败");
  }

  console.log("直接下单成功，订单处于待支付状态：", orderResult);

  return orderResult;
}

async function createOrderFromCartFromApi() {
  const response = await fetch(`${API_BASE_URL}/orders/from-cart`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: getActiveCartAddressId(),
    }),
  });

  const orderResult = await response.json();

  if (!response.ok || !orderResult.success) {
    throw new Error(orderResult.detail || "从购物车创建订单失败");
  }

  console.log("从购物车创建订单成功，订单处于待支付状态：", orderResult);

  return orderResult;
}

async function createOrderFromSelectedCartFromApi(cartItemIds, buyerRemark = null) {
  const normalizedBuyerRemark = String(buyerRemark || '').trim();
  const response = await fetch(`${API_BASE_URL}/orders/from-cart-selected`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: getActiveCartAddressId(),
      cart_item_ids: cartItemIds,
      buyer_remark: normalizedBuyerRemark || null,
    }),
  });

  const orderResult = await response.json();

  if (!response.ok || !orderResult.success) {
    throw new Error(orderResult.detail || "从购物车选中商品创建订单失败");
  }

  console.log("从购物车选中商品创建订单成功，订单处于待支付状态：", orderResult);

  return orderResult;
}

function getSelectedCartItemIds(cart, selectedIds) {
  return cart
    .filter((item) => selectedIds.includes(item.id))
    .map((item) => Number(item.cartItemId))
    .filter((id) => Number.isInteger(id) && id > 0);
}

async function submitCartCheckout() {
  if (cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart') {
    return;
  }

  const selectedIdsSnapshot = [...cartCheckoutState.selectedCartItemIds];
  const buyerRemarkSnapshot = cartCheckoutState.buyerRemark;
  const addressIdSnapshot = getActiveCartAddressId();

  try {
    cartCheckoutState.isCreatingOrder = true;
    cartCheckoutState.errorMessage = '';
    cartCheckoutState.successMessage = '';
    renderSidebar();

    await syncCartFromApi(CURRENT_USER_ID);

    const cart = getStoredCart(storage);
    const validSelectedIds = getValidCartSelectionIds(cart, selectedIdsSnapshot);
    cartCheckoutState.selectedCartItemIds = validSelectedIds;
    saveStoredCartSelections(storage, validSelectedIds);

    const selectedCartItems = cart.filter((item) => validSelectedIds.includes(item.id));
    const invalidCartItems = getInvalidCartItems(selectedCartItems);
    const selectedCartItemIds = getSelectedCartItemIds(cart, validSelectedIds);

    if (invalidCartItems.length) {
      const itemNames = invalidCartItems
        .map((item) => `${item.name}（${getCartItemInvalidReason(item)}）`)
        .join('、');
      throw new Error(`以下商品暂不能结算：${itemNames}`);
    }

    if (!selectedCartItemIds.length) {
      throw new Error('请先勾选要下单的商品');
    }

    if (!addressIdSnapshot || !dbAddressList.some((address) => Number(address.id) === Number(addressIdSnapshot))) {
      throw new Error('请先添加或选择收货地址');
    }

    cartCheckoutState.selectedAddressId = Number(addressIdSnapshot);
    const orderResult = await createOrderFromSelectedCartFromApi(
      [...selectedCartItemIds],
      buyerRemarkSnapshot,
    );

    const orderSummary = orderResult.order_summary || {};
    const firstOrderItem = Array.isArray(orderResult.order_items) ? orderResult.order_items[0] : null;

    console.log("购物车选中商品提交订单成功：", orderResult);

    cartCheckoutState.createdOrderId = Number(orderResult.order_id);
    cartCheckoutState.createdOrderNo = orderResult.order_no || '未知订单号';
    cartCheckoutState.createdOrderAmount = Number(orderSummary.total_amount || 0);
    cartCheckoutState.createdOrderStatus = orderSummary.status || 'PENDING_PAYMENT';
    cartCheckoutState.createdOrderRemark = orderSummary.buyer_remark || null;
    cartCheckoutState.createdOrderAddress = firstOrderItem
      ? `${firstOrderItem.recipient_name || ''} ${firstOrderItem.phone || ''} ${firstOrderItem.address_detail || ''}`.trim()
      : formatDbAddress(getDbAddressById(addressIdSnapshot));
    cartCheckoutState.checkoutStep = 'payment';
    cartCheckoutState.selectedPayMethod = '';
    cartCheckoutState.payPassword = '';
    cartCheckoutState.buyerRemark = '';
    cartCheckoutState.selectedCartItemIds = [];
    cartCheckoutState.successMessage = '订单已创建，请选择支付方式';
    saveStoredCartSelections(storage, []);
    await syncCartFromApi(CURRENT_USER_ID);
    await refreshOrdersFromApi();
  } catch (error) {
    console.error("购物车创建订单失败：", error);
    cartCheckoutState.errorMessage = `下单失败：${error.message}`;
    cartCheckoutState.buyerRemark = buyerRemarkSnapshot;
    cartCheckoutState.selectedAddressId = addressIdSnapshot || cartCheckoutState.selectedAddressId;

    try {
      const cart = await syncCartFromApi(CURRENT_USER_ID);
      const validSelectedIds = getValidCartSelectionIds(cart, selectedIdsSnapshot);
      cartCheckoutState.selectedCartItemIds = validSelectedIds;
      saveStoredCartSelections(storage, validSelectedIds);
    } catch (syncError) {
      console.error('下单失败后同步购物车失败：', syncError);
    }
  } finally {
    cartCheckoutState.isCreatingOrder = false;
    renderSidebar();
  }
}

async function submitCreatedCartOrderPayment() {
  if (
    cartCheckoutState.checkoutStep !== 'payment'
    || cartCheckoutState.isPaying
    || !cartCheckoutState.createdOrderId
  ) {
    return;
  }

  if (!cartCheckoutState.selectedPayMethod) {
    cartCheckoutState.errorMessage = '请先选择支付方式';
    renderSidebar();
    return;
  }

  if (!/^\d{6}$/.test(cartCheckoutState.payPassword)) {
    cartCheckoutState.errorMessage = '支付密码必须是 6 位数字';
    renderSidebar();
    return;
  }

  try {
    cartCheckoutState.isPaying = true;
    cartCheckoutState.errorMessage = '';
    cartCheckoutState.successMessage = '';
    renderSidebar();

    await payOrderFromApi(
      cartCheckoutState.createdOrderId,
      cartCheckoutState.selectedPayMethod,
      cartCheckoutState.payPassword,
    );

    const paidOrderNo = cartCheckoutState.createdOrderNo;
    resetCartCheckoutState('cart');
    cartCheckoutState.successMessage = `订单 ${paidOrderNo} 支付成功`;
    saveStoredCartSelections(storage, []);

    await Promise.all([
      syncCartFromApi(CURRENT_USER_ID),
      loadProductsFromApi(),
      refreshOrdersFromApi(),
    ]);

    openSidebar('orders');
  } catch (error) {
    console.warn('购物车订单支付失败：', error);
    cartCheckoutState.errorMessage = `支付失败：${error.message}`;
    cartCheckoutState.payPassword = '';
  } finally {
    cartCheckoutState.isPaying = false;
    renderSidebar();
  }
}

function deferCreatedCartOrderPayment() {
  if (!cartCheckoutState.createdOrderId) {
    return;
  }

  resetCartCheckoutState('cart');
  cartCheckoutState.successMessage = '订单已创建，可在我的订单中继续支付';
  renderSidebar();
}

function formatOrderStatus(status) {
  const statusMap = {
    PENDING_PAYMENT: "待支付",
    PAID: "已支付",
    REFUND_REQUESTED: "退款待处理",
    CANCELLED: "已取消",
    REFUNDED: "已退款",
    SHIPPED: "已发货",
    COMPLETED: "已完成",
  };

  return statusMap[status] || status || "未知状态";
}

function renderAdminOrderStatusBadge(status) {
  const normalizedStatus = normalizeStatus(status);
  const badgeMap = {
    PENDING_PAYMENT: { className: 'admin-status-badge--pending', label: '待支付' },
    PAID: { className: 'admin-status-badge--paid', label: '已支付' },
    REFUND_REQUESTED: { className: 'admin-status-badge--refund-requested', label: '退款待处理' },
    SHIPPED: { className: 'admin-status-badge--shipped', label: '已发货' },
    REFUNDED: { className: 'admin-status-badge--refunded', label: '已退款' },
    CANCELLED: { className: 'admin-status-badge--cancelled', label: '已取消' },
    COMPLETED: { className: 'admin-status-badge--completed', label: '已完成' },
  };
  const badge = badgeMap[normalizedStatus] || { className: 'admin-status-badge--default', label: formatOrderStatus(normalizedStatus) };

  return `
    <span class="admin-status-badge ${badge.className}">
      ${escapeHtml(badge.label)}
    </span>
  `;
}

function getOrderStatusFilterLabel(status) {
  return orderStatusFilters.find((item) => item.value === status)?.label || '全部';
}

function getFilteredOrders(orders) {
  const orderList = Array.isArray(orders) ? orders : [];

  if (activeOrderStatusFilter === 'ALL') {
    return orderList;
  }

  return orderList.filter((order) => order.status === activeOrderStatusFilter);
}

function getOrderStatusCount(orders, status) {
  const orderList = Array.isArray(orders) ? orders : [];

  if (status === 'ALL') {
    return orderList.length;
  }

  return orderList.filter((order) => order.status === status).length;
}

function renderOrderStatusFilters(orders) {
  return `
    <div class="order-filter">
      ${orderStatusFilters
        .map(
          (filter) => `
            <button
              type="button"
              class="order-filter__button ${activeOrderStatusFilter === filter.value ? 'is-active' : ''}"
              data-order-status-filter="${filter.value}"
            >
              ${filter.label}
              <span>${getOrderStatusCount(orders, filter.value)}</span>
            </button>
          `,
        )
        .join('')}
    </div>
  `;
}

async function loadOrdersFromApi(userId = CURRENT_USER_ID) {
  const response = await fetch(`${API_BASE_URL}/orders/user/${userId}`);

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "查询订单列表失败");
  }

  console.log("已加载数据库订单列表：", result);

  return Array.isArray(result.data) ? result.data : [];
}

async function cancelOrderFromApi(orderId, remark = "用户在前端取消订单") {
  const response = await fetch(`${API_BASE_URL}/orders/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      order_id: orderId,
      remark,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "取消订单失败");
  }

  console.log("取消订单成功：", result);
  return result;
}

function canCancelOrder(status) {
  return status === "PENDING_PAYMENT";
}

function getOrderCancelHint(status) {
  if (status === "PENDING_PAYMENT") {
    return "";
  }

  if (status === "PAID" || status === "REFUNDED") {
    return "";
  }

  if (status === "CANCELLED") {
    return "订单已取消";
  }

  return "当前状态不可取消";
}

function canRefundOrder(status) {
  return status === "PAID" || status === "SHIPPED";
}

function getOrderRefundHint(status) {
  if (status === "REFUND_REQUESTED") {
    return "退款申请处理中";
  }

  if (status === "REFUNDED") {
    return "订单已退款";
  }

  if (status === "PENDING_PAYMENT") {
    return "待支付订单不能退款，可直接取消";
  }

  if (status === "CANCELLED") {
    return "订单已取消";
  }

  return "";
}

async function refundOrderFromApi(orderId, remark = "用户在前台购买记录申请退款") {
  const response = await fetch(`${API_BASE_URL}/orders/refund`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      order_id: Number(orderId),
      remark,
    }),
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "申请退款失败");
  }

  console.log("退款申请提交成功：", result);
  return result;
}

function setOrderActionFeedback(orderId, message, isError = false) {
  const target = ordersList?.querySelector(`[data-order-action-feedback="${orderId}"]`);

  if (!target) {
    return;
  }

  target.textContent = message;
  target.dataset.state = isError ? "error" : "success";
}

async function loadOrderDetailFromApi(orderId) {
  const response = await fetch(`${API_BASE_URL}/orders/${orderId}`);
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.detail || "查询订单详情失败");
  }

  console.log("已加载订单详情：", result);

  return result;
}

function renderOrderDetailValue(value, fallback = "暂无") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function renderApiOrderDetail(detail) {
  const summary = detail.order_summary || {};
  const items = Array.isArray(detail.order_items) ? detail.order_items : [];
  const payments = Array.isArray(detail.payment_records) ? detail.payment_records : [];
  const logs = Array.isArray(detail.status_logs) ? detail.status_logs : [];
  const inventoryLogs = Array.isArray(detail.inventory_logs) ? detail.inventory_logs : [];

  return `
    <div class="order-detail">
      <section class="order-detail__section">
        <h4>订单概要</h4>
        <p>订单ID：${renderOrderDetailValue(summary.order_id)}</p>
        <p>订单号：${renderOrderDetailValue(summary.order_no)}</p>
        <p>订单状态：${formatOrderStatus(summary.status)}</p>
        <p>订单金额：${formatPrice(summary.total_amount)}</p>
        <p>商品种类：${renderOrderDetailValue(summary.item_kind_count)} 类</p>
        <p>商品数量：${renderOrderDetailValue(summary.total_quantity)} 件</p>
        <p class="order-detail__buyer-remark">买家备注：${escapeHtml(summary.buyer_remark || "无")}</p>
        <p>创建时间：${renderOrderDetailValue(summary.created_at)}</p>
      </section>

      <section class="order-detail__section">
        <h4>商品明细</h4>
        ${
          items.length
            ? items
                .map(
                  (item) => `
                    <article class="order-detail__row">
                      <strong>${escapeHtml(item.product_name || "未知商品")}</strong>
                      <p>规格：${escapeHtml(item.sku_name || "默认规格")}</p>
                      <p>数量：${renderOrderDetailValue(item.quantity)} 件</p>
                      <p>单价：${formatPrice(item.price)}</p>
                      <p>小计：${formatPrice(item.item_amount)}</p>
                      <p>收货人：${escapeHtml(item.recipient_name || "暂无")}</p>
                      <p>手机号：${escapeHtml(item.phone || "暂无")}</p>
                      <p>地址：${escapeHtml(item.address_detail || "暂无")}</p>
                    </article>
                  `,
                )
                .join("")
            : '<p class="order-detail__empty">暂无商品明细</p>'
        }
      </section>

      <section class="order-detail__section">
        <h4>支付记录</h4>
        ${
          payments.length
            ? payments
                .map(
                  (payment) => `
                    <article class="order-detail__row">
                      <p>支付方式：${escapeHtml(payment.pay_method || "暂无")}</p>
                      <p>支付状态：${escapeHtml(payment.pay_status || "暂无")}</p>
                      <p>支付金额：${formatPrice(payment.pay_amount)}</p>
                      <p>支付时间：${renderOrderDetailValue(payment.created_at)}</p>
                    </article>
                  `,
                )
                .join("")
            : '<p class="order-detail__empty">暂无支付记录</p>'
        }
      </section>

      <section class="order-detail__section">
        <h4>状态日志</h4>
        ${
          logs.length
            ? logs
                .map(
                  (log) => `
                    <article class="order-detail__row">
                      <p>${escapeHtml(log.from_status || "NULL")} → ${escapeHtml(log.to_status || "未知状态")}</p>
                      <p>说明：${escapeHtml(log.remark || "暂无")}</p>
                      <p>时间：${renderOrderDetailValue(log.created_at)}</p>
                    </article>
                  `,
                )
                .join("")
            : '<p class="order-detail__empty">暂无状态日志</p>'
        }
      </section>

      <section class="order-detail__section">
        <h4>库存流水</h4>
        ${
          inventoryLogs.length
            ? inventoryLogs
                .map(
                  (log) => `
                    <article class="order-detail__row">
                      <p>SKU ID：${renderOrderDetailValue(log.sku_id)}</p>
                      <p>变化类型：${escapeHtml(log.change_type || "暂无")}</p>
                      <p>变化数量：${renderOrderDetailValue(log.change_qty)}</p>
                      <p>关联单号：${escapeHtml(log.ref_no || "暂无")}</p>
                      <p>时间：${renderOrderDetailValue(log.created_at)}</p>
                    </article>
                  `,
                )
                .join("")
            : '<p class="order-detail__empty">暂无库存流水</p>'
        }
      </section>
    </div>
  `;
}

async function showOrderDetail(orderId) {
  const container = ordersList?.querySelector(`[data-order-detail-container="${orderId}"]`);

  if (!container) {
    return;
  }

  try {
    container.innerHTML = '<p class="order-detail__loading">正在加载订单详情...</p>';

    const detail = await loadOrderDetailFromApi(orderId);
    container.innerHTML = renderApiOrderDetail(detail);
  } catch (error) {
    console.error("加载订单详情失败：", error);
    container.innerHTML = `<p class="order-detail__empty">加载订单详情失败：${escapeHtml(error.message)}</p>`;
  }
}

async function handlePayPendingOrder(orderId) {
  const paymentMethod = promptPaymentMethod("alipay");

  if (!paymentMethod) {
    return;
  }

  try {
    const payResult = await payOrderWithPasswordPrompt(
      orderId,
      paymentMethod,
      null
    );

    if (!payResult.paid) {
      await refreshOrdersFromApi();
      await showOrderDetail(orderId);
      return;
    }

    console.log("待支付订单继续支付成功：", payResult);

    await loadProductsFromApi();
    await refreshOrdersFromApi();
    await showOrderDetail(orderId);
  } catch (error) {
    console.error("继续支付失败：", error);
    window.alert(`继续支付失败：${error.message}`);
  }
}

async function handleCancelOrder(orderId) {
  if (cancellingOrderIds.has(orderId)) {
    return;
  }

  const confirmed = window.confirm("确定要取消这个订单吗？取消后会释放锁定库存。");

  if (!confirmed) {
    return;
  }

  try {
    cancellingOrderIds.add(orderId);
    setOrderActionFeedback(orderId, "正在取消订单，请稍候...");

    const result = await cancelOrderFromApi(orderId, "用户在前端订单列表取消订单");

    console.log("订单取消完整流程成功：", result);

    await refreshOrdersFromApi();

    // 刷新列表后，自动展开刚取消的订单详情，方便查看状态日志和库存流水
    await showOrderDetail(orderId);

    await loadProductsFromApi();
  } catch (error) {
    console.error("取消订单失败：", error);
    setOrderActionFeedback(orderId, `取消订单失败：${error.message}`, true);
  } finally {
    cancellingOrderIds.delete(orderId);
  }
}

async function handleRefundOrder(orderId) {
  if (refundingOrderIds.has(orderId)) {
    return;
  }

  const confirmed = window.confirm("确定要申请退款吗？退款成功后订单会变为已退款，库存和销量会同步回滚。");

  if (!confirmed) {
    return;
  }

  try {
    refundingOrderIds.add(orderId);
    setOrderActionFeedback(orderId, "正在申请退款，请稍候...");

    const result = await refundOrderFromApi(orderId, "用户在前台购买记录申请退款");

    console.log("前台订单退款申请成功：", result);

    activeOrderStatusFilter = "REFUND_REQUESTED";

    await refreshOrdersFromApi();
    await showOrderDetail(orderId);
    await loadProductsFromApi();
    setOrderActionFeedback(orderId, "退款申请已提交，等待商家处理");
  } catch (error) {
    console.error("申请退款失败：", error);
    setOrderActionFeedback(orderId, `申请退款失败：${error.message}`, true);
  } finally {
    refundingOrderIds.delete(orderId);
  }
}

function renderApiOrders(orders) {
  if (!ordersList) {
    return;
  }

  const allOrders = Array.isArray(orders) ? orders : [];
  const filteredOrders = getFilteredOrders(allOrders);
  const filterLabel = getOrderStatusFilterLabel(activeOrderStatusFilter);

  if (!allOrders.length) {
    ordersList.innerHTML = `
      ${renderOrderStatusFilters(allOrders)}
      <p class="orders-empty">暂无购买记录</p>
    `;
    return;
  }

  if (!filteredOrders.length) {
    ordersList.innerHTML = `
      ${renderOrderStatusFilters(allOrders)}
      <p class="orders-empty">当前筛选：${filterLabel}，暂无对应订单</p>
    `;
    return;
  }

  ordersList.innerHTML = `
    ${renderOrderStatusFilters(allOrders)}
    ${filteredOrders
      .map((order) => {
        const orderId = Number(order.order_id);
        const isCancelling = typeof cancellingOrderIds !== 'undefined' && cancellingOrderIds.has(orderId);
        const isRefunding = typeof refundingOrderIds !== 'undefined' && refundingOrderIds.has(orderId);
        const cancellable = typeof canCancelOrder === 'function'
          ? canCancelOrder(order.status)
          : order.status === 'PENDING_PAYMENT';
        const refundable = typeof canRefundOrder === 'function'
          ? canRefundOrder(order.status)
          : order.status === 'PAID';

        const cancelHint = typeof getOrderCancelHint === 'function'
          ? getOrderCancelHint(order.status)
          : '';
        const refundHint = typeof getOrderRefundHint === 'function'
          ? getOrderRefundHint(order.status)
          : '';

        return `
          <article class="order-card" data-order-id="${order.order_id}">
            <div class="order-card__header">
              <strong>${escapeHtml(order.order_no || "未知订单号")}</strong>
              <span>${formatOrderStatus(order.status)}</span>
            </div>
            <p>订单ID：${order.order_id}</p>
            <p>商品种类：${order.item_kind_count} 类，数量：${order.total_quantity} 件</p>
            <p>合计：${formatPrice(order.total_amount)}</p>
            <p>创建时间：${renderOrderDetailValue(order.created_at)}</p>

            <div class="order-card__actions">
              <button
                class="ghost-button ghost-button--small"
                type="button"
                data-order-detail-id="${order.order_id}"
              >
                查看详情
              </button>

              ${
                order.status === "PENDING_PAYMENT"
                  ? `
                    <button
                      class="ghost-button ghost-button--small ghost-button--solid"
                      type="button"
                      data-order-pay-id="${order.order_id}"
                    >
                      去支付
                    </button>
                  `
                  : refundable
                    ? `
                    <button
                      class="ghost-button ghost-button--small ghost-button--danger"
                      type="button"
                      data-order-refund-id="${order.order_id}"
                      ${isRefunding ? "disabled" : ""}
                    >
                      ${isRefunding ? "退款中..." : "申请退款"}
                    </button>
                  `
                    : refundHint
                      ? `<span class="order-card__hint">${escapeHtml(refundHint)}</span>`
                      : ""
              }

              ${
                cancellable
                  ? `
                    <button
                      class="ghost-button ghost-button--small ghost-button--danger"
                      type="button"
                      data-order-cancel-id="${order.order_id}"
                      ${isCancelling ? "disabled" : ""}
                    >
                      ${isCancelling ? "取消中..." : "取消订单"}
                    </button>
                  `
                  : cancelHint
                    ? `<span class="order-card__hint">${escapeHtml(cancelHint)}</span>`
                    : ""
              }
            </div>

            <p class="order-card__action-feedback" data-order-action-feedback="${order.order_id}"></p>
            <div data-order-detail-container="${order.order_id}"></div>
          </article>
        `;
      })
      .join("")}
  `;
}

async function refreshOrdersFromApi() {
  try {
    const orders = await loadOrdersFromApi(CURRENT_USER_ID);
    renderApiOrders(orders);
  } catch (error) {
    console.error("刷新订单列表失败：", error);

    if (ordersList) {
      ordersList.innerHTML = `<p class="orders-empty">加载订单失败：${error.message}</p>`;
    }
  }
}

function formatPrice(value) {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

function getFavoriteIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 20.4 4.9 13.7a4.9 4.9 0 0 1 0-7 4.9 4.9 0 0 1 7 0L12 7.8l.1-1.1a4.9 4.9 0 0 1 7 0 4.9 4.9 0 0 1 0 7L12 20.4Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
    </svg>
  `;
}

function getCartIcon() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 4.5h2.2l2.1 9.1h9.3l1.7-6.2H7.1" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
      <circle cx="10" cy="19.2" r="1.3" fill="currentColor" />
      <circle cx="17.2" cy="19.2" r="1.3" fill="currentColor" />
      <path d="M18.9 4.7v4.2m-2.1-2.1h4.2" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" />
    </svg>
  `;
}

function getProductImageStyle(product) {
  const styles = [];

  if (product.imageFit) {
    styles.push(`object-fit: ${product.imageFit};`);
  }

  if (product.imageFocus) {
    styles.push(`object-position: ${product.imageFocus};`);
  }

  if (product.imageZoom && product.imageZoom !== 1) {
    styles.push(`transform: scale(${product.imageZoom});`);
    styles.push('transform-origin: center center;');
  }

  return styles.join(' ');
}

function renderHero() {
  pageRoot.style.setProperty('--hero-image', `url("${heroBackgroundUrl}")`);

  if (hero) {
    hero.style.setProperty('--hero-image', `url("${heroBackgroundUrl}")`);
  }

  if (heroTitle) {
    heroTitle.textContent = copy.brandName;
  }

  if (heroSlogan) {
    heroSlogan.textContent = copy.slogan;
  }

}

function updateHeroScrollState() {
  if (!hero || !heroSection) {
    return;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const distanceToTop = Math.max(0, heroSection.offsetTop - window.scrollY);
  const progress = Math.min(1, distanceToTop / viewportHeight);
  const copyShift = progress * 132;
  const copyOpacity = 1 - progress;
  const copyScale = 1 - progress * 0.16;
  const topbarShift = progress * -28;
  const topbarOpacity = 1 - progress * 0.86;
  const topbarScale = 1 - progress * 0.08;

  hero.style.setProperty('--hero-copy-shift', `${copyShift}px`);
  hero.style.setProperty('--hero-copy-opacity', `${copyOpacity}`);
  hero.style.setProperty('--hero-copy-scale', `${copyScale}`);
  hero.style.setProperty('--hero-topbar-shift', `${topbarShift}px`);
  hero.style.setProperty('--hero-topbar-opacity', `${topbarOpacity}`);
  hero.style.setProperty('--hero-topbar-scale', `${topbarScale}`);
}

function scheduleHeroScrollState() {
  if (scrollFrame) {
    return;
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateHeroScrollState();
  });
}

function setInitialScrollPosition() {
  if (!heroSection) {
    return;
  }

  window.scrollTo({
    top: heroSection.offsetTop,
    behavior: 'auto',
  });
}

function renderCollections() {
  if (!collectionRail || !activeCollectionLabel) {
    return;
  }

  const visibleCategories = categoryOptions.filter((item) => Number(item.isDeleted) === 0 && item.productCount > 0);
  activeCategoryKey = resolveActiveCategoryKey(activeCategoryKey, visibleCategories);
  const allOption = { key: ALL_CATEGORY_KEY, name: '全部', productCount: products.length };
  const buttons = [allOption, ...visibleCategories].map((item) => {
    const isActive = item.key === activeCategoryKey;
    const ariaLabel = item.key === ALL_CATEGORY_KEY
      ? `全部，共 ${item.productCount} 件商品`
      : `${item.name}，共 ${item.productCount} 件商品`;

    return `
      <button class="collection-chip ${isActive ? 'is-active' : ''}" type="button" data-collection="${escapeHtml(item.key)}" aria-label="${escapeHtml(ariaLabel)}" aria-pressed="${isActive}">
        <span class="collection-chip__title">${escapeHtml(item.name)}</span>
      </button>
    `;
  });

  collectionRail.innerHTML = buttons.join('');
  activeCollectionLabel.textContent = activeCategoryKey === ALL_CATEGORY_KEY
    ? '全部'
    : visibleCategories.find((item) => item.key === activeCategoryKey)?.name || '全部';
}

function getProductSearchText(product) {
  const skuText = Array.isArray(product.skuList)
    ? product.skuList
        .map((sku) => `${sku.skuName || ''} ${sku.price || ''}`)
        .join(' ')
    : '';

  return [
    product.name,
    product.category,
    product.badge,
    product.detail,
    skuText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function filteredProducts() {
  return filterProductsByCategory(
    products,
    activeCategoryKey,
    activeProductSearchKeyword,
    getProductSearchText,
  ).sort(compareProductsForCustomer);
}

function renderProducts() {
  if (!productGrid) {
    return;
  }

  const visibleProducts = filteredProducts();
  const favorites = getStoredFavorites(storage, products);
  const cart = getStoredCart(storage);
  
  if (!visibleProducts.length) {
      productGrid.innerHTML = `
        <div class="product-empty">
          <strong>没有找到匹配商品</strong>
          <p>可以尝试更换关键词，或者切换到“全部”分类。</p>
        </div>
      `;
      return;
    }
  productGrid.innerHTML = visibleProducts
    .map((product) => {
      const isPrimaryDetail = product.detailLayout === 'price-sales-rank';
      const isSplitDetail = product.detailLayout === 'split';
      const isPurchaseUi = product.purchaseLayout === 'buy';
      const salesRank = salesRankMap.get(product.id);
      const isTopSeller = salesRank === 1;
      const salesRankLabel = isTopSeller
        ? '网站销量第一'
        : formatSalesRank(salesRank);
      const selectedSku = getExplicitSelectedSku(product);
      const displayPrice = Number(selectedSku?.price ?? product.price ?? 0);
      const selectedSkuName = selectedSku?.skuName || '请选择规格';
      const selectedStock = selectedSku ? Number(selectedSku?.availableStock ?? product.availableStock ?? 0) : null;
      const productState = getProductDisplayState(product);
      const productStateClass = `product-card--${productState.domValue}`;
      const isProductAvailable = productState.key === "AVAILABLE";
      const hasSelectedSku = Boolean(selectedSku);
      const canOpenActionModal = canOpenProductActionModal(product);
      const isFavorite = isProductFavorited(favorites, product);
      const isInCart = isProductInCart(cart, product);
      const cartAriaLabel = isProductAvailable
        ? isInCart ? '已在购物车，继续添加' : '加入购物车'
        : productState.key === 'SOLD_OUT'
          ? '已售罄，暂不可加入购物车'
          : '商品已下架，暂不可加入购物车';
      const buyAriaLabel = isProductAvailable
        ? '立即购买'
        : productState.key === 'SOLD_OUT'
          ? '已售罄，暂不可购买'
          : '商品已下架，暂不可购买';
      const stockLabel = !hasSelectedSku
        ? "请选择规格后查看库存"
        : productState.key === "OFF_SALE"
          ? "已下架"
          : getStockLabel(selectedStock);
      const detailMarkup = product.detail
        ? `<p class="product-card__detail">${escapeHtml(product.detail)}</p>`
        : "";

      return `
        <article class="product-card ${productStateClass} ${isPrimaryDetail ? 'product-card--primary-detail' : ''} ${isSplitDetail ? 'product-card--split-detail' : ''} ${isPurchaseUi ? 'product-card--purchase-ui' : ''}" data-category="${product.category}" data-product-id="${product.id}" data-product-state="${productState.domValue}">
          <div class="product-card__glow"></div>
          <div class="product-card__badge">${product.badge}</div>
          <div class="product-card__art">
            <img class="product-card__image" src="${product.image}" alt="${product.name} 预览图" style="${getProductImageStyle(product)}" loading="lazy" decoding="async" />
            <span class="product-card__art-overlay" aria-hidden="true"></span>
            ${renderProductStateStamp(productState, 'card')}
          </div>
          <div class="product-card__body ${isPrimaryDetail ? 'product-card__body--primary-detail' : ''} ${isSplitDetail ? 'product-card__body--split-detail' : ''}">
            <p class="product-card__category">${product.category}</p>
            ${
              isPrimaryDetail
                ? `
            <div class="product-card__primary-detail">
              <div class="product-card__primary-topline">
                <h3>${product.name}</h3>
                <strong class="product-card__price">${formatPrice(displayPrice)}</strong>
              </div>
              <div class="product-card__primary-subline">
                <span class="product-card__sales-chip">销量 ${product.sales}</span>
                <span class="product-card__sales-rank ${isTopSeller ? 'product-card__sales-rank--pill' : ''}">${salesRankLabel}</span>
              </div>
            </div>
            ${detailMarkup}
                `
                : isSplitDetail
                  ? `
            <h3>${product.name}</h3>
            <div class="product-card__detail-grid">
              <div class="product-card__meta product-card__meta--stacked">
                <div class="product-card__info-line">
                  <span class="product-card__info-label">售价：</span>
                  <strong class="product-card__info-value">${formatPrice(displayPrice)}</strong>
                </div>
                <div class="product-card__info-line">
                  <span class="product-card__info-label">销量：</span>
                  <strong class="product-card__info-value product-card__info-value--muted">${product.sales}</strong>
                </div>
                <div class="product-card__info-line">
                  <span class="product-card__info-label">${salesRankLabel}</span>
                </div>
              </div>
              ${detailMarkup}
            </div>
                  `
                  : `
            <h3>${product.name}</h3>
            ${detailMarkup}
                  `
            }
            ${renderProductSkuOptions(product)}
            <p class="product-card__sku-current ${hasSelectedSku && Number(selectedStock || 0) <= 0 ? 'is-sold-out' : ''}">
              当前规格：${escapeHtml(selectedSkuName)}，${escapeHtml(stockLabel)}
            </p>
            <div class="product-card__footer">
              <div class="product-card__actions ${isPurchaseUi ? 'product-card__actions--purchase' : ''}">
                ${
                  isPurchaseUi
                    ? `
                <button
                  type="button"
                  class="ghost-button ghost-button--icon ghost-button--icon-outline ${isFavorite ? 'is-favorited' : ''}"
                  aria-label="${isFavorite ? '取消收藏' : '加入收藏'}"
                  aria-pressed="${isFavorite}"
                  data-favorite-state="${isFavorite ? 'active' : 'inactive'}"
                  data-favorite-toggle
                >
                  <span class="ghost-button__icon">${getFavoriteIcon()}</span>
                </button>
                <button
                  type="button"
                  class="ghost-button ghost-button--icon ghost-button--icon-outline ${isInCart ? 'is-in-cart' : ''}"
                  aria-label="${cartAriaLabel}"
                  data-cart-state="${isInCart ? 'active' : 'inactive'}"
                  data-sidebar-launch="cart"
                  ${canOpenActionModal ? '' : 'disabled'}
                >
                  <span class="ghost-button__icon">${getCartIcon()}</span>
                </button>
                <button
                  type="button"
                  class="ghost-button ghost-button--solid ghost-button--buy"
                  data-purchase-launch="buy"
                  aria-label="${buyAriaLabel}"
                  ${canOpenActionModal ? '' : 'disabled'}
                >
                  ${canOpenActionModal ? '立即购买' : productState.label}
                </button>
                    `
                    : `
                <button type="button" class="ghost-button">加入收藏</button>
                <button type="button" class="ghost-button ghost-button--solid">查看详情</button>
                    `
                }
              </div>
            </div>
          </div>
        </article>
      `;
    })
    .join('');
}

function updateView() {
  renderCollections();
  renderProducts();
}

function renderSidebarCountBadge(element, count, label) {
  if (!element) {
    return;
  }

  const badgeText = formatCountBadge(count);
  element.textContent = badgeText;
  element.hidden = !badgeText;
  element.closest('[data-sidebar-target]')?.setAttribute('aria-label', `${label}，共 ${count} 件商品`);
}

function renderSidebarCountBadges() {
  const favorites = getStoredFavorites(storage, products);
  const cart = getStoredCart(storage);

  renderSidebarCountBadge(sidebarFavoriteCount, getFavoriteCount(favorites, products), '收藏夹');
  renderSidebarCountBadge(sidebarCartCount, getCartQuantityCount(cart), '购物车');
}

function refreshCommerceIndicators() {
  renderProducts();
  renderSidebarCountBadges();
  renderCommerceSidebarContent();
}

function setFeedback(target, message, isError = false) {
  if (!target) {
    return;
  }

  target.textContent = message;
  target.dataset.state = isError ? 'error' : 'success';
}

function readFieldValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function openAuthModal() {
  if (!authModal) {
    return;
  }

  authModal.classList.add('is-open');
  authModal.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
  if (!authModal) {
    return;
  }

  authModal.classList.remove('is-open');
  authModal.setAttribute('aria-hidden', 'true');
}

function getDisplayName(email, fallback = '') {
  if (fallback) {
    return fallback;
  }

  return email.includes('@') ? email.split('@')[0] : email;
}

function getPrimaryAddress(addressBook) {
  if (!addressBook?.addresses?.length) {
    return null;
  }

  return (
    addressBook.addresses.find((address) => address.id === addressBook.defaultAddressId) ||
    addressBook.addresses.find((address) => address.isDefault) ||
    addressBook.addresses[0] ||
    null
  );
}

function getPurchaseAddress(addressBook, addressId) {
  if (!addressBook?.addresses?.length) {
    return null;
  }

  return addressBook.addresses.find((address) => address.id === addressId) || getPrimaryAddress(addressBook);
}

function renderSidebarAddressBook(addressBook) {
  if (!sidebarAddressList) {
    return;
  }

  if (!addressBook.addresses.length) {
    sidebarAddressList.innerHTML = '<p class="sidebar-empty">还没有收货地址，先添加一个吧。</p>';
    return;
  }

  sidebarAddressList.innerHTML = addressBook.addresses
    .map(
      (address) => `
        <article class="address-card ${address.id === addressBook.defaultAddressId ? 'is-active' : ''}" data-sidebar-address-item="${address.id}">
          <div class="address-card__header">
            <strong>${address.recipientName || '未命名地址'}</strong>
            ${address.id === addressBook.defaultAddressId ? '<span>默认</span>' : ''}
          </div>
          <p>${address.phone}</p>
          <p>${address.province} ${address.city}</p>
          <p>${address.detail}</p>
          <button type="button" class="ghost-button ghost-button--small" data-sidebar-address-default="${address.id}">设为默认</button>
        </article>
      `,
    )
    .join('');
}

function renderSidebarDbAddressList() {
  if (!sidebarAddressList) {
    return;
  }

  if (!dbAddressList.length) {
    sidebarAddressList.innerHTML = '<p class="sidebar-empty">暂无数据库收货地址，请新增一个地址。</p>';
    return;
  }

  sidebarAddressList.innerHTML = dbAddressList
    .map(
      (address) => {
        const isDefault = Number(address.is_default) === 1;

        return `
          <article class="address-card ${isDefault ? 'is-active' : ''}" data-sidebar-address-item="${address.id}">
            <div class="address-card__header">
              <strong>${escapeHtml(address.recipient_name || '未命名地址')}</strong>
              ${isDefault ? '<span>默认</span>' : ''}
            </div>
            <p>${escapeHtml(address.phone || '')}</p>
            <p>${escapeHtml(formatDbAddress(address))}</p>
            <div class="address-card__actions">
              ${
                isDefault
                  ? '<span class="address-card__hint">当前默认地址</span>'
                  : `
                    <button
                      type="button"
                      class="ghost-button ghost-button--small"
                      data-db-address-default="${address.id}"
                    >
                      设为默认
                    </button>
                  `
              }
              <button
                type="button"
                class="ghost-button ghost-button--small ghost-button--danger"
                data-db-address-delete="${address.id}"
              >
                删除
              </button>
            </div>
          </article>
        `;
      },
    )
    .join('');
}

function renderPurchaseModal() {
  if (!purchaseModal) {
    return;
  }

  const actionConfig = getPurchaseActionConfig(activePurchaseAction);
  const product = activePurchaseProduct;
  const structuredSkuProduct = isStructuredProduct(product);
  const structuredSkuSelection = {
    color: activePurchaseColor,
    size: activePurchaseSize,
    skuId: activePurchaseSkuId,
  };
  const selectedSku = getPurchaseSelectedSku(product);
  const productState = product
    ? getProductDisplayState(product)
    : { key: "UNSELECTED", label: "请选择商品", message: "", priority: 99 };
  const displayPrice = actionConfig.showSku
    ? Number(selectedSku?.price ?? product?.price ?? 0)
    : Number(product?.price ?? 0);
  const availableStock = getSkuAvailableStock(selectedSku);
  const quantity = Math.min(
    Math.max(1, Number(activePurchaseQuantity) || 1),
    availableStock > 0 ? availableStock : 1
  );
  const total = product ? displayPrice * quantity : 0;
  const selectedSkuOnSale = Boolean(selectedSku) && isOnSale(selectedSku.skuStatus || selectedSku.status || "ON_SALE");
  const canSubmitPurchase =
    actionConfig.showSubmit &&
    Boolean(product) &&
    productState.key === "AVAILABLE" &&
    Boolean(selectedSku) &&
    selectedSkuOnSale &&
    availableStock > 0 &&
    quantity <= availableStock;

  if (purchaseModal) {
    purchaseModal.dataset.action = actionConfig.key;
  }

  if (purchaseEyebrow) {
    purchaseEyebrow.textContent = actionConfig.eyebrow;
  }

  if (purchaseTitle) {
    purchaseTitle.textContent = product?.name || actionConfig.label;
  }

  if (purchaseCategory) {
    purchaseCategory.textContent = product?.category || '商品信息';
  }

  if (purchaseBadge) {
    purchaseBadge.textContent = product?.badge || '精选';
  }

  if (purchasePrice) {
    purchasePrice.textContent = actionConfig.showSku && !selectedSku
      ? '请选择规格'
      : formatPrice(displayPrice);
  }

  if (purchaseSales) {
    purchaseSales.textContent = actionConfig.key === 'details'
      ? `销量 ${product?.sales ?? 0}`
      : selectedSku
        ? `销量 ${product.sales}`
        : '请选择商品规格后继续';
  }

  if (purchaseStatus) {
    purchaseStatus.hidden = actionConfig.key !== 'details';
    purchaseStatus.textContent = `销售状态：${productState.label}`;
  }

  if (purchaseImageFrame) {
    purchaseImageFrame.dataset.productState = productState.domValue || 'available';
  }

  if (purchaseStateStamp) {
    const stateUnavailable = productState.key !== "AVAILABLE";
    purchaseStateStamp.hidden = !stateUnavailable;
    purchaseStateStamp.className = `product-state-stamp product-state-stamp--detail product-state-stamp--${productState.domValue}`;
    purchaseStateStamp.textContent = stateUnavailable ? productState.label : '';
    purchaseStateStamp.setAttribute('aria-label', stateUnavailable ? productState.stampAriaLabel : '');
  }

  if (purchaseSkuSummary) {
    const skuSummary = String(product?.skuSummary || '').trim();
    purchaseSkuSummary.hidden = actionConfig.key !== 'details' || !skuSummary;
    purchaseSkuSummary.textContent = skuSummary;
  }

  if (purchaseDescriptionSection) {
    purchaseDescriptionSection.hidden = !actionConfig.showDescription;
  }

  if (purchaseDescription) {
    purchaseDescription.textContent = product?.detail || '暂无商品介绍';
  }

  const productImages = getProductImages(product);
  const selectedImage = productImages.find((image) => image.image_url === activePurchaseImageUrl) || productImages[0] || null;
  activePurchaseImageUrl = selectedImage?.image_url || '';

  if (purchaseImage) {
    if (selectedImage) {
      purchaseImage.src = selectedImage.image_url;
      purchaseImage.alt = `${product?.name || '商品'} 预览`;
    } else {
      purchaseImage.removeAttribute('src');
      purchaseImage.alt = product?.name ? `${product.name} 预览` : '';
    }
  }

  if (purchaseGallery) {
    purchaseGallery.hidden = productImages.length < 2;
    purchaseGallery.innerHTML = productImages.length < 2
      ? ''
      : productImages.map((image) => `
          <button
            type="button"
            class="purchase-modal__gallery-button${image.image_url === activePurchaseImageUrl ? ' is-active' : ''}"
            data-purchase-gallery-image="${escapeHtml(image.image_url)}"
            aria-label="${image.image_url === activePurchaseImageUrl ? '打开当前商品图片大图预览' : '切换到商品图片'}"
          >
            <img class="purchase-modal__gallery-thumb" src="${escapeHtml(image.image_url)}" alt="" loading="lazy" decoding="async" />
          </button>
        `).join('');
  }

  if (purchaseQuantityValue) {
    purchaseQuantityValue.textContent = String(quantity);
  }
  if (purchaseQuantityDecrease) {
    purchaseQuantityDecrease.disabled = !actionConfig.showQuantity || quantity <= 1 || !selectedSku;
  }

  if (purchaseQuantityIncrease) {
    purchaseQuantityIncrease.disabled = !actionConfig.showQuantity || availableStock <= 0 || quantity >= availableStock || !selectedSku;
  }

  if (purchaseTotal) {
    purchaseTotal.textContent = formatPrice(total);
  }

  if (purchaseSkuOptions && actionConfig.showSku) {
    const skuList = getProductSkuList(product);

    if (structuredSkuProduct) {
      const colorOptions = getDimensionOptions(product, structuredSkuSelection, 'color');
      const sizeOptions = getDimensionOptions(product, structuredSkuSelection, 'size');
      purchaseSkuOptions.innerHTML = `
        <div class='purchase-sku-dimensions'>
          <div class='purchase-sku-dimension'>
            <strong>颜色</strong>
            <div class='purchase-sku-dimension__options'>
              ${colorOptions.map((option) => `
                <button
                  type='button'
                  class='purchase-dimension-option ${option.value === activePurchaseColor ? 'is-active' : ''} ${option.disabled ? 'is-disabled' : ''}'
                  data-purchase-color='${escapeHtml(option.value)}'
                  ${option.disabled ? 'disabled' : ''}
                >${escapeHtml(option.value)}</button>
              `).join('')}
            </div>
          </div>
          <div class='purchase-sku-dimension'>
            <strong>尺码</strong>
            <div class='purchase-sku-dimension__options'>
              ${sizeOptions.map((option) => `
                <button
                  type='button'
                  class='purchase-dimension-option ${option.value === activePurchaseSize ? 'is-active' : ''} ${option.disabled ? 'is-disabled' : ''}'
                  data-purchase-size='${escapeHtml(option.value)}'
                  ${option.disabled ? 'disabled' : ''}
                >${escapeHtml(option.value)}</button>
              `).join('')}
            </div>
          </div>
          <p class='purchase-sku-selection'>
            ${selectedSku
              ? `${escapeHtml(selectedSku.skuName || `${activePurchaseColor} / ${activePurchaseSize}`)} · ${formatPrice(selectedSku.price)} · 库存 ${getSkuAvailableStock(selectedSku)} 件`
              : '请选择完整规格'}
          </p>
        </div>
      `;
    } else if (!product || !skuList.length) {
      purchaseSkuOptions.innerHTML = '<p class="purchase-empty">暂无可选规格</p>';
    } else {
      purchaseSkuOptions.innerHTML = skuList
        .map((sku) => {
          const skuDisabled =
            productState.key !== "AVAILABLE" ||
            !isOnSale(sku.skuStatus || sku.status) ||
            Number(sku.availableStock || 0) <= 0;

          return `
            <button
              type="button"
              class="purchase-sku ${Number(sku.skuId) === Number(selectedSku?.skuId) ? 'is-active' : ''} ${skuDisabled ? 'is-disabled' : ''}"
              data-purchase-sku-id="${sku.skuId}"
              ${skuDisabled ? 'disabled' : ''}
            >
              <span>${escapeHtml(sku.skuName || '默认规格')}${skuDisabled ? '（无货）' : ''}</span>
              <small>${formatPrice(sku.price)} · 库存 ${Number(sku.availableStock || 0)} 件</small>
            </button>
          `;
        })
        .join('');
    }
  } else if (purchaseSkuOptions) {
    purchaseSkuOptions.innerHTML = '';
  }

  if (purchaseAddressSection) {
    purchaseAddressSection.hidden = !actionConfig.showAddress;
  }

  if (purchaseQuantitySection) {
    purchaseQuantitySection.hidden = !actionConfig.showQuantity;
  }

  if (purchaseSkuSection) {
    purchaseSkuSection.hidden = !actionConfig.showSku;
  }

  if (purchasePaymentOptions) {
    purchasePaymentOptions.hidden = !actionConfig.showPayment;
  }

  if (purchasePaymentTitle) {
    purchasePaymentTitle.hidden = !actionConfig.showPayment;
  }

  if (purchaseTotalSection) {
    purchaseTotalSection.hidden = !actionConfig.showTotal;
  }

  if (purchaseRemarkSection) {
    purchaseRemarkSection.hidden = actionConfig.key !== 'buy';
  }

  if (purchaseBuyerRemark) {
    if (purchaseBuyerRemark.value !== activePurchaseBuyerRemark) {
      purchaseBuyerRemark.value = activePurchaseBuyerRemark;
    }
    purchaseBuyerRemark.disabled = isPurchaseSubmitting;
  }

  if (purchaseBuyerRemarkCount) {
    purchaseBuyerRemarkCount.textContent = `${activePurchaseBuyerRemark.length} / 500`;
  }

  if (purchaseAddressList && actionConfig.showAddress) {
    purchaseAddressList.innerHTML = dbAddressList.length
      ? renderDbAddressButtons(
          activePurchaseAddressId,
          "data-purchase-address-id"
        )
      : '<p class="purchase-empty">暂无数据库收货地址，请先在数据库 user_address 表中添加地址。</p>';
  }

  if (purchasePaymentOptions && actionConfig.showPayment) {
    purchasePaymentOptions.innerHTML = purchasePaymentMethods
      .map(
        (method) => `
          <button
            type="button"
            class="purchase-payment ${method.value === activePurchasePaymentMethod ? 'is-active' : ''}"
            data-purchase-payment-method="${method.value}"
          >
            ${method.label}
          </button>
        `,
      )
      .join('');
  }

  if (purchaseSubmit) {
    purchaseSubmit.hidden = !actionConfig.showSubmit;
    purchaseSubmit.disabled = isPurchaseSubmitting || !canSubmitPurchase;
    purchaseSubmit.textContent = product
      ? canSubmitPurchase
        ? actionConfig.submitLabel(formatPrice(total))
        : productState.key !== "AVAILABLE"
          ? productState.label
          : !selectedSku
            ? '请选择商品规格'
            : "当前规格库存不足"
      : '请选择商品';
    const submitAriaLabel = productState.key === 'SOLD_OUT'
      ? '已售罄，暂不可购买'
      : productState.key === 'OFF_SALE'
        ? '商品已下架，暂不可购买'
        : actionConfig.label;
    purchaseSubmit.setAttribute('aria-label', submitAriaLabel);
  }

  if (purchaseFeedback) {
    purchaseFeedback.hidden = !actionConfig.showSubmit;
    purchaseFeedback.textContent = actionConfig.showAddress
      ? '请选择商品规格和地址后继续。'
      : '请选择商品规格后继续。';
    purchaseFeedback.dataset.state = 'success';
  }
}

async function openPurchaseModal(product, action = 'buy') {
  activePurchaseProduct = product;
  activePurchaseImageUrl = getProductMainImage(product);
  activePurchaseAction = getPurchaseActionConfig(action).key;
  activePurchaseBuyerRemark = '';
  isPurchaseSubmitting = false;
  const actionConfig = getPurchaseActionConfig(activePurchaseAction);

  if (actionConfig.key === 'details' && !actionConfig.showSku) {
    activePurchaseColor = null;
    activePurchaseSize = null;
    activePurchaseSkuId = null;
  } else {
    const cachedSkuId = selectedSkuByProductId.get(product?.id);
    const initialSelection = resolveInitialSkuSelection(product, cachedSkuId);
    activePurchaseColor = initialSelection.color;
    activePurchaseSize = initialSelection.size;
    activePurchaseSkuId = initialSelection.skuId;
    if (initialSelection.skuId) {
      selectedSkuByProductId.set(product.id, Number(initialSelection.skuId));
    } else {
      selectedSkuByProductId.delete(product.id);
    }
    updateView();
  }
  activePurchaseQuantity = 1;
  activePurchasePaymentMethod = 'alipay';

  if (actionConfig.showAddress) {
    try {
      await loadAddressesFromApi(CURRENT_USER_ID);
    } catch (error) {
      console.error("加载数据库地址失败：", error);
      setFeedback(purchaseFeedback, `加载数据库地址失败：${error.message}`, true);
    }

    const defaultAddress = getDefaultDbAddress();
    activePurchaseAddressId = defaultAddress ? Number(defaultAddress.id) : CURRENT_ADDRESS_ID;
  }

  try {
    renderPurchaseModal();
    purchaseModal?.classList.add('is-open');
    purchaseModal?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
  } catch (error) {
    console.error("打开商品弹窗失败：", error);
    setFeedback(purchaseFeedback, `打开商品弹窗失败：${error.message}`, true);
    window.alert(`打开商品弹窗失败：${error.message}`);
    throw error;
  }
}

function closePurchaseModal() {
  if (!purchaseModal) {
    return;
  }

  closeImageLightbox();
  purchaseModal.classList.remove('is-open');
  purchaseModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
  activePurchaseAction = 'buy';
  activePurchaseBuyerRemark = '';
  isPurchaseSubmitting = false;
}

function renderImageLightbox() {
  if (!imageLightbox) {
    return;
  }

  if (!lightboxState.isOpen || !lightboxState.images.length) {
    imageLightbox.hidden = true;
    imageLightbox.classList.remove('is-open');
    imageLightbox.setAttribute('aria-hidden', 'true');
    return;
  }

  lightboxState.index = wrapLightboxIndex(lightboxState.images.length, lightboxState.index);
  const currentImage = lightboxState.images[lightboxState.index];
  const singleImage = lightboxState.images.length <= 1;

  imageLightbox.hidden = false;
  imageLightbox.classList.add('is-open');
  imageLightbox.setAttribute('aria-hidden', 'false');
  imageLightbox.setAttribute('aria-label', lightboxState.context ? `${lightboxState.context} 图片预览` : '商品图片预览');

  if (imageLightboxImage) {
    imageLightboxImage.alt = lightboxState.context
      ? `${lightboxState.context}，第 ${lightboxState.index + 1} 张图片`
      : `商品图片，第 ${lightboxState.index + 1} 张`;
    imageLightboxImage.hidden = lightboxState.loading || lightboxState.error;
  }

  if (imageLightboxCounter) {
    imageLightboxCounter.textContent = `${lightboxState.index + 1} / ${lightboxState.images.length}`;
  }

  if (imageLightboxHint) {
    imageLightboxHint.textContent = singleImage ? 'Esc 退出预览' : '← → 切换图片 · Esc 退出预览';
  }

  if (imageLightboxStage) {
    imageLightboxStage.setAttribute('aria-busy', String(lightboxState.loading));
  }

  if (imageLightboxLoading) {
    imageLightboxLoading.hidden = !lightboxState.loading;
  }

  if (imageLightboxError) {
    imageLightboxError.hidden = !lightboxState.error;
  }

  [imageLightboxPrev, imageLightboxNext].forEach((button) => {
    if (button) {
      button.hidden = singleImage;
      button.disabled = singleImage;
    }
  });
}

function setLightboxBackgroundInert(isInert) {
  if (!imageLightbox) {
    return;
  }

  if (isInert) {
    lightboxBackgroundInertState.clear();
    Array.from(document.body.children).forEach((element) => {
      if (element === imageLightbox) {
        return;
      }

      lightboxBackgroundInertState.set(element, Boolean(element.inert));
      element.inert = true;
    });
    return;
  }

  lightboxBackgroundInertState.forEach((wasInert, element) => {
    if (element.isConnected) {
      element.inert = wasInert;
    }
  });
  lightboxBackgroundInertState.clear();
}

function getImageLightboxFocusableElements() {
  if (!imageLightbox) {
    return [];
  }

  return Array.from(imageLightbox.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.hidden && !element.closest('[hidden]'));
}

function trapImageLightboxFocus(event) {
  const focusableElements = getImageLightboxFocusableElements();

  if (!focusableElements.length) {
    event.preventDefault();
    imageLightbox?.focus({ preventScroll: true });
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && (document.activeElement === firstElement || !imageLightbox?.contains(document.activeElement))) {
    event.preventDefault();
    lastElement.focus({ preventScroll: true });
    return;
  }

  if (!event.shiftKey && (document.activeElement === lastElement || !imageLightbox?.contains(document.activeElement))) {
    event.preventDefault();
    firstElement.focus({ preventScroll: true });
  }
}

function restoreLightboxFocus(sourceElement) {
  const fallbackElement = purchaseModal?.classList.contains('is-open')
    ? purchaseModal.querySelector('[role="dialog"]') || purchaseModal
    : null;
  const target = sourceElement?.isConnected ? sourceElement : fallbackElement;

  if (!target || typeof target.focus !== 'function') {
    return;
  }

  if (target === fallbackElement && !target.hasAttribute('tabindex')) {
    target.setAttribute('tabindex', '-1');
  }

  target.focus({ preventScroll: true });
}

function preloadAdjacentLightboxImages() {
  if (!lightboxState.isOpen || lightboxState.images.length <= 1) {
    return;
  }

  const adjacentUrls = new Set([
    lightboxState.images[wrapLightboxIndex(lightboxState.images.length, lightboxState.index - 1)]?.image_url,
    lightboxState.images[wrapLightboxIndex(lightboxState.images.length, lightboxState.index + 1)]?.image_url,
  ]);

  adjacentUrls.forEach((url) => {
    if (!url) {
      return;
    }

    const preloader = new Image();
    preloader.src = url;
  });
}

function loadCurrentImageLightboxImage() {
  const currentImage = lightboxState.images[lightboxState.index];

  if (!lightboxState.isOpen || !currentImage) {
    return;
  }

  lightboxState.requestId += 1;
  const requestId = lightboxState.requestId;
  lightboxState.loading = true;
  lightboxState.error = false;
  imageLightboxImage?.removeAttribute('src');
  renderImageLightbox();

  const imageLoader = new Image();
  imageLoader.decoding = 'async';
  imageLoader.onload = () => {
    if (!lightboxState.isOpen || requestId !== lightboxState.requestId) {
      return;
    }

    if (imageLightboxImage) {
      imageLightboxImage.src = currentImage.image_url;
    }
    lightboxState.loading = false;
    lightboxState.error = false;
    renderImageLightbox();
    preloadAdjacentLightboxImages();
  };
  imageLoader.onerror = () => {
    if (!lightboxState.isOpen || requestId !== lightboxState.requestId) {
      return;
    }

    imageLightboxImage?.removeAttribute('src');
    lightboxState.loading = false;
    lightboxState.error = true;
    renderImageLightbox();
  };
  imageLoader.src = currentImage.image_url;
}

function openImageLightbox(sourceElement = document.activeElement) {
  lightboxState = createImageLightboxState({
    product: activePurchaseProduct,
    selectedUrl: activePurchaseImageUrl,
    sourceElement,
    apiBaseUrl: API_BASE_URL,
  });

  if (!lightboxState.isOpen) {
    setFeedback(purchaseFeedback, '暂无可预览图片', true);
    return;
  }

  lightboxScrollY = window.scrollY;
  setLightboxBackgroundInert(true);
  document.body.classList.add('has-lightbox');
  renderImageLightbox();
  loadCurrentImageLightboxImage();
  window.requestAnimationFrame(() => {
    const focusTarget = imageLightboxCloseButtons[0] || imageLightbox;
    focusTarget?.focus({ preventScroll: true });
  });
}

function closeImageLightbox() {
  if (!lightboxState.isOpen) {
    lightboxState = createImageLightboxState();
    renderImageLightbox();
    return;
  }

  const sourceElement = lightboxState.sourceElement;
  lightboxState.requestId += 1;
  lightboxState = createImageLightboxState();
  document.body.classList.remove('has-lightbox');
  setLightboxBackgroundInert(false);
  renderImageLightbox();
  window.scrollTo({ top: lightboxScrollY, left: window.scrollX, behavior: 'auto' });
  window.requestAnimationFrame(() => restoreLightboxFocus(sourceElement));
}

function showImageLightboxStep(step) {
  if (!lightboxState.isOpen || lightboxState.images.length <= 1) {
    return;
  }

  lightboxState.index = wrapLightboxIndex(lightboxState.images.length, lightboxState.index + step);
  loadCurrentImageLightboxImage();
}

function setPurchaseQuantity(nextQuantity) {
  const selectedSku = getPurchaseSelectedSku(activePurchaseProduct);
  const availableStock = getSkuAvailableStock(selectedSku);
  const maxQuantity = availableStock > 0 ? Math.min(99, availableStock) : 1;

  activePurchaseQuantity = Math.min(
    maxQuantity,
    Math.max(1, Number(nextQuantity) || 1)
  );

  if (Number(nextQuantity) > maxQuantity) {
    setFeedback(purchaseFeedback, `当前规格最多只能购买 ${availableStock} 件。`, true);
  }

  renderPurchaseModal();
}

function setPurchaseSku(skuId) {
  const selectedSku = getSellableProductSkus(activePurchaseProduct)
    .find((sku) => Number(sku.skuId) === Number(skuId)) || null;
  activePurchaseSkuId = selectedSku ? Number(selectedSku.skuId) : null;

  if (activePurchaseProduct && selectedSku) {
    selectedSkuByProductId.set(activePurchaseProduct.id, Number(selectedSku.skuId));
    activePurchaseQuantity = Math.min(
      Math.max(1, Number(activePurchaseQuantity) || 1),
      Math.max(1, getSkuAvailableStock(selectedSku)),
    );
  } else if (activePurchaseProduct) {
    selectedSkuByProductId.delete(activePurchaseProduct.id);
  }

  renderPurchaseModal();
  updateView();
}

function setPurchaseDimension(dimension, value) {
  const nextSelection = selectSkuDimension(
    activePurchaseProduct,
    {
      color: activePurchaseColor,
      size: activePurchaseSize,
      skuId: activePurchaseSkuId,
    },
    dimension,
    value,
  );
  activePurchaseColor = nextSelection.color;
  activePurchaseSize = nextSelection.size;
  activePurchaseSkuId = nextSelection.skuId;

  const selectedSku = getPurchaseSelectedSku(activePurchaseProduct);
  if (selectedSku && activePurchaseProduct) {
    selectedSkuByProductId.set(activePurchaseProduct.id, Number(selectedSku.skuId));
    activePurchaseQuantity = Math.min(
      Math.max(1, Number(activePurchaseQuantity) || 1),
      Math.max(1, getSkuAvailableStock(selectedSku)),
    );
  } else if (activePurchaseProduct) {
    selectedSkuByProductId.delete(activePurchaseProduct.id);
  }

  renderPurchaseModal();
  updateView();
}

function setPurchasePaymentMethod(method) {
  activePurchasePaymentMethod = method;
  renderPurchaseModal();
}

function setPurchaseAddress(addressId) {
  activePurchaseAddressId = Number(addressId);
  renderPurchaseModal();
}

async function submitPurchaseOrder() {
  if (!activePurchaseProduct || isPurchaseSubmitting) {
    return;
  }

  const actionConfig = getPurchaseActionConfig(activePurchaseAction);
  if (actionConfig.key === 'details') {
    return;
  }
  const selectedSku = getPurchaseSelectedSku(activePurchaseProduct);
  const quantity = Math.max(1, Number(activePurchaseQuantity) || 1);
  const total = Number(selectedSku?.price ?? activePurchaseProduct.price ?? 0) * quantity;
  const availableStock = getSkuAvailableStock(selectedSku);
  const productState = getProductDisplayState(activePurchaseProduct);
  const buyerRemark = activePurchaseBuyerRemark.trim();

  if (productState.key !== "AVAILABLE") {
    setFeedback(purchaseFeedback, `${actionConfig.label}失败：${productState.message}`, true);
    return;
  }

  if (!selectedSku) {
    setFeedback(purchaseFeedback, "请先选择商品规格。", true);
    return;
  }

  if (!isOnSale(selectedSku?.skuStatus || selectedSku?.status || "ON_SALE")) {
    setFeedback(purchaseFeedback, `${actionConfig.label}失败：当前规格已下架。`, true);
    return;
  }

  if (availableStock <= 0) {
    setFeedback(purchaseFeedback, `${actionConfig.label}失败：当前规格库存不足。`, true);
    return;
  }

  if (quantity > availableStock) {
    setFeedback(purchaseFeedback, `${actionConfig.label}失败：当前规格最多只能购买 ${availableStock} 件。`, true);
    return;
  }

  try {
    isPurchaseSubmitting = true;
    if (purchaseSubmit) {
      purchaseSubmit.disabled = true;
      purchaseSubmit.textContent = actionConfig.pendingLabel;
    }
    if (purchaseBuyerRemark) {
      purchaseBuyerRemark.disabled = true;
    }

    if (actionConfig.key === 'buy') {
      setFeedback(purchaseFeedback, "正在创建待支付订单，请稍候...");

      const orderResult = await createDirectOrderFromApi(
        activePurchaseProduct,
        quantity,
        selectedSku?.skuId,
        buyerRemark,
      );

      activePurchaseBuyerRemark = '';
      if (purchaseBuyerRemark) {
        purchaseBuyerRemark.value = '';
      }
      if (purchaseBuyerRemarkCount) {
        purchaseBuyerRemarkCount.textContent = '0 / 500';
      }

      const orderNo = orderResult.order_no || "未知订单号";

      setFeedback(
        purchaseFeedback,
        `订单已提交，订单号：${orderNo}，金额：${formatPrice(total)}，当前状态：待支付。`
      );

      const payResult = await payOrderWithPasswordPrompt(
        orderResult.order_id,
        activePurchasePaymentMethod,
        purchaseFeedback
      );

      if (payResult.paid) {
        setFeedback(
          purchaseFeedback,
          `支付成功！订单号：${orderNo}，金额：${formatPrice(total)}。`
        );

        await loadProductsFromApi();
      }

      setTimeout(() => {
        closePurchaseModal();
        openSidebar(actionConfig.openSidebar);
        refreshOrdersFromApi();
      }, 800);
    } else if (actionConfig.key === 'cart') {
      setFeedback(purchaseFeedback, "正在加入购物车，请稍候...");

      await addCartToApi(activePurchaseProduct, selectedSku, quantity);

      setFeedback(
        purchaseFeedback,
        `已加入数据库购物车，规格：${selectedSku?.skuName || '默认规格'}。`
      );

    }
  } catch (error) {
    console.error("提交订单或支付失败：", error);
    setFeedback(purchaseFeedback, `${actionConfig.label}失败：${error.message}`, true);
  } finally {
    isPurchaseSubmitting = false;
    if (purchaseBuyerRemark) {
      purchaseBuyerRemark.disabled = false;
    }
    if (purchaseSubmit) {
      purchaseSubmit.disabled = false;
      purchaseSubmit.textContent = selectedSku
        ? actionConfig.key === 'buy'
          ? actionConfig.submitLabel(formatPrice(total))
          : actionConfig.submitLabel()
        : '请选择商品规格';
    }
  }
}

function openSidebar(section = 'account') {
  activeSidebarSection = sidebarMeta[section] ? section : 'account';
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-sidebar');
  renderSidebar();

  const sidebarContent = getActiveSidebarScrollContainer();
  if (sidebarContent) {
    sidebarContent.scrollTo({
      top: 0,
      behavior: 'auto',
    });
  }

  if (activeSidebarSection === "orders") {
    refreshOrdersFromApi();
  }

  if (activeSidebarSection === "cart" || activeSidebarSection === "address") {
  loadAddressesFromApi(CURRENT_USER_ID)
    .then(() => {
      renderSidebar();
    })
    .catch((error) => {
      console.error("加载数据库地址失败：", error);
      setFeedback(sidebarCartFeedback || sidebarAddressFeedback, `加载数据库地址失败：${error.message}`, true);
    });
  }
}

function closeSidebar() {
  if (activeSidebarSection === 'cart' && !cartCheckoutState.isCreatingOrder) {
    const hadCreatedOrder = Boolean(cartCheckoutState.createdOrderId);
    resetCartCheckoutState('cart');
    if (hadCreatedOrder) {
      cartCheckoutState.successMessage = '订单已创建，可在我的订单中继续支付';
    }
  }
  sidebar.classList.remove('is-open');
  sidebar.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-sidebar');
}

function getActiveSidebarScrollContainer() {
  if (!sidebar || !sidebar.classList.contains('is-open')) {
    return null;
  }

  return sidebar.querySelector('.sidebar__content');
}

function getStoredProductById(productId) {
  return products.find((product) => product.id === productId) || null;
}

function toggleFavorite(product) {
  const favorites = getStoredFavorites(storage, products);
  const wasFavorite = isProductFavorited(favorites, product);
  const nextFavorites = toggleProductFavorite(favorites, product);

  saveStoredFavorites(storage, nextFavorites);
  setFeedback(sidebarFavoritesFeedback, wasFavorite ? '已取消收藏。' : '已加入收藏夹。');
  refreshCommerceIndicators();
}

function removeFavorite(favoriteId) {
  const favorites = getStoredFavorites(storage, products);
  const nextFavorites = favorites.filter((favorite) => favorite.id !== favoriteId);

  saveStoredFavorites(storage, nextFavorites);
  setFeedback(sidebarFavoritesFeedback, '已取消收藏。');
  refreshCommerceIndicators();
}

function upsertCartItem(product) {
  const cart = getStoredCart(storage);
  const nextCart = [...cart];
  const existingIndex = nextCart.findIndex((item) => item.id === product.id);

  if (existingIndex >= 0) {
    nextCart[existingIndex] = {
      ...nextCart[existingIndex],
      quantity: Number(nextCart[existingIndex].quantity || 1) + 1,
    };
  } else {
    nextCart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      badge: product.badge,
      category: product.category,
      image: product.image,
      quantity: 1,
    });
  }

  saveStoredCart(storage, nextCart);
  return nextCart;
}

function renderFavoritesShelf(listElement, items, emptyState, currentProducts = []) {
  const shelf = renderFavoriteProductItems(items, currentProducts, emptyState);
  const currentProductsById = new Map(currentProducts.map((product) => [product.id, product]));

  if (!listElement) {
    return;
  }

  if (shelf.emptyState) {
    listElement.innerHTML = `<p class="sidebar-empty">${shelf.emptyState}</p>`;
    return;
  }

  listElement.innerHTML = shelf.items
    .map(
      (item) => {
        const currentProduct = item.isAvailable
          ? currentProductsById.get(item.currentProductId)
          : null;
        const productState = currentProduct
          ? getProductDisplayState(currentProduct)
          : null;
        const detailsAttribute = item.isAvailable
          ? `data-favorite-details-product-id="${escapeHtml(item.currentProductId)}"`
          : '';
        const imageMarkup = item.image
          ? `<img class="favorite-card__image" data-favorite-image src="${escapeHtml(item.image)}" alt="" loading="lazy" decoding="async" />`
          : '';

        return `
        <article class="favorite-card" data-favorite-id="${escapeHtml(item.id)}"${productState ? ` data-product-state="${productState.domValue}"` : ''}>
          <button
            type="button"
            class="favorite-card__visual${item.image ? '' : ' is-image-missing'}"
            ${detailsAttribute}
            aria-label="查看 ${escapeHtml(item.name)} 的商品详情和更多图片"
            ${item.isAvailable ? '' : 'disabled'}
          >
            ${imageMarkup}
            <span class="favorite-card__image-fallback">图片暂不可用</span>
            ${productState ? renderProductStateStamp(productState, 'favorite') : ''}
            <span class="favorite-card__image-hint">点击查看更多图片</span>
          </button>
          <div class="favorite-card__content">
            <div class="favorite-card__header">
              <div>
                <p class="favorite-card__category">${escapeHtml(item.category)}</p>
                <h4>${escapeHtml(item.name)}</h4>
              </div>
              ${item.badge ? `<span class="favorite-card__badge">${escapeHtml(item.badge)}</span>` : ''}
            </div>
            <p class="favorite-card__description">${escapeHtml(item.detail)}</p>
            <strong class="favorite-card__price">${formatPrice(item.price)}</strong>
            <div class="favorite-card__actions">
              <button
                type="button"
                class="ghost-button ghost-button--small"
                ${detailsAttribute}
                ${item.isAvailable ? '' : 'disabled'}
              >${item.isAvailable ? '查看详情' : '商品已不可用'}</button>
              <button
                type="button"
                class="ghost-button ghost-button--small ghost-button--danger"
                data-favorite-remove-id="${escapeHtml(item.id)}"
                aria-label="移除收藏 ${escapeHtml(item.name)}"
              >移除收藏</button>
            </div>
          </div>
        </article>
      `;
      },
    )
    .join('');
}

function formatCartMoney(value) {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

function getCartPreviewImage(item) {
  const product = productsById.get(item.id);
  return item.image || product?.image || products[0]?.image || '';
}

function isCartItemSelected(selectedIds, itemId) {
  return Array.isArray(selectedIds) && selectedIds.includes(itemId);
}

function toggleCartSelection(itemId) {
  if (cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart') {
    return cartCheckoutState.selectedCartItemIds;
  }

  const selectedIds = getStoredCartSelections(storage);
  const cart = getStoredCart(storage);
  const item = cart.find((cartItem) => cartItem.id === itemId);

  if (item && !isCartItemCheckoutable(item)) {
    setFeedback(sidebarCartFeedback, `该商品暂不能结算：${getCartItemInvalidReason(item)}`, true);
    return selectedIds;
  }

  const nextSelectedIds = selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];

  saveStoredCartSelections(storage, nextSelectedIds);
  cartCheckoutState.selectedCartItemIds = nextSelectedIds;
  cartCheckoutState.errorMessage = '';
  return nextSelectedIds;
}

function toggleAllCheckoutableCartItems() {
  if (cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart') {
    return cartCheckoutState.selectedCartItemIds;
  }

  const cart = getStoredCart(storage);
  const checkoutableIds = cart
    .filter((item) => isCartItemCheckoutable(item))
    .map((item) => item.id);
  const selectedIds = getValidCartSelectionIds(cart, getStoredCartSelections(storage));
  const hasSelectedAll = checkoutableIds.length > 0
    && checkoutableIds.every((id) => selectedIds.includes(id));
  const nextSelectedIds = hasSelectedAll ? [] : checkoutableIds;

  cartCheckoutState.selectedCartItemIds = nextSelectedIds;
  cartCheckoutState.errorMessage = '';
  saveStoredCartSelections(storage, nextSelectedIds);
  return nextSelectedIds;
}

function updateCartQuantity(itemId, delta) {
  const cart = getStoredCart(storage);
  const nextCart = cart.map((item) => {
    if (item.id !== itemId) {
      return item;
    }

    const nextQuantity = Math.max(1, Number(item.quantity || 1) + delta);

    return {
      ...item,
      quantity: nextQuantity,
    };
  });

  saveStoredCart(storage, nextCart);
  return nextCart;
}

async function updateCartQuantityToApi(itemId, delta) {
  if (isCartQuantityUpdating || cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart') {
    return;
  }

  const cart = getStoredCart(storage);
  const item = cart.find((cartItem) => cartItem.id === itemId);

  if (!item) {
    setFeedback(sidebarCartFeedback, "修改数量失败：没有找到购物车商品。", true);
    return;
  }

  const cartItemId = Number(item.cartItemId);
  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    setFeedback(sidebarCartFeedback, "修改数量失败：缺少数据库购物车明细ID。", true);
    return;
  }

  const currentQuantity = Math.max(1, Number(item.quantity || 1));
  const nextQuantity = Math.max(1, currentQuantity + Number(delta || 0));
  const availableStock = Math.max(0, Number(item.availableStock || 0));

  if (Number(delta || 0) > 0 && availableStock > 0 && nextQuantity > availableStock) {
    setFeedback(sidebarCartFeedback, `库存不足，当前最多只能购买 ${availableStock} 件。`, true);
    return;
  }

  if (Number(delta || 0) > 0 && availableStock <= 0) {
    setFeedback(sidebarCartFeedback, "库存不足，不能继续增加数量。", true);
    return;
  }

  if (nextQuantity === currentQuantity) {
    return;
  }

  try {
    isCartQuantityUpdating = true;
    setFeedback(sidebarCartFeedback, "正在同步购物车数量...");

    const response = await fetch(`${API_BASE_URL}/cart/update-quantity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        cart_item_id: cartItemId,
        quantity: nextQuantity,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.detail || "修改购物车数量失败");
    }

    console.log("修改购物车数量成功：", result);

    await syncCartFromApi(CURRENT_USER_ID);
    renderSidebar();

    setFeedback(sidebarCartFeedback, "购物车数量已同步数据库。");
  } catch (error) {
    console.error("修改购物车数量失败：", error);
    setFeedback(sidebarCartFeedback, `修改购物车数量失败：${error.message}`, true);
  } finally {
    isCartQuantityUpdating = false;
  }
}

async function deleteCartItemFromApi(itemId) {
  if (cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart') {
    return;
  }

  const cart = getStoredCart(storage);
  const item = cart.find((cartItem) => cartItem.id === itemId);

  if (!item) {
    setFeedback(sidebarCartFeedback, "删除失败：没有找到购物车商品。", true);
    return;
  }

  const cartItemId = Number(item.cartItemId);
  if (!Number.isInteger(cartItemId) || cartItemId <= 0) {
    setFeedback(sidebarCartFeedback, "删除失败：缺少数据库购物车明细ID。", true);
    return;
  }

  const confirmed = window.confirm(`确定要从购物车删除「${item.name}」吗？`);

  if (!confirmed) {
    return;
  }

  try {
    setFeedback(sidebarCartFeedback, "正在删除购物车商品...");

    const response = await fetch(`${API_BASE_URL}/cart/delete-item`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: CURRENT_USER_ID,
        cart_item_id: cartItemId,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.detail || "删除购物车商品失败");
    }

    console.log("删除购物车商品成功：", result);

    const selectedIds = getStoredCartSelections(storage);
    saveStoredCartSelections(
      storage,
      selectedIds.filter((selectedId) => selectedId !== itemId)
    );
    cartCheckoutState.selectedCartItemIds = cartCheckoutState.selectedCartItemIds
      .filter((selectedId) => selectedId !== itemId);

    await syncCartFromApi(CURRENT_USER_ID);
    renderSidebar();

    setFeedback(sidebarCartFeedback, "已从购物车删除该商品。");
  } catch (error) {
    console.error("删除购物车商品失败：", error);
    setFeedback(sidebarCartFeedback, `删除购物车商品失败：${error.message}`, true);
  }
}

function renderCartShelf(listElement, items, emptyState, selectedIds) {
  const cartItems = Array.isArray(items) ? items : [];

  if (!listElement) {
    return;
  }

  if (!cartItems.length) {
    listElement.innerHTML = `<p class="sidebar-empty sidebar-empty--cart">${emptyState}</p>`;
    return;
  }

  listElement.innerHTML = cartItems
    .map((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const subtotal = getCartItemTotal(item);
      const isSelected = isCartItemSelected(selectedIds, item.id);
      const availableStock = Math.max(0, Number(item.availableStock || 0));
      const invalidReason = getCartItemInvalidReason(item);
      const isInvalid = Boolean(invalidReason);
      const canIncrease = !isInvalid && availableStock > 0 && quantity < availableStock;
      const controlsLocked = cartCheckoutState.isCreatingOrder || cartCheckoutState.checkoutStep !== 'cart';

      return `
        <article class="cart-item ${isSelected ? 'is-selected' : ''} ${isInvalid ? 'cart-item--invalid' : ''}" data-cart-item-id="${item.id}">
          <button
            class="cart-item__select"
            type="button"
            data-cart-select-id="${item.id}"
            aria-label="${isInvalid ? invalidReason : (isSelected ? '取消选择' : '选择商品')}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
            ${isInvalid || controlsLocked ? 'disabled' : ''}
          >
            <span class="cart-item__select-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <path d="M5 12.5 10 17 19 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"></path>
              </svg>
            </span>
          </button>
          <div class="cart-item__thumb-wrap">
            <img class="cart-item__thumb" src="${getCartPreviewImage(item)}" alt="${item.name} 预览图" loading="lazy" decoding="async" />
          </div>
          <div class="cart-item__content">
            <div class="cart-item__topline">
              <div class="cart-item__title-block">
                <h4 class="cart-item__title">${item.name}</h4>
                <p class="cart-item__meta">${item.category || '商品'}</p>
              </div>
              <div class="cart-item__right-actions">
                <span class="cart-item__status-badge ${isInvalid ? 'cart-item__status-badge--invalid' : 'cart-item__status-badge--valid'}">${isInvalid ? '无效商品' : '可结算'}</span>
                <strong class="cart-item__subtotal">${formatCartMoney(subtotal)}</strong>
                <button
                  class="cart-item__delete"
                  type="button"
                  data-cart-delete-id="${item.id}"
                  aria-label="删除购物车商品"
                  ${controlsLocked ? 'disabled' : ''}
                >
                  删除
                </button>
              </div>
            </div>
            <div class="cart-item__bottomline">
              <span class="cart-item__unit-price">
                ${formatCartMoney(item.price)} / 件 · ${escapeHtml(getStockLabel(availableStock))}
              </span>
              <div class="cart-item__quantity-zone">
                <span class="cart-item__quantity-label">x${quantity}</span>
                <div class="cart-item__stepper">
                  <button class="cart-item__stepper-button" type="button" data-cart-quantity-step="-1" data-cart-item-id="${item.id}" aria-label="减少数量" ${controlsLocked ? 'disabled' : ''}>-</button>
                  <span class="cart-item__quantity-value">${quantity}</span>
                  <button
                    class="cart-item__stepper-button"
                    type="button"
                    data-cart-quantity-step="1"
                    data-cart-item-id="${item.id}"
                    aria-label="增加数量"
                    ${canIncrease && !controlsLocked ? '' : 'disabled'}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
            ${isInvalid ? `<p class="cart-item__warning">${escapeHtml(invalidReason)}</p>` : ''}
          </div>
        </article>
      `;
    })
    .join('');
}

function renderCartSummary(cart, selectedIds) {
  if (!cartSummary) {
    return;
  }

  const cartItems = Array.isArray(cart) ? cart : [];
  const safeSelectedIds = Array.isArray(selectedIds) ? selectedIds : [];
  const invalidItems = getInvalidCartItems(cartItems);
  const selectedTotals = getCartTotals(cartItems, safeSelectedIds);
  const allTotals = getCartTotals(cartItems, null);
  const activeAddressId = getActiveCartAddressId();
  const activeAddress = getDbAddressById(activeAddressId) || getDefaultDbAddress();
  const hasSelectedItems = selectedTotals.totalQuantity > 0;
  const checkoutableItems = cartItems.filter((item) => isCartItemCheckoutable(item));
  const hasSelectedAll = checkoutableItems.length > 0
    && checkoutableItems.every((item) => safeSelectedIds.includes(item.id));
  const isPaymentStep = cartCheckoutState.checkoutStep === 'payment';
  const canCreateOrder = hasSelectedItems
    && Boolean(activeAddress)
    && !cartCheckoutState.isCreatingOrder;
  const feedbackHtml = `
    ${cartCheckoutState.errorMessage ? `<p class="cart-checkout-feedback is-error">${escapeHtml(cartCheckoutState.errorMessage)}</p>` : ''}
    ${cartCheckoutState.successMessage ? `<p class="cart-checkout-feedback is-success">${escapeHtml(cartCheckoutState.successMessage)}</p>` : ''}
  `;

  if (isPaymentStep) {
    cartSummary.innerHTML = `
      <div class="cart-summary__checkout-panel cart-payment-step">
        <div class="cart-payment-step__heading">
          <span>订单已创建</span>
          <h3>选择支付方式</h3>
        </div>
        <dl class="cart-payment-step__order">
          <div><dt>订单号</dt><dd>${escapeHtml(cartCheckoutState.createdOrderNo)}</dd></div>
          <div><dt>订单金额</dt><dd>${formatCartMoney(cartCheckoutState.createdOrderAmount)}</dd></div>
          <div><dt>订单状态</dt><dd>${escapeHtml(formatOrderStatus(cartCheckoutState.createdOrderStatus))}</dd></div>
          <div><dt>收货地址</dt><dd>${escapeHtml(cartCheckoutState.createdOrderAddress || '以订单记录为准')}</dd></div>
          <div><dt>买家备注</dt><dd>${escapeHtml(cartCheckoutState.createdOrderRemark || '无')}</dd></div>
        </dl>
        <div class="cart-summary__payment" aria-label="选择支付方式">
          <span>选择支付方式</span>
          <div class="cart-summary__payment-options">
            ${purchasePaymentMethods
              .map(
                (method) => `
                  <button
                    type="button"
                    class="cart-summary__payment-button ${method.value === cartCheckoutState.selectedPayMethod ? 'is-active' : ''}"
                    data-cart-payment-method="${method.value}"
                    ${cartCheckoutState.isPaying ? 'disabled' : ''}
                  >
                    ${method.label}
                  </button>
                `,
              )
              .join('')}
          </div>
        </div>
        ${cartCheckoutState.selectedPayMethod ? `
          <label class="cart-payment-step__password">
            <span>输入支付密码</span>
            <input
              type="password"
              inputmode="numeric"
              autocomplete="off"
              maxlength="6"
              value="${escapeHtml(cartCheckoutState.payPassword)}"
              data-cart-pay-password
              ${cartCheckoutState.isPaying ? 'disabled' : ''}
            />
            <small>请输入 6 位支付密码</small>
          </label>
        ` : ''}
        ${feedbackHtml}
        <div class="cart-payment-step__actions">
          <button
            class="cart-summary__checkout"
            type="button"
            data-cart-confirm-payment
            ${cartCheckoutState.selectedPayMethod && !cartCheckoutState.isPaying ? '' : 'disabled'}
          >${cartCheckoutState.isPaying ? '正在支付…' : '确认支付'}</button>
          <button
            class="cart-payment-step__later"
            type="button"
            data-cart-pay-later
            ${cartCheckoutState.isPaying ? 'disabled' : ''}
          >稍后支付</button>
        </div>
      </div>
    `;
    return;
  }

  cartSummary.innerHTML = `
    <div class="cart-summary__checkout-panel">
      <div class="cart-summary__meta">
        <span>购物车共 ${allTotals.totalQuantity} 件，已选 ${selectedTotals.distinctItems} 种 / ${selectedTotals.totalQuantity} 件</span>
        <strong>${formatCartMoney(selectedTotals.totalAmount)}</strong>
      </div>
      <button
        class="cart-summary__select-all"
        type="button"
        data-cart-select-all
        aria-pressed="${hasSelectedAll}"
        ${checkoutableItems.length && !cartCheckoutState.isCreatingOrder ? '' : 'disabled'}
      >${hasSelectedAll ? '取消全选' : '全选可结算商品'}</button>
      ${invalidItems.length ? `<p class="cart-summary__warning">购物车中有 ${invalidItems.length} 件无效商品，请先处理后再结算。</p>` : ''}

     <div class="cart-summary__address">
        <span>收货地址</span>
        <strong>${activeAddress ? escapeHtml(activeAddress.recipient_name || '未命名收货人') : '暂无地址'}</strong>
        <small>${activeAddress ? escapeHtml(formatDbAddress(activeAddress)) : '请先添加或选择收货地址'}</small>
        <div class="cart-summary__address-options">
          ${renderDbAddressButtons(activeAddressId, "data-cart-address-id", cartCheckoutState.isCreatingOrder)}
        </div>
        <button type="button" class="cart-summary__address-manage" data-cart-manage-address>管理收货地址</button>
      </div>

      <label class="cart-summary__remark">
        <span>买家备注（选填）</span>
        <textarea
          maxlength="500"
          rows="4"
          placeholder="可填写商品偏好、配送说明等，最多 500 字"
          data-cart-checkout-remark
          ${cartCheckoutState.isCreatingOrder ? 'disabled' : ''}
        >${escapeHtml(cartCheckoutState.buyerRemark)}</textarea>
        <small data-cart-checkout-remark-count>${cartCheckoutState.buyerRemark.length} / 500</small>
      </label>

      ${feedbackHtml}
      ${!hasSelectedItems ? '<p class="cart-summary__hint">请先勾选要下单的商品</p>' : ''}
      ${!activeAddress ? '<p class="cart-summary__hint">请先添加或选择收货地址</p>' : ''}

      <button
        class="cart-summary__checkout"
        type="button"
        data-cart-checkout
        ${canCreateOrder ? '' : 'disabled'}
      >
        ${cartCheckoutState.isCreatingOrder ? '正在下单…' : '下单'}
      </button>
    </div>
  `;
}

function getValidCartSelectionIds(cart, selectedIds) {
  const invalidItemIds = new Set(getInvalidCartItems(cart).map((item) => item.id));

  return selectedIds.filter((id) => !invalidItemIds.has(id) && cart.some((item) => item.id === id));
}

function renderCommerceSidebarContent() {
  const currentFavoriteProducts = hasLoadedProductsFromApi ? products : [];
  renderFavoritesShelf(
    favoritesList,
    getStoredFavorites(storage, currentFavoriteProducts),
    '暂无收藏夹',
    currentFavoriteProducts,
  );

  const cart = getStoredCart(storage);
  const selectedIds = getStoredCartSelections(storage);
  const validSelectedIds = getValidCartSelectionIds(cart, selectedIds);

  if (cartCheckoutState.checkoutStep === 'cart') {
    cartCheckoutState.selectedCartItemIds = validSelectedIds;
  }

  renderCartShelf(cartList, cart, '暂无购物车', validSelectedIds);
  renderCartSummary(cart, validSelectedIds);
}

function renderSidebar() {
  const profile = getStoredProfile(storage);
  const email = profile?.user?.email || '未登录';
  const displayName = profile?.user?.displayName || '未设置';
  const meta = sidebarMeta[activeSidebarSection] || sidebarMeta.account;

  if (sidebarTitle) {
    sidebarTitle.textContent = meta.title;
  }

  if (sidebarSubtitle) {
    sidebarSubtitle.textContent = meta.subtitle;
  }

  sidebarNavButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.sidebarTarget === activeSidebarSection);
  });

  renderSidebarCountBadges();

  

  sidebarPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.sidebarPanel === activeSidebarSection);
  });

  if (accountEmail) {
    accountEmail.textContent = email;
  }

  if (accountDisplayName) {
    accountDisplayName.textContent = displayName;
  }

  renderSidebarDbAddressList();

  if (ordersList) {
    ordersList.innerHTML = `<p class="orders-empty">正在加载数据库订单...</p>`;
  }

  const cart = getStoredCart(storage);
  const selectedIds = getStoredCartSelections(storage);
  const validSelectedIds = getValidCartSelectionIds(cart, selectedIds);

  if (validSelectedIds.length !== selectedIds.length) {
    saveStoredCartSelections(storage, validSelectedIds);
  }

  renderCommerceSidebarContent();
}

function updateHeroParallax() {
  const rect = hero.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const centerRatio = Math.min(1, Math.max(0, (viewportHeight - rect.top) / (viewportHeight + rect.height)));
  const shift = (centerRatio - 0.5) * 42;
  const opacity = 0.2 + centerRatio * 0.18;
  const scale = 1.06 + centerRatio * 0.07;
  const pageShift = Math.max(-28, Math.min(28, window.scrollY * 0.02));
  const pageScale = 1.03 + Math.min(0.06, window.scrollY * 0.00005);
  const pageOpacity = 0.14 + Math.min(0.08, centerRatio * 0.04);

  hero.style.setProperty('--hero-bg-shift', `${shift}px`);
  hero.style.setProperty('--hero-bg-offset', `${Math.round(centerRatio * 18)}%`);
  hero.style.setProperty('--hero-bg-opacity', `${opacity}`);
  hero.style.setProperty('--hero-bg-scale', `${scale}`);
  document.body.style.setProperty('--page-portrait-shift', `${pageShift}px`);
  document.body.style.setProperty('--page-portrait-scale', `${pageScale}`);
  document.body.style.setProperty('--page-portrait-opacity', `${pageOpacity}`);
}

function scheduleHeroParallax() {
  if (scrollFrame) {
    return;
  }

  scrollFrame = window.requestAnimationFrame(() => {
    scrollFrame = 0;
    updateHeroParallax();
    updateHeroScrollState();
  });
}

if (collectionRail) {
  collectionRail.addEventListener('click', (event) => {
    const button = event.target.closest('[data-collection]');

    if (!button) {
      return;
    }

    activeCategoryKey = button.dataset.collection;
    updateView();
  });
}

if (productSearchInput) {
  productSearchInput.addEventListener('input', (event) => {
    activeProductSearchKeyword = String(event.target.value || '');
    updateView();
  });
}

if (productSearchClear) {
  productSearchClear.addEventListener('click', () => {
    activeProductSearchKeyword = '';

    if (productSearchInput) {
      productSearchInput.value = '';
    }

    updateView();
  });
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case '\'':
        return '&#39;';
      default:
        return character;
    }
  });
}

function initScrollTools() {
  const scrollTools = document.querySelector("[data-scroll-tools]");

  if (!scrollTools) {
    return;
  }

  scrollTools.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scroll-to]");

    if (!button) {
      return;
    }

    const target = button.dataset.scrollTo;
    const sidebarPanel = getActiveSidebarScrollContainer();

    if (target === "top") {
      if (sidebarPanel) {
        sidebarPanel.scrollTo({
          top: 0,
          behavior: "smooth",
        });
        return;
      }

      const homeTop = !isAdminPage && heroSection
        ? heroSection.offsetTop
        : 0;

      window.scrollTo({
        top: homeTop,
        behavior: "smooth",
      });
      return;
    }

    if (target === "bottom") {
      if (sidebarPanel) {
        sidebarPanel.scrollTo({
          top: sidebarPanel.scrollHeight,
          behavior: "smooth",
        });
        return;
      }

      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "smooth",
      });
    }
  });
}

function initAdminPage() {
  const shell = document.querySelector('[data-admin-shell]');
  if (!shell) {
    return;
  }

  const storage = window.localStorage;
  const navButtons = shell.querySelectorAll('[data-admin-nav-target]');
  const panels = shell.querySelectorAll('[data-admin-panel]');
  const ordersBody = shell.querySelector('[data-admin-orders-body]');
  const statsSummary = shell.querySelector('[data-admin-stats-summary]');
  const statsRows = shell.querySelector('[data-admin-stats-rows]');
  const productList = shell.querySelector('[data-admin-products-list]');
  const productSummary = shell.querySelector('[data-admin-product-summary]');
  const orderFeedback = shell.querySelector('[data-admin-order-feedback]');
  const adminProductSearchInput = shell.querySelector('[data-admin-product-search]');
  const adminProductSearchClear = shell.querySelector('[data-admin-product-search-clear]');
  const productFilterBar = shell.querySelector('[data-admin-product-filter-bar]');
  const productForm = shell.querySelector('[data-admin-product-form]');
  const productFeedback = shell.querySelector('[data-admin-product-feedback]');
  const productManageFeedback = shell.querySelector('[data-admin-product-manage-feedback]');
  const imageSelect = shell.querySelector('[data-admin-image-select]');
  const productImageInput = shell.querySelector('input[type="file"][name="image"]');
  const productImagePreview = shell.querySelector('[data-admin-image-preview]');
  const productNameInput = shell.querySelector('[data-admin-product-form] [name="name"]');
  const productSubmitButton = shell.querySelector('[data-admin-product-form] button[type="submit"]');
  const productCategorySelect = shell.querySelector('[data-admin-product-form] [data-admin-product-category-select]');
  const productCategoryEmpty = shell.querySelector('[data-admin-product-category-empty]');
  const categoryForm = shell.querySelector('[data-admin-category-form]');
  const categoryNameInput = shell.querySelector('[data-admin-category-name]');
  const categorySortOrderInput = shell.querySelector('[data-admin-category-sort-order]');
  const categoryFeedback = shell.querySelector('[data-admin-category-feedback]');
  const categoryFilter = shell.querySelector('[data-admin-category-filter]');
  const categoryList = shell.querySelector('[data-admin-category-list]');
  const operationLogFilter = shell.querySelector('[data-admin-operation-log-filter]');
  const operationLogAction = shell.querySelector('[data-admin-operation-log-action]');
  const operationLogTarget = shell.querySelector('[data-admin-operation-log-target]');
  const operationLogResult = shell.querySelector('[data-admin-operation-log-result]');
  const operationLogOperator = shell.querySelector('[data-admin-operation-log-operator]');
  const operationLogDateFrom = shell.querySelector('[data-admin-operation-log-date-from]');
  const operationLogDateTo = shell.querySelector('[data-admin-operation-log-date-to]');
  const operationLogKeyword = shell.querySelector('[data-admin-operation-log-keyword]');
  const operationLogReset = shell.querySelector('[data-admin-operation-log-reset]');
  const operationLogFeedback = shell.querySelector('[data-admin-operation-log-feedback]');
  const operationLogList = shell.querySelector('[data-admin-operation-log-list]');
  const operationLogFirst = shell.querySelector('[data-admin-operation-log-first]');
  const operationLogPrev = shell.querySelector('[data-admin-operation-log-prev]');
  const operationLogNext = shell.querySelector('[data-admin-operation-log-next]');
  const operationLogLast = shell.querySelector('[data-admin-operation-log-last]');
  const operationLogPageInfo = shell.querySelector('[data-admin-operation-log-page-info]');
  const operationLogTotal = shell.querySelector('[data-admin-operation-log-total]');
  const adminSkuColorsInput = shell.querySelector('[data-admin-sku-colors]');
  const adminSkuSizesInput = shell.querySelector('[data-admin-sku-sizes]');
  const adminSkuBasePriceInput = shell.querySelector('[data-admin-sku-base-price]');
  const adminSkuMatrix = shell.querySelector('[data-admin-sku-matrix]');
  const adminImageManager = document.querySelector('[data-admin-image-manager]');
  const adminImageManagerTitle = document.querySelector('[data-admin-image-manager-title]');
  const adminImageManagerSummary = document.querySelector('[data-admin-image-manager-summary]');
  const adminImageManagerFeedback = document.querySelector('[data-admin-image-manager-feedback]');
  const adminImageManagerList = document.querySelector('[data-admin-image-manager-list]');
  const adminImageManagerInput = document.querySelector('[data-admin-image-manager-input]');
  const adminImageManagerPending = document.querySelector('[data-admin-image-manager-pending]');
  const adminImageManagerClear = document.querySelector('[data-admin-image-manager-clear]');
  const adminImageManagerUpload = document.querySelector('[data-admin-image-manager-upload]');
  const adminImageManagerCloseButtons = document.querySelectorAll('[data-admin-image-manager-close]');
  const adminDescriptionEditor = document.querySelector('[data-admin-description-editor]');
  const adminDescriptionEditorTitle = document.querySelector('[data-admin-description-editor-title]');
  const adminDescriptionEditorSummary = document.querySelector('[data-admin-description-editor-summary]');
  const adminDescriptionEditorInput = document.querySelector('[data-admin-description-editor-input]');
  const adminDescriptionEditorCount = document.querySelector('[data-admin-description-editor-count]');
  const adminDescriptionEditorFeedback = document.querySelector('[data-admin-description-editor-feedback]');
  const adminDescriptionEditorSave = document.querySelector('[data-admin-description-editor-save]');
  const adminDescriptionEditorCloseButtons = document.querySelectorAll('[data-admin-description-editor-close]');
  const adminSkuManager = document.querySelector('[data-admin-sku-manager]');
  const adminSkuManagerTitle = document.querySelector('[data-admin-sku-manager-title]');
  const adminSkuManagerSummary = document.querySelector('[data-admin-sku-manager-summary]');
  const adminSkuManagerFeedback = document.querySelector('[data-admin-sku-manager-feedback]');
  const adminSkuManagerList = document.querySelector('[data-admin-sku-manager-list]');
  const adminSkuManagerCloseButtons = document.querySelectorAll('[data-admin-sku-manager-close]');
  const adminSkuAddColors = document.querySelector('[data-admin-sku-add-colors]');
  const adminSkuAddSizes = document.querySelector('[data-admin-sku-add-sizes]');
  const adminSkuAddPrice = document.querySelector('[data-admin-sku-add-price]');
  const adminSkuAddGenerate = document.querySelector('[data-admin-sku-add-generate]');
  const adminSkuAddDrafts = document.querySelector('[data-admin-sku-add-drafts]');
  const adminSkuAddSubmit = document.querySelector('[data-admin-sku-add-submit]');
  const dashboardTargets = {
    ordersBody,
    statsSummary,
    statsRows,
    productList,
    productSummary,
    categoryList,
    operationLogList,
  };
  let activePanel = 'orders';
  let activeAdminOrderDetailId = null;
  let products = [];
  let orders = [];
  let summary = null;
  let activeAdminImageManagerProduct = null;
  let adminImageManagerPendingFiles = [];
  let adminImageManagerUploading = false;
  let activeAdminDescriptionProduct = null;
  let adminDescriptionInitialValue = "";
  let adminDescriptionSubmitting = false;
  let adminSkuRows = [];
  let activeAdminSkuManagerProduct = null;
  let adminSkuManagerRows = [];
  let adminSkuManagerDraftRows = [];
  let skuManagerSubmitting = false;
  let productRows = [];
  let renderedStats = null;
  let renderedProducts = null;
  let adminCategories = [];
  let activeAdminCategoryFilter = 'ALL';
  const pendingAdminCategoryIds = new Set();
  const adminProductFilters = [
    { value: 'ALL', label: '全部' },
    { value: 'ON_SALE', label: '在售' },
    { value: 'SOLD_OUT', label: '售罄' },
    { value: 'OFF_SALE', label: '已下架' },
  ];
  let activeAdminProductFilter = 'ALL';
  let activeAdminProductSearchKeyword = "";
  const adminOperationLogState = {
    page: 1,
    pageSize: 20,
    pages: 0,
    total: 0,
    loading: false,
    optionsLoaded: false,
  };

  function renderAdminSkuMatrix() {
    if (!adminSkuMatrix) {
      return;
    }

    if (!adminSkuRows.length) {
      adminSkuMatrix.innerHTML = `
        <span>SKU 组合</span>
        <p class="admin-sku-matrix__empty">填写颜色和尺码后自动生成组合。</p>
      `;
      return;
    }

    adminSkuMatrix.innerHTML = `
      <div class="admin-sku-matrix__header">
        <span>SKU 组合（${escapeHtml(adminSkuRows.length)} 行）</span>
        <small>编码、名称、价格、库存和在售状态均可逐行修改。</small>
      </div>
      <div class="admin-sku-matrix__table-wrap">
        <table class="admin-sku-matrix__table">
          <thead>
            <tr><th>颜色</th><th>尺码</th><th>SKU 编码</th><th>SKU 名称</th><th>售价</th><th>库存</th><th>在售</th></tr>
          </thead>
          <tbody>
            ${adminSkuRows.map((row, index) => `
              <tr data-admin-sku-row-index="${index}">
                <td>${escapeHtml(row.color)}</td>
                <td>${escapeHtml(row.size)}</td>
                <td><input type="text" value="${escapeHtml(row.sku_code)}" data-admin-sku-code /></td>
                <td><input type="text" value="${escapeHtml(row.sku_name)}" data-admin-sku-name /></td>
                <td><input type="number" min="0.01" step="0.01" value="${escapeHtml(row.price)}" data-admin-sku-price /></td>
                <td><input type="number" min="0" step="1" value="${escapeHtml(row.stock)}" data-admin-sku-stock /></td>
                <td>
                  <select data-admin-sku-on-sale>
                    <option value="1" ${Number(row.on_sale) === 1 ? 'selected' : ''}>在售</option>
                    <option value="0" ${Number(row.on_sale) === 0 ? 'selected' : ''}>下架</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function rebuildAdminSkuMatrix() {
    const colors = normalizeDimensionValues(adminSkuColorsInput?.value || '');
    const sizes = normalizeDimensionValues(adminSkuSizesInput?.value || '');
    const defaultPrice = Number(adminSkuBasePriceInput?.value || 0);

    adminSkuRows = buildSkuMatrix(colors, sizes, adminSkuRows, {
      productName: productNameInput?.value || '',
      price: Number.isFinite(defaultPrice) && defaultPrice > 0 ? defaultPrice : 0,
      stock: 50,
      onSale: 1,
    });
    renderAdminSkuMatrix();
  }

  function updateAdminSkuMatrixValue(event) {
    const rowElement = event.target.closest('[data-admin-sku-row-index]');
    const rowIndex = Number(rowElement?.dataset.adminSkuRowIndex);
    const row = Number.isInteger(rowIndex) ? adminSkuRows[rowIndex] : null;

    if (!row) {
      return;
    }

    if (event.target.matches('[data-admin-sku-code]')) row.sku_code = event.target.value;
    if (event.target.matches('[data-admin-sku-name]')) row.sku_name = event.target.value;
    if (event.target.matches('[data-admin-sku-price]')) row.price = Number(event.target.value);
    if (event.target.matches('[data-admin-sku-stock]')) row.stock = Number(event.target.value);
    if (event.target.matches('[data-admin-sku-on-sale]')) row.on_sale = Number(event.target.value) === 0 ? 0 : 1;
  }

  function renderAdminSkuManager() {
    if (!adminSkuManager || !activeAdminSkuManagerProduct) return;

    adminSkuManager.hidden = false;
    adminSkuManager.classList.add('is-open');
    adminSkuManager.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-modal');
    if (adminSkuManagerTitle) adminSkuManagerTitle.textContent = `管理规格 · ${activeAdminSkuManagerProduct.name}`;
    if (adminSkuManagerSummary) adminSkuManagerSummary.textContent = `商品 ID：${activeAdminSkuManagerProduct.productId} · SKU 总数：${adminSkuManagerRows.length}`;
    if (adminSkuManagerList) {
      adminSkuManagerList.innerHTML = adminSkuManagerRows.map((sku) => {
        const deleted = Number(sku.skuIsDeleted) === 1;
        return `
          <article class="admin-sku-manager__row ${deleted ? 'is-deleted' : ''}" data-admin-sku-edit-row="${sku.skuId}">
            <div class="admin-sku-manager__row-heading">
              <strong>SKU ID：${escapeHtml(sku.skuId)}</strong>
              <span>${deleted ? '已逻辑删除' : (!sku.color || !sku.size ? '旧规格' : '结构化规格')}</span>
            </div>
            <div class="admin-sku-manager__grid">
              <label><span>颜色</span><input value="${escapeHtml(sku.color)}" data-admin-sku-edit-color ${deleted ? 'disabled' : ''} /></label>
              <label><span>尺码</span><input value="${escapeHtml(sku.size)}" data-admin-sku-edit-size ${deleted ? 'disabled' : ''} /></label>
              <label><span>SKU 编码</span><input value="${escapeHtml(sku.skuCode)}" data-admin-sku-edit-code ${deleted ? 'disabled' : ''} /></label>
              <label><span>SKU 名称</span><input value="${escapeHtml(sku.skuName)}" data-admin-sku-edit-name ${deleted ? 'disabled' : ''} /></label>
              <label><span>售价</span><input type="number" min="0.01" step="0.01" value="${escapeHtml(sku.price)}" data-admin-sku-edit-price ${deleted ? 'disabled' : ''} /></label>
              <label><span>库存</span><input type="number" min="0" step="1" value="${escapeHtml(sku.availableStock)}" data-admin-sku-edit-stock ${deleted ? 'disabled' : ''} /></label>
              <label><span>状态</span><select data-admin-sku-edit-on-sale ${deleted ? 'disabled' : ''}><option value="1" ${sku.onSale === 1 ? 'selected' : ''}>在售</option><option value="0" ${sku.onSale === 0 ? 'selected' : ''}>下架</option></select></label>
            </div>
            <div class="admin-sku-manager__actions">
              <button type="button" class="ghost-button ghost-button--small ghost-button--solid" data-admin-sku-save-id="${sku.skuId}" ${deleted ? 'disabled' : ''}>保存修改</button>
              <button type="button" class="ghost-button ghost-button--small ghost-button--danger" data-admin-sku-delete-id="${sku.skuId}" ${deleted ? 'disabled' : ''}>逻辑删除</button>
            </div>
          </article>
        `;
      }).join('');
    }
    renderAdminSkuDrafts();
  }

  function renderAdminSkuDrafts() {
    if (!adminSkuAddDrafts || !adminSkuAddSubmit) return;
    adminSkuAddSubmit.hidden = adminSkuManagerDraftRows.length === 0;
    adminSkuAddDrafts.innerHTML = adminSkuManagerDraftRows.map((row, index) => `
      <div class="admin-sku-manager__draft" data-admin-sku-draft-index="${index}">
        <strong>${escapeHtml(row.color)} / ${escapeHtml(row.size)}</strong>
        <input value="${escapeHtml(row.sku_code)}" data-admin-sku-draft-code aria-label="SKU 编码" />
        <input type="number" min="0.01" step="0.01" value="${escapeHtml(row.price)}" data-admin-sku-draft-price aria-label="售价" />
        <input type="number" min="0" step="1" value="${escapeHtml(row.stock)}" data-admin-sku-draft-stock aria-label="库存" />
        <select data-admin-sku-draft-on-sale aria-label="在售状态"><option value="1">在售</option><option value="0">下架</option></select>
      </div>
    `).join('');
  }

  function closeAdminSkuManager() {
    if (!adminSkuManager) return;
    adminSkuManager.hidden = true;
    adminSkuManager.classList.remove('is-open');
    adminSkuManager.setAttribute('aria-hidden', 'true');
    activeAdminSkuManagerProduct = null;
    adminSkuManagerRows = [];
    adminSkuManagerDraftRows = [];
    skuManagerSubmitting = false;
    document.body.classList.remove('has-modal');
  }

  async function openAdminSkuManager(product) {
    activeAdminSkuManagerProduct = product;
    adminSkuManagerRows = [];
    adminSkuManagerDraftRows = [];
    renderAdminSkuManager();
    setFeedback(adminSkuManagerFeedback, '正在加载全部 SKU...');
    try {
      adminSkuManagerRows = await loadAdminProductSkusToApi(product.productId);
      renderAdminSkuManager();
      setFeedback(adminSkuManagerFeedback, 'SKU 已全部加载。');
    } catch (error) {
      setFeedback(adminSkuManagerFeedback, error.message, true);
    }
  }

  function resetAdminDashboardState() {
    closeAdminProductImageManager();
    closeAdminDescriptionEditor();
    closeAdminSkuManager();
    products = [];
    orders = [];
    summary = null;
    productRows = [];
    renderedStats = null;
    renderedProducts = null;
    adminCategories = [];
    pendingAdminCategoryIds.clear();
    adminOperationLogState.page = 1;
    adminOperationLogState.pages = 0;
    adminOperationLogState.total = 0;
    adminOperationLogState.loading = false;
    adminOperationLogState.optionsLoaded = false;
    refreshAdminProductCategorySelect();
    clearAdminDashboardData(dashboardTargets);
  }

  function getAdminProductFilterLabel(filterValue) {
    return adminProductFilters.find((item) => item.value === filterValue)?.label || '全部';
  }

  function getAdminProductSearchText(row) {
    return [
      row?.product_name,
      row?.productName,
      row?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  function matchesAdminProductSearch(row) {
    const keyword = String(activeAdminProductSearchKeyword || "").trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return getAdminProductSearchText(row).includes(keyword);
  }

  function getAdminProductSaleState(row) {
    const status = normalizeStatus(row?.status || row?.productStatus || row?.product_status || row?.saleState || 'UNKNOWN');

    if (status === 'OFF_SALE') {
      return {
        key: 'OFF_SALE',
        label: '已下架',
      };
    }

    const skuList = Array.isArray(row?.skuList) ? row.skuList : [];
    const hasAvailableSku = skuList.some((sku) => {
      const skuStatus = normalizeStatus(sku?.skuStatus || sku?.status || 'ON_SALE');
      const availableStock = Number(sku?.availableStock ?? sku?.available_stock ?? 0);

      return skuStatus === 'ON_SALE' && availableStock > 0;
    });
    const totalStock = Number(row?.stock ?? row?.availableStock ?? 0);

    if (hasAvailableSku || totalStock > 0) {
      return {
        key: 'ON_SALE',
        label: '在售',
      };
    }

    return {
      key: 'SOLD_OUT',
      label: '售罄',
    };
  }

  function getFilteredAdminProductRows(rows) {
    const allRows = Array.isArray(rows) ? rows : [];

    return allRows.filter((row) => {
      const matchStatus =
        activeAdminProductFilter === 'ALL' ||
        getAdminProductSaleState(row).key === activeAdminProductFilter;
      const matchSearch = matchesAdminProductSearch(row);

      return matchStatus && matchSearch;
    });
  }

  function renderAdminProductFilterBar(counts) {
    if (!productFilterBar) {
      return;
    }

    productFilterBar.innerHTML = adminProductFilters
      .map((filter) => {
        const isActive = filter.value === activeAdminProductFilter;
        const count = filter.value === 'ALL' ? counts.all : counts[filter.value] || 0;

        return `
          <button
            type="button"
            class="admin-product-filter__button${isActive ? ' is-active' : ''}"
            data-admin-product-filter="${filter.value}"
            aria-pressed="${isActive ? 'true' : 'false'}"
          >
            ${escapeHtml(filter.label)} (${escapeHtml(count)})
          </button>
        `;
      })
      .join('');
  }

  function updateAdminProductSearchClearState() {
    if (adminProductSearchClear) {
      adminProductSearchClear.hidden = !String(activeAdminProductSearchKeyword || "").trim();
    }
  }

  function getAdminOrderDetailRow(orderId) {
    return ordersBody?.querySelector(`[data-admin-order-detail-row="${orderId}"]`) || null;
  }

  function getAdminOrderDetailContainer(orderId) {
    return ordersBody?.querySelector(`[data-admin-order-detail-container="${orderId}"]`) || null;
  }

  function collapseAdminOrderDetail(orderId) {
    const row = getAdminOrderDetailRow(orderId);
    const container = getAdminOrderDetailContainer(orderId);

    if (row) {
      row.hidden = true;
    }

    if (container) {
      container.innerHTML = '';
    }

    if (activeAdminOrderDetailId === orderId) {
      activeAdminOrderDetailId = null;
    }
  }

  function expandAdminOrderDetailRow(orderId) {
    const row = getAdminOrderDetailRow(orderId);

    if (row) {
      row.hidden = false;
    }

    activeAdminOrderDetailId = orderId;
  }

  async function loadAdminOrderDetailFromApi(orderId) {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders/${orderId}`);

    if (!result.success) {
      throw new Error(result.detail || '加载后台订单详情失败');
    }

    return result;
  }

  async function shipAdminOrderToApi(orderId, remark = '管理员后台发货') {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders/ship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: Number(orderId),
        remark,
      }),
    });

    if (!result.success) {
      throw new Error(result.detail || '后台发货失败');
    }

    return result;
  }

  async function unshipAdminOrderToApi(orderId, remark = '管理员后台取消发货') {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders/unship`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: Number(orderId),
        remark,
      }),
    });

    if (!result.success) {
      throw new Error(result.detail || '后台取消发货失败');
    }

    return result;
  }

  async function approveAdminRefundToApi(orderId, remark = '管理员同意退款') {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders/refund/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: Number(orderId),
        remark,
      }),
    });

    if (!result.success) {
      throw new Error(result.detail || '同意退款失败');
    }

    return result;
  }

  async function rejectAdminRefundToApi(orderId, remark = '管理员拒绝退款') {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders/refund/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: Number(orderId),
        remark,
      }),
    });

    if (!result.success) {
      throw new Error(result.detail || '拒绝退款失败');
    }

    return result;
  }

  async function renderAdminOrderDetail(orderId, detail = null) {
    const row = getAdminOrderDetailRow(orderId);
    const container = getAdminOrderDetailContainer(orderId);

    if (!row || !container) {
      return;
    }

    expandAdminOrderDetailRow(orderId);
    container.innerHTML = '<p class="order-detail__loading">正在加载订单详情...</p>';

    try {
      const detailData = detail || await loadAdminOrderDetailFromApi(orderId);
      container.innerHTML = renderApiOrderDetail(detailData);
    } catch (error) {
      console.error('加载后台订单详情失败：', error);
      container.innerHTML = `<p class="order-detail__empty">加载订单详情失败：${escapeHtml(error.message)}</p>`;
    }
  }

  function normalizeAdminOrderRow(row) {
    const orderId = Number(row?.order_id || 0);
    const itemKindCount = Number(row?.item_kind_count || 0);
    const totalQuantity = Number(row?.total_quantity || 0);
    const totalAmount = Number(row?.total_amount || 0);
    const status = normalizeStatus(row?.status || "UNKNOWN");
    const productSummary = String(row?.product_summary || "").trim();

    return {
      orderId,
      orderNo: row?.order_no || (orderId ? `订单 ${orderId}` : "订单"),
      userId: Number(row?.user_id || 0),
      email: row?.email || "",
      status,
      statusLabel: formatOrderStatus(status),
      totalAmount,
      itemKindCount,
      totalQuantity,
      productSummary: productSummary || `${itemKindCount} 类商品 / ${totalQuantity} 件`,
      createdAt: renderOrderDetailValue(row?.created_at),
      updatedAt: renderOrderDetailValue(row?.updated_at),
    };
  }

  async function loadAdminOrdersFromApi() {
    const result = await adminFetch(`${API_BASE_URL}/admin/orders`);

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error(result.detail || "加载数据库订单失败");
    }

    return result.data.map(normalizeAdminOrderRow);
  }

  function renderAdminOrders(orderList, emptyText = "暂无数据库订单") {
    if (!ordersBody) {
      return;
    }

    const rows = Array.isArray(orderList) ? orderList : [];

    if (!rows.length) {
      ordersBody.innerHTML = `<tr><td colspan="7"><div class="admin-empty">${escapeHtml(emptyText)}</div></td></tr>`;
      return;
    }

    ordersBody.innerHTML = rows
      .map(
        (row) => {
          const isExpanded = activeAdminOrderDetailId === row.orderId;
          const status = normalizeStatus(row.status);
          const statusBadge = renderAdminOrderStatusBadge(status);
          const canShip = status === 'PAID';
          const canUnship = status === 'SHIPPED';
          const canReviewRefund = status === 'REFUND_REQUESTED';
          const detailButtonLabel = isExpanded ? '收起详情' : '查看详情';
          const detailRowHidden = isExpanded ? '' : ' hidden';
          let actionButtonHtml = `
            <button
              class="admin-order-action-button admin-order-action-button--disabled"
              type="button"
              disabled
            >
              无法发货
            </button>
          `;

          if (canReviewRefund) {
            actionButtonHtml = `
              <button
                class="admin-order-action-button admin-order-action-button--primary"
                type="button"
                data-admin-order-refund-approve-id="${row.orderId}"
              >
                同意退款
              </button>
              <button
                class="admin-order-action-button admin-order-action-button--warning"
                type="button"
                data-admin-order-refund-reject-id="${row.orderId}"
              >
                拒绝退款
              </button>
            `;
          }

          if (canShip) {
            actionButtonHtml = `
              <button
                class="admin-order-action-button admin-order-action-button--primary"
                type="button"
                data-admin-order-ship-id="${row.orderId}"
              >
                发货
              </button>
            `;
          }

          if (canUnship) {
            actionButtonHtml = `
              <button
                class="admin-order-action-button admin-order-action-button--warning"
                type="button"
                data-admin-order-unship-id="${row.orderId}"
              >
                取消发货
              </button>
            `;
          }

          return `
          <tr>
            <td>${escapeHtml(row.orderNo)}</td>
            <td>${escapeHtml(row.email || `用户 ${row.userId || ""}`)}</td>
            <td>${escapeHtml(row.productSummary || `${row.itemKindCount} 类商品 / ${row.totalQuantity} 件`)}</td>
            <td>${escapeHtml(formatPrice(row.totalAmount))}</td>
            <td>${statusBadge}</td>
            <td>${escapeHtml(row.createdAt)}</td>
            <td>
              <div class="admin-order-actions">
                <button
                  class="admin-order-action-button"
                  type="button"
                  data-admin-order-detail-id="${row.orderId}"
                >
                  ${escapeHtml(detailButtonLabel)}
                </button>
                ${actionButtonHtml}
              </div>
            </td>
          </tr>
          <tr class="admin-order-detail-row" data-admin-order-detail-row="${row.orderId}"${detailRowHidden}>
            <td colspan="7">
              <div class="admin-order-detail-container" data-admin-order-detail-container="${row.orderId}"></div>
            </td>
          </tr>
        `;
        },
      )
      .join("");
  }

  async function refreshAdminOrdersFromApi() {
    try {
      orders = await loadAdminOrdersFromApi();
      renderAdminOrders(orders);

      if (activeAdminOrderDetailId) {
        await renderAdminOrderDetail(activeAdminOrderDetailId);
      }

      console.log("后台订单已切换为数据库订单：", orders);
    } catch (error) {
      console.error("后台订单加载失败：", error);

      if (error.status === 401 || error.status === 403) {
        clearStoredAdminSession();
        resetAdminDashboardState();
        renderAdminAuthState(error.detail || error.message);
        return;
      }

      orders = [];
      renderAdminOrders([], `加载数据库订单失败：${error.message}`);
    }
  }

function convertApiStatsToRenderedStats(result) {
  const summary = result.summary || {};
  const rows = Array.isArray(result.rows) ? result.rows : [];
  const maxRevenue = Math.max(
    1,
    ...rows.map((row) => Number(row.total_sales_amount || 0))
  );

  return {
    kpis: [
      {
        label: "已支付销售额",
        value: formatPrice(summary.total_revenue || 0),
        detail: `已支付/退款待处理订单 ${Number(summary.paid_order_count || 0)} 单`,
      },
      {
        label: "订单总数",
        value: String(Number(summary.total_order_count || 0)),
        detail: `待支付 ${Number(summary.pending_order_count || 0)} 单，已取消 ${Number(summary.cancelled_order_count || 0)} 单`,
      },
      {
        label: "售出件数",
        value: String(Number(summary.total_units_sold || 0)),
        detail: "按已支付/退款待处理订单统计",
      },
      {
        label: "商品数量",
        value: String(Number(summary.total_product_count || 0)),
        detail: "数据库商品总数",
      },
    ],
    rows: rows.map((row) => {
      const revenue = Number(row.total_sales_amount || 0);
      const barWidth = `${Math.max(6, Math.round((revenue / maxRevenue) * 100))}%`;

      return {
        name: `${row.product_name || "未知商品"} / ${row.sku_name || "默认规格"}`,
        category: row.category_name || "未分类",
        unitsLabel: `销量 ${Number(row.total_sold_count || 0)} 件`,
        revenueLabel: formatPrice(revenue),
        barWidth,
      };
    }),
  };
}

async function refreshAdminStatsFromApi() {
  try {
    const result = await adminFetch(`${API_BASE_URL}/admin/stats`);

    if (!result.success) {
      throw new Error(result.detail || "加载后台销量统计失败");
    }

    renderedStats = convertApiStatsToRenderedStats(result);
    renderStats();

    console.log("后台销量统计已切换为数据库数据：", result);
  } catch (error) {
    console.error("后台销量统计加载失败：", error);

    if (error.status === 401 || error.status === 403) {
      clearStoredAdminSession();
      resetAdminDashboardState();
      renderAdminAuthState(error.detail || error.message);
    }
  }
}

function getAdminProductImages(product) {
  const sourceImages = Array.isArray(product?.images)
    ? product.images
    : Array.isArray(product?.product_images)
      ? product.product_images
      : [];

  if (sourceImages.length > 0) {
    return sourceImages
      .filter((image) => image && image.image_url)
      .map((image) => ({
        id: image.id ?? null,
        image_url: String(image.image_url),
        is_main: Number(image.is_main || 0),
        sort_order: Number(image.sort_order || 0),
      }));
  }

  const imageUrl = String(product?.image_url || product?.image || '').trim();
  return imageUrl
    ? [{ id: null, image_url: imageUrl, is_main: 1, sort_order: 0 }]
    : [];
}

function getAdminProductImageCount(product) {
  const count = Number(product?.image_count);
  return Number.isFinite(count) && count >= 0 ? count : getAdminProductImages(product).length;
}
function convertApiRowsToAdminProducts(apiRows) {
  const productMap = new Map();

  apiRows.forEach((row) => {
    const productId = Number(row.product_id);
    const skuId = Number(row.sku_id);

    if (!productId || !skuId) {
      return;
    }

    const price = Number(row.price || 0);
    const availableStock = Number(row.available_stock || 0);
    const lockedStock = Number(row.locked_stock || 0);
    const sales = Number(row.total_sold_count || 0);
    const imageUrl = String(row.image_url || "").trim();

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        id: `db-product-${productId}`,
        productId,
        categoryId: Number(row.category_id),
        name: row.product_name || "未命名商品",
        category: row.category_name || "未分类",
        price,
        badge: "数据库商品",
        status: row.product_status || "UNKNOWN",
        image: imageUrl,
        images: getAdminProductImages(row),
        imageCount: getAdminProductImageCount(row),
        imageLabel: imageUrl ? imageUrl.split("/").pop() : "暂无图片",
        createdAt: row.product_created_at || "",
        description: normalizeProductDescription(row.description),
        skuCount: 0,
        stock: 0,
        lockedStock: 0,
        sales: 0,
        skuList: [],
      });
    }

    const product = productMap.get(productId);

    product.skuCount += 1;
    product.stock += availableStock;
    product.lockedStock += lockedStock;
    product.sales += sales;
    product.price = Math.min(product.price, price);

    product.skuList.push({
      skuId,
      skuCode: row.sku_code || "",
      skuName: row.sku_name || "默认规格",
      color: row.color || row.color_name || "",
      size: row.size || row.size_name || "",
      price: Number(row.price || 0),
      availableStock: Number(row.available_stock || 0),
      lockedStock: Number(row.locked_stock || 0),
      sales: Number(row.total_sold_count || 0),
      skuStatus: normalizeStatus(row.sku_status || "ON_SALE"),
      onSale: Number(row.on_sale) === 1 ? 1 : 0,
      skuIsDeleted: Number(row.sku_is_deleted || 0),
    });
  });

  return Array.from(productMap.values())
    .map((product) => {
      const state = getProductDisplayState(product);

      return {
        ...product,
        saleState: state.key,
        saleStateLabel: state.label,
        saleStateMessage: state.message,
      };
    });
}

function renderAdminInventoryProductsView(adminProducts) {
  return {
    emptyState: adminProducts.length ? null : "暂无商品数据",
    rows: adminProducts.map((product) => ({
      id: product.id,
      productId: product.productId,
      categoryId: product.categoryId,
      name: product.name,
      category: product.category,
      priceLabel: formatPrice(product.price),
      badge: product.badge || "数据库商品",
      status: normalizeStatus(product.status || "UNKNOWN"),
      image: product.image || "",
      imageLabel: product.imageLabel || "暂无图片",
      images: getAdminProductImages(product),
      imageCount: getAdminProductImageCount(product),
      createdAt: product.createdAt || "",

      skuCount: product.skuCount || 0,
      stock: product.stock || 0,
      lockedStock: product.lockedStock || 0,
      sales: product.sales || 0,
      skuList: Array.isArray(product.skuList) ? product.skuList : [],
    })),
  };
}

async function loadAdminProductsFromApi() {
  const result = await adminFetch(`${API_BASE_URL}/admin/inventory`);

  if (!result.success || !Array.isArray(result.data)) {
    throw new Error(result.detail || "加载后台商品库存列表失败");
  }

  return convertApiRowsToAdminProducts(result.data);
}

async function loadAdminCategoriesFromApi() {
  const result = await adminFetch(`${API_BASE_URL}/admin/categories`);
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error(result.detail || '加载后台分类列表失败');
  }
  return result.data
    .map(normalizeApiCategory)
    .sort((left, right) => left.isDeleted - right.isDeleted
      || left.sortOrder - right.sortOrder
      || left.name.localeCompare(right.name, 'zh-CN')
      || left.categoryId - right.categoryId);
}

async function createAdminCategoryToApi(name, sortOrder) {
  return adminFetch(`${API_BASE_URL}/admin/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sort_order: sortOrder }),
  });
}

async function updateAdminCategoryToApi(categoryId, name, sortOrder) {
  return adminFetch(`${API_BASE_URL}/admin/categories/${categoryId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, sort_order: sortOrder }),
  });
}

async function deleteAdminCategoryToApi(categoryId) {
  return adminFetch(`${API_BASE_URL}/admin/categories/${categoryId}`, { method: 'DELETE' });
}

async function restoreAdminCategoryToApi(categoryId) {
  return adminFetch(`${API_BASE_URL}/admin/categories/${categoryId}/restore`, { method: 'POST' });
}

async function updateAdminProductCategoryToApi(productId, categoryId) {
  return adminFetch(`${API_BASE_URL}/admin/products/${productId}/category`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category_id: categoryId }),
  });
}

function getActiveAdminCategories() {
  return adminCategories.filter((category) => Number(category.isDeleted) === 0);
}

function getAdminCategoryOptionsHtml(selectedId = null) {
  return getActiveAdminCategories().map((category) => `
    <option value="${category.categoryId}" ${Number(selectedId) === category.categoryId ? 'selected' : ''}>
      ${escapeHtml(category.name)}
    </option>
  `).join('');
}

function refreshAdminProductCategorySelect() {
  if (!productCategorySelect) return;
  const previous = Number(productCategorySelect.value);
  const activeCategories = getActiveAdminCategories();
  productCategorySelect.innerHTML = activeCategories.length
    ? `<option value="">请选择分类</option>${getAdminCategoryOptionsHtml(previous)}`
    : '<option value="">暂无可用分类</option>';
  productCategorySelect.disabled = activeCategories.length === 0;
  if (productCategoryEmpty) productCategoryEmpty.hidden = activeCategories.length > 0;
  if (productSubmitButton && !productSubmitButton.textContent.includes('上架中')) {
    productSubmitButton.disabled = activeCategories.length === 0;
  }
}

function renderAdminCategories() {
  refreshAdminProductCategorySelect();
  if (!categoryList) return;
  const rows = adminCategories.filter((category) => {
    if (activeAdminCategoryFilter === 'ACTIVE') return Number(category.isDeleted) === 0;
    if (activeAdminCategoryFilter === 'DELETED') return Number(category.isDeleted) === 1;
    return true;
  });
  categoryFilter?.querySelectorAll('[data-admin-category-filter-value]').forEach((button) => {
    const active = button.dataset.adminCategoryFilterValue === activeAdminCategoryFilter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (!rows.length) {
    categoryList.innerHTML = '<div class="admin-empty">当前筛选暂无分类</div>';
    return;
  }
  categoryList.innerHTML = rows.map((category) => {
    const deleted = Number(category.isDeleted) === 1;
    const busy = pendingAdminCategoryIds.has(category.categoryId);
    const hasProducts = category.productCount > 0;
    return `
      <article class="admin-category-row ${deleted ? 'is-deleted' : ''}" data-admin-category-row="${category.categoryId}">
        <div class="admin-category-row__meta"><span>分类 ID</span><strong>${category.categoryId}</strong></div>
        <label class="admin-category-row__field"><span>分类名称</span><input maxlength="80" value="${escapeHtml(category.name)}" data-admin-category-edit-name ${deleted || busy ? 'disabled' : ''} /></label>
        <label class="admin-category-row__field"><span>排序值</span><input type="number" min="0" max="9999" step="1" value="${category.sortOrder}" data-admin-category-edit-sort ${deleted || busy ? 'disabled' : ''} /></label>
        <div class="admin-category-row__meta admin-category-row__counts"><span>商品统计</span><strong>全部 ${category.productCount} · 上架 ${category.onSaleProductCount} · 下架 ${category.offSaleProductCount}</strong></div>
        <div class="admin-category-row__meta"><span>状态</span><strong>${deleted ? '已删除' : '使用中'}</strong></div>
        <div class="admin-category-row__actions">
          ${deleted
            ? `<button type="button" class="ghost-button ghost-button--small ghost-button--solid" data-admin-category-restore="${category.categoryId}" ${busy ? 'disabled' : ''}>恢复分类</button>`
            : `<button type="button" class="ghost-button ghost-button--small ghost-button--solid" data-admin-category-save="${category.categoryId}" ${busy ? 'disabled' : ''}>保存修改</button>
               <button type="button" class="ghost-button ghost-button--small ghost-button--danger" data-admin-category-delete="${category.categoryId}" ${busy || hasProducts ? 'disabled' : ''}>删除分类</button>`}
        </div>
        ${!deleted && hasProducts ? '<p class="admin-category-row__hint">请先移动该分类下的商品</p>' : ''}
      </article>
    `;
  }).join('');
}

async function refreshAdminCategoriesFromApi() {
  try {
    if (categoryList && !adminCategories.length) categoryList.innerHTML = '<div class="admin-empty">正在加载分类...</div>';
    adminCategories = await loadAdminCategoriesFromApi();
    renderAdminCategories();
    renderProducts();
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      clearStoredAdminSession();
      resetAdminDashboardState();
      renderAdminAuthState(error.detail || error.message);
      return;
    }
    if (categoryList) categoryList.innerHTML = `<div class="admin-empty">加载分类失败：${escapeHtml(error.message)}</div>`;
    setFeedback(categoryFeedback, `加载分类失败：${error.message}`, true);
  }
}

  function refreshAdminData() {
  if (!Array.isArray(products) || products.length === 0) {
    products = getStoredAdminProducts(storage);
  }

  orders = [];
  summary = getSalesSummary(products, orders);
  productRows = getProductSalesRows(products, orders);
  renderedStats = renderAdminStatsView(summary, productRows);
  renderedProducts = renderAdminProductsView(products);
}

async function refreshAdminProductsFromApi() {
  try {
    products = await loadAdminProductsFromApi();
    renderedProducts = renderAdminInventoryProductsView(products);

    renderProducts();

    console.log("后台上架新品列表已切换为数据库库存数据：", products);
  } catch (error) {
    console.error("后台商品列表加载失败：", error);

    if (error.status === 401 || error.status === 403) {
      clearStoredAdminSession();
      resetAdminDashboardState();
      renderAdminAuthState(error.detail || error.message);
      return;
    }

    products = getStoredAdminProducts(storage);
    renderedProducts = renderAdminProductsView(products);
    renderProducts();

    setFeedback(
      productManageFeedback || productFeedback,
      `后台商品列表加载数据库失败，暂时显示本地模拟商品：${error.message}`,
      true
    );
  }
}

  function renderOrders() {
    renderAdminOrders(orders);
  }

  function renderStats() {
    if (statsSummary) {
      if (!renderedStats) {
        statsSummary.innerHTML = '';
      } else {
      statsSummary.innerHTML = renderedStats.kpis
        .map(
          (item) => `
            <article class="admin-kpi">
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.label)}</span>
              <span>${escapeHtml(item.detail)}</span>
            </article>
          `,
        )
        .join('');
      }
    }

    if (statsRows) {
      if (!renderedStats) {
        statsRows.innerHTML = '';
      } else {
      statsRows.innerHTML = renderedStats.rows
        .map(
          (row) => `
            <article class="admin-row">
              <div class="admin-row__header">
                <strong>${escapeHtml(row.name)}</strong>
                <span>${escapeHtml(row.unitsLabel)} · ${escapeHtml(row.revenueLabel)}</span>
              </div>
              <div class="admin-row__bar" aria-hidden="true">
                <span style="width: ${escapeHtml(row.barWidth)}"></span>
              </div>
              <span>${escapeHtml(row.category)}</span>
            </article>
          `,
        )
        .join('');
      }
    }
  }

  function renderProducts() {
    const allRows = Array.isArray(renderedProducts?.rows) ? renderedProducts.rows : [];
    const searchKeyword = String(activeAdminProductSearchKeyword || "").trim();
    const counts = {
      all: allRows.length,
      ON_SALE: 0,
      SOLD_OUT: 0,
      OFF_SALE: 0,
    };

    allRows.forEach((row) => {
      const state = getAdminProductSaleState(row);

      counts[state.key] += 1;
    });

    renderAdminProductFilterBar(counts);

    if (productSummary) {
      productSummary.hidden = true;
      productSummary.innerHTML = "";
    }

    updateAdminProductSearchClearState();

    if (!productList) {
      return;
    }

    if (!allRows.length) {
      productList.innerHTML = `<div class="admin-empty">${escapeHtml(renderedProducts?.emptyState || '暂无商品数据')}</div>`;
      return;
    }

    const filteredRows = getFilteredAdminProductRows(allRows);

    if (!filteredRows.length) {
      const filterLabel = getAdminProductFilterLabel(activeAdminProductFilter);
      const emptyText = searchKeyword
        ? `没有找到名称包含“${searchKeyword}”且符合“${filterLabel}”条件的商品`
        : `当前筛选“${filterLabel}”暂无商品`;

      productList.innerHTML = `<div class="admin-empty">${escapeHtml(emptyText)}</div>`;
      return;
    }

    productList.innerHTML = filteredRows
      .map((row) => {
        const imageItems = getAdminProductImages(row).slice(0, 4);
        const imageSrc = getAdminImageSrc(imageItems[0]?.image_url || row.image);
        const imageCount = getAdminProductImageCount(row);
        const isOnSaleProduct = getAdminProductSaleState(row).key === "ON_SALE";
        const statusLabel = getAdminProductSaleState(row).label;
        const nextStatus = isOnSaleProduct ? "OFF_SALE" : "ON_SALE";
        const nextStatusText = isOnSaleProduct ? "下架商品" : "重新上架";

        return `
          <article class="admin-row admin-product-row" data-admin-product-id="${row.productId}">
            <div class="admin-product-row__main">
              <div class="admin-product-thumb-wrap">
                ${
                  imageSrc
                    ? `<img class="admin-product-thumb" src="${escapeHtml(imageSrc)}" alt="${escapeHtml(row.name)} 主图" loading="lazy" decoding="async" />`
                    : `<div class="admin-product-thumb admin-product-thumb--empty">暂无图</div>`
                }
                ${imageItems.length > 1 ? `
                  <div class="admin-product-thumbnails" aria-label="${escapeHtml(row.name)} 图片预览">
                    ${imageItems.map((image) => `<img src="${escapeHtml(getAdminImageSrc(image.image_url))}" alt="" loading="lazy" decoding="async" />`).join("")}
                  </div>
                ` : ""}
              </div>

              <div class="admin-product-row__content">
                <div class="admin-row__header">
                  <strong>${escapeHtml(row.name)}</strong>
                  <span>${escapeHtml(row.priceLabel)}</span>
                </div>

                <span>${escapeHtml(row.category)} · ${escapeHtml(row.badge)}</span>
                <span>状态：${escapeHtml(statusLabel)} · 图片 ${escapeHtml(imageCount)} 张 · ${escapeHtml(row.imageLabel)}</span>
                <span>SKU ${escapeHtml(row.skuCount || 1)} 个 · 可用库存 ${escapeHtml(row.stock || 0)} · 锁定 ${escapeHtml(row.lockedStock || 0)} · 销量 ${escapeHtml(row.sales || 0)}</span>

                <div class="admin-product-category-control">
                  <span>所属分类</span>
                  <select data-admin-product-category-select="${row.productId}" data-admin-product-category-original="${row.categoryId}" ${getActiveAdminCategories().length ? '' : 'disabled'}>
                    ${getAdminCategoryOptionsHtml(row.categoryId)}
                  </select>
                  <div class="admin-product-category-control__actions">
                    <button type="button" class="ghost-button ghost-button--small ghost-button--solid" data-admin-product-category-save="${row.productId}" disabled>保存分类</button>
                    <small data-admin-product-category-feedback="${row.productId}"></small>
                  </div>
                </div>

                <div class="admin-sku-list">
                  ${row.skuList
                    .map((sku) => {
                      const skuStatusLabel = normalizeStatus(sku.skuStatus) === "ON_SALE" ? "在售" : "已下架";

                      return `
                        <div class="admin-sku-row" data-admin-sku-row="${sku.skuId}">
                          <div class="admin-sku-row__info">
                            <strong>${escapeHtml(sku.skuName || "默认规格")}</strong>
                            <span>SKU ID：${escapeHtml(sku.skuId)} · ${escapeHtml(skuStatusLabel)} · 锁定 ${escapeHtml(sku.lockedStock || 0)} · 销量 ${escapeHtml(sku.sales || 0)}</span>
                          </div>

                          <label class="admin-stock-editor">
                            <span>可用库存</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value="${escapeHtml(sku.availableStock || 0)}"
                              data-admin-stock-input="${sku.skuId}"
                            />
                          </label>

                          <button
                            type="button"
                            class="ghost-button ghost-button--small ghost-button--solid"
                            data-admin-stock-save="${sku.skuId}"
                          >
                            更新库存
                          </button>
                        </div>
                      `;
                    })
                    .join("")}
                </div>

                <div class="admin-product-row__actions">
                  <button
                    type="button"
                    class="ghost-button ghost-button--small"
                    data-admin-product-description-edit="${row.productId}"
                  >
                    编辑介绍
                  </button>
                  <button
                    type="button"
                    class="ghost-button ghost-button--small ghost-button--solid"
                    data-admin-product-sku-manage="${row.productId}"
                  >
                    管理规格
                  </button>
                  <button
                    type="button"
                    class="ghost-button ghost-button--small"
                    data-admin-product-image-manage="${row.productId}"
                  >
                    管理图片
                  </button>
                  <button
                    type="button"
                    class="ghost-button ghost-button--small ${isOnSaleProduct ? "ghost-button--danger" : "ghost-button--solid"}"
                    data-admin-product-status-id="${row.productId}"
                    data-admin-product-next-status="${nextStatus}"
                  >
                    ${nextStatusText}
                  </button>
                  <button
                    type="button"
                    class="ghost-button ghost-button--small ghost-button--danger"
                    data-admin-product-delete-id="${row.productId}"
                  >
                    删除商品
                  </button>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');
  }

  function populateImageSelect() {
    if (!imageSelect) {
      return;
    }

    const options = getAdminImageOptions();
    imageSelect.innerHTML = options
      .map(
        (option, index) => `
          <option value="${escapeHtml(option.image)}">${escapeHtml(option.label)} (${index + 1})</option>
        `,
      )
      .join('');
    if (options.length > 0) {
      imageSelect.value = options[0].image;
    }
  }

function getAdminImageSrc(imageUrl) {
  const url = String(imageUrl || "").trim();

  if (!url) {
    return "";
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith("/")) {
    return `${API_BASE_URL}${url}`;
  }

  return url;
}

async function updateAdminSkuStockToApi(skuId, availableStock) {
  const result = await adminFetch(`${API_BASE_URL}/admin/inventory/update-stock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sku_id: Number(skuId),
      available_stock: Number(availableStock),
    }),
  });

  if (!result.success) {
    throw new Error(result.detail || "修改库存失败");
  }

  return result;
}

async function updateAdminProductStatusToApi(productId, status) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/update-status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: Number(productId),
      status,
    }),
  });

  if (!result.success) {
    throw new Error(result.detail || "修改商品状态失败");
  }

  return result;
}

async function updateAdminProductDescriptionToApi(productId, description) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/description`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      description: normalizeProductDescription(description),
    }),
  });

  if (!result.success) {
    throw new Error(result.detail || "修改商品介绍失败");
  }

  return result;
}

async function deleteAdminProductToApi(productId) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: Number(productId),
    }),
  });

  if (!result.success) {
    throw new Error(result.detail || "删除商品失败");
  }

  return result;
}

function normalizeAdminSkuApiRow(row) {
  return {
    skuId: Number(row.sku_id),
    productId: Number(row.product_id),
    productName: row.product_name || "未命名商品",
    skuCode: row.sku_code || "",
    skuName: row.sku_name || "默认规格",
    color: row.color || row.color_name || "",
    size: row.size || row.size_name || "",
    price: Number(row.price || 0),
    availableStock: Number(row.stock ?? row.available_stock ?? 0),
    lockedStock: Number(row.locked_stock || 0),
    onSale: Number(row.on_sale) === 1 ? 1 : 0,
    skuStatus: normalizeStatus(row.sku_status || (Number(row.on_sale) === 1 ? "ON_SALE" : "OFF_SALE")),
    skuIsDeleted: Number(row.sku_is_deleted || 0),
  };
}

async function loadAdminProductSkusToApi(productId) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/skus`);
  if (!result.success || !Array.isArray(result.data)) {
    throw new Error(result.detail || "加载商品 SKU 失败");
  }
  return result.data.map(normalizeAdminSkuApiRow);
}

async function createAdminProductSkusToApi(productId, skus) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/skus`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skus }),
  });
  if (!result.success) throw new Error(result.detail || "新增 SKU 失败");
  return result;
}

async function updateAdminProductSkuToApi(productId, skuId, sku) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/skus/${skuId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sku),
  });
  if (!result.success) throw new Error(result.detail || "修改 SKU 失败");
  return result;
}

async function deleteAdminProductSkuToApi(productId, skuId) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/skus/${skuId}`, {
    method: "DELETE",
  });
  if (!result.success) throw new Error(result.detail || result.message || "删除 SKU 失败");
  return result;
}

function parseAdminSkuRows(values) {
  const sourceRows = Array.isArray(values?.skuRows) ? values.skuRows : [];

  if (!sourceRows.length) {
    throw new Error("请先填写颜色和尺码，至少生成一个 SKU 组合。");
  }

  const codeSet = new Set();
  const dimensionSet = new Set();

  return sourceRows.map((sourceRow, index) => {
    const skuCode = String(sourceRow.sku_code || "").trim();
    const color = String(sourceRow.color || "").trim();
    const size = String(sourceRow.size || "").trim();
    const skuName = String(sourceRow.sku_name || "").trim() || `${color} / ${size}`;
    const price = Number(sourceRow.price);
    const stock = Number(sourceRow.stock);
    const onSale = Number(sourceRow.on_sale) === 0 ? 0 : 1;

    if (!color || !size) {
      throw new Error(`第 ${index + 1} 行颜色和尺码不能为空`);
    }
    if (!skuCode) {
      throw new Error(`第 ${index + 1} 行 SKU 编码不能为空`);
    }
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`第 ${index + 1} 行价格必须大于 0`);
    }
    if (!Number.isInteger(stock) || stock < 0) {
      throw new Error(`第 ${index + 1} 行库存必须是大于等于 0 的整数`);
    }

    const codeKey = skuCode.toLocaleLowerCase();
    const dimensionKey = `${color.toLocaleLowerCase()}\u0000${size.toLocaleLowerCase()}`;
    if (codeSet.has(codeKey)) {
      throw new Error(`SKU 编码重复：${skuCode}`);
    }
    if (dimensionSet.has(dimensionKey)) {
      throw new Error(`颜色和尺码组合重复：${color} / ${size}`);
    }
    codeSet.add(codeKey);
    dimensionSet.add(dimensionKey);

    return {
      sku_code: skuCode,
      sku_name: skuName,
      color,
      size,
      price,
      stock,
      on_sale: onSale,
    };
  });
}


async function createAdminProductToApi(values, imageFiles = []) {
  const formData = new FormData();
  const skuRows = Array.isArray(values.skuRows)
    ? values.skuRows
    : parseAdminSkuRows(values);

  const firstSku = skuRows[0];

  formData.append("category_id", String(Number(values.categoryId || values.category_id || 0)));
  formData.append("product_name", String(values.name || "").trim());
  formData.append("description", normalizeProductDescription(values.description));

  formData.append("sku_name", firstSku.sku_name);
  formData.append("price", String(firstSku.price));
  formData.append("available_stock", String(firstSku.stock));

  formData.append("skus_json", JSON.stringify(skuRows));

  const files = Array.isArray(imageFiles) ? imageFiles : imageFiles ? [imageFiles] : [];
  files.forEach((file) => {
    formData.append("images", file);
  });

  const result = await adminFetch(`${API_BASE_URL}/products`, {
    method: "POST",
    body: formData,
  });

  if (!result.success) {
    throw new Error(result.detail || "新增商品失败");
  }

  console.log("后台商品已写入数据库：", result);
  return result;
}

async function appendAdminProductImagesToApi(productId, imageFiles) {
  const formData = new FormData();
  const files = Array.isArray(imageFiles) ? imageFiles : [];

  files.forEach((file) => {
    formData.append("images", file);
  });

  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/images`, {
    method: "POST",
    body: formData,
  });

  if (!result.success) {
    throw new Error(result.detail || result.message || "追加商品图片失败");
  }

  return result;
}

async function deleteAdminProductImageToApi(productId, imageId) {
  const result = await adminFetch(`${API_BASE_URL}/admin/products/${productId}/images/${imageId}`, {
    method: "DELETE",
  });

  if (!result.success) {
    throw new Error(result.detail || result.message || "删除商品图片失败");
  }

  return result;
}

  function setAdminOperationLogSelectOptions(select, placeholder, rows, getValue, getLabel) {
    if (!select) {
      return;
    }

    const selectedValue = select.value;
    const fragment = document.createDocumentFragment();
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    fragment.append(placeholderOption);

    rows.forEach((row) => {
      const value = String(getValue(row) ?? '');
      if (!value) {
        return;
      }
      const option = document.createElement('option');
      option.value = value;
      option.textContent = String(getLabel(row) ?? value);
      fragment.append(option);
    });

    select.replaceChildren(fragment);
    select.value = selectedValue;
  }

  async function loadAdminOperationLogOptions() {
    const result = await adminFetch(`${API_BASE_URL}/admin/operation-log-options`);
    if (!result.success) {
      throw new Error(result.detail || '加载操作日志筛选项失败');
    }

    setAdminOperationLogSelectOptions(
      operationLogAction,
      '全部操作',
      Array.isArray(result.action_types) ? result.action_types : [],
      (value) => value,
      (value) => value,
    );
    setAdminOperationLogSelectOptions(
      operationLogTarget,
      '全部目标',
      Array.isArray(result.target_types) ? result.target_types : [],
      (value) => value,
      (value) => value,
    );
    setAdminOperationLogSelectOptions(
      operationLogOperator,
      '全部管理员',
      Array.isArray(result.operators) ? result.operators : [],
      (row) => row.operator_id,
      (row) => `${row.operator_email || '管理员'} · ID ${row.operator_id}`,
    );
    adminOperationLogState.optionsLoaded = true;
    return result;
  }

  function getAdminOperationLogQuery(page) {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(adminOperationLogState.pageSize),
    });
    const filters = [
      ['action_type', operationLogAction?.value],
      ['target_type', operationLogTarget?.value],
      ['action_result', operationLogResult?.value],
      ['operator_id', operationLogOperator?.value],
      ['date_from', operationLogDateFrom?.value],
      ['date_to', operationLogDateTo?.value],
      ['keyword', operationLogKeyword?.value?.trim()],
    ];
    filters.forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    return params;
  }

  function formatAdminOperationLogTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value || '未知时间') : date.toLocaleString('zh-CN', { hour12: false });
  }

  function renderAdminOperationLogs(rows = [], options = {}) {
    if (!operationLogList) {
      return;
    }

    operationLogList.replaceChildren();
    if (options.loading) {
      const loading = document.createElement('div');
      loading.className = 'admin-empty';
      loading.textContent = '正在加载操作日志...';
      operationLogList.append(loading);
    } else if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'admin-empty';
      empty.textContent = '没有符合当前条件的操作日志。';
      operationLogList.append(empty);
    } else {
      const fragment = document.createDocumentFragment();
      rows.forEach((row) => {
        const isSuccess = row.action_result === 'SUCCESS';
        const card = document.createElement('article');
        card.className = `admin-operation-log-card ${isSuccess ? 'is-success' : 'is-failure'}`;

        const header = document.createElement('header');
        header.className = 'admin-operation-log-card__header';
        const title = document.createElement('strong');
        title.textContent = row.action_type || 'UNKNOWN_ACTION';
        const result = document.createElement('span');
        result.className = 'admin-operation-log-result';
        result.textContent = isSuccess ? '成功' : '失败';
        const time = document.createElement('time');
        time.textContent = formatAdminOperationLogTime(row.created_at);
        header.append(title, result, time);

        const meta = document.createElement('div');
        meta.className = 'admin-operation-log-meta';
        const operator = document.createElement('span');
        operator.textContent = `操作人：${row.operator_email || '管理员'}（ID ${row.operator_id ?? '-'}）`;
        const target = document.createElement('span');
        target.textContent = `目标：${row.target_type || '-'} / ${row.target_id ?? '-'}`;
        const logId = document.createElement('span');
        logId.textContent = `日志 ID：${row.log_id ?? '-'}`;
        meta.append(operator, target, logId);

        const remark = document.createElement('p');
        remark.className = 'admin-operation-log-remark';
        remark.textContent = row.remark || '无备注';

        const requestId = document.createElement('p');
        requestId.className = 'admin-operation-log-request-id';
        requestId.textContent = `请求 ID：${row.request_id || '-'}`;

        const detail = document.createElement('details');
        detail.className = 'admin-operation-log-detail';
        const detailSummary = document.createElement('summary');
        detailSummary.textContent = '查看结构化详情';
        const detailContent = document.createElement('pre');
        detailContent.textContent = row.detail ? JSON.stringify(row.detail, null, 2) : '无结构化详情';
        detail.append(detailSummary, detailContent);

        card.append(header, meta, remark, requestId, detail);
        fragment.append(card);
      });
      operationLogList.append(fragment);
    }

    const hasPages = adminOperationLogState.pages > 0;
    if (operationLogPageInfo) {
      operationLogPageInfo.textContent = hasPages
        ? `第 ${adminOperationLogState.page} / ${adminOperationLogState.pages} 页`
        : '第 0 / 0 页';
    }
    if (operationLogTotal) {
      operationLogTotal.textContent = `共 ${adminOperationLogState.total} 条`;
    }
    const atFirst = !hasPages || adminOperationLogState.page <= 1;
    const atLast = !hasPages || adminOperationLogState.page >= adminOperationLogState.pages;
    [operationLogFirst, operationLogPrev].forEach((button) => {
      if (button) button.disabled = adminOperationLogState.loading || atFirst;
    });
    [operationLogNext, operationLogLast].forEach((button) => {
      if (button) button.disabled = adminOperationLogState.loading || atLast;
    });
  }

  async function loadAdminOperationLogs(page = 1) {
    if (adminOperationLogState.loading) {
      return;
    }
    const requestedPage = Math.max(1, Number(page) || 1);
    const dateFrom = operationLogDateFrom?.value || '';
    const dateTo = operationLogDateTo?.value || '';
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setFeedback(operationLogFeedback, '开始时间不能晚于结束时间。', true);
      return;
    }

    adminOperationLogState.loading = true;
    renderAdminOperationLogs([], { loading: true });
    setFeedback(operationLogFeedback, '正在加载操作日志...');
    try {
      const params = getAdminOperationLogQuery(requestedPage);
      const result = await adminFetch(`${API_BASE_URL}/admin/operation-logs?${params.toString()}`);
      if (!result.success) {
        throw new Error(result.detail || '加载操作日志失败');
      }
      adminOperationLogState.page = Number(result.page || requestedPage);
      adminOperationLogState.pages = Number(result.pages || 0);
      adminOperationLogState.total = Number(result.total || 0);
      adminOperationLogState.loading = false;
      renderAdminOperationLogs(Array.isArray(result.data) ? result.data : []);
      setFeedback(operationLogFeedback, `已加载 ${result.data?.length || 0} 条操作日志。`);
      return result;
    } catch (error) {
      adminOperationLogState.loading = false;
      adminOperationLogState.pages = 0;
      adminOperationLogState.total = 0;
      renderAdminOperationLogs([]);
      setFeedback(operationLogFeedback, error.detail || error.message || '加载操作日志失败', true);
      if (error.status === 401 || error.status === 403) {
        clearStoredAdminSession();
        resetAdminDashboardState();
        renderAdminAuthState(error.detail || error.message);
      }
      return undefined;
    }
  }

  function syncPanels() {
    navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.adminNavTarget === activePanel);
      button.setAttribute('aria-pressed', String(button.dataset.adminNavTarget === activePanel));
    });

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.adminPanel === activePanel);
    });
  }

  async function loadAdminDashboardFromApi() {
    populateImageSelect();
    await refreshAdminOrdersFromApi();
    await refreshAdminStatsFromApi();
    await refreshAdminCategoriesFromApi();
    await refreshAdminProductsFromApi();
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const values = Object.fromEntries(new FormData(adminLoginForm).entries());
      const email = String(values.email || '').trim();
      const password = String(values.password || '').trim();

      if (!email || !password) {
        renderAdminAuthState('请先填写管理员邮箱和密码。');
        return;
      }

      try {
        renderAdminAuthState('正在登录管理员账号...');
        await loginAdmin(email, password);
        activePanel = 'orders';
        syncPanels();
        renderAdminAuthState('');
        await loadAdminDashboardFromApi();
      } catch (error) {
        console.error('管理员登录失败：', error);
        clearStoredAdminSession();
        resetAdminDashboardState();
        renderAdminAuthState(error.detail || error.message || '管理员登录失败');
      }
    });
  }

  if (adminLogoutButton) {
    adminLogoutButton.addEventListener('click', () => {
      clearStoredAdminSession();
      resetAdminDashboardState();
      renderAdminAuthState('已退出管理员账号，请重新登录。');
    });
  }

  if (operationLogFilter) {
    operationLogFilter.addEventListener('submit', (event) => {
      event.preventDefault();
      loadAdminOperationLogs(1);
    });
  }

  if (operationLogReset) {
    operationLogReset.addEventListener('click', () => {
      operationLogFilter?.reset();
      loadAdminOperationLogs(1);
    });
  }

  operationLogFirst?.addEventListener('click', () => loadAdminOperationLogs(1));
  operationLogPrev?.addEventListener('click', () => loadAdminOperationLogs(adminOperationLogState.page - 1));
  operationLogNext?.addEventListener('click', () => loadAdminOperationLogs(adminOperationLogState.page + 1));
  operationLogLast?.addEventListener('click', () => loadAdminOperationLogs(adminOperationLogState.pages));

  navButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      activePanel = button.dataset.adminNavTarget || 'orders';
      syncPanels();

      if (activePanel === "orders") {
        refreshAdminOrdersFromApi();
      }

      if (activePanel === "stats") {
        refreshAdminStatsFromApi();
      }

      if (activePanel === "products") {
        refreshAdminProductsFromApi();
      }

      if (activePanel === "categories") {
        refreshAdminCategoriesFromApi();
      }

      if (activePanel === "operation-logs") {
        if (!adminOperationLogState.optionsLoaded) {
          try {
            await loadAdminOperationLogOptions();
          } catch (error) {
            setFeedback(operationLogFeedback, error.detail || error.message || '加载操作日志筛选项失败', true);
          }
        }
        await loadAdminOperationLogs(adminOperationLogState.page);
      }
    });
  });

  let productPreviewUrls = [];

  function getAdminImageFileKey(file) {
    return [file.name, file.size, file.lastModified, file.type].join("::");
  }

  function renderAdminImageManagerPendingFiles() {
    const hasPendingFiles = adminImageManagerPendingFiles.length > 0;

    if (adminImageManagerPending) {
      adminImageManagerPending.hidden = !hasPendingFiles;
      adminImageManagerPending.innerHTML = hasPendingFiles
        ? adminImageManagerPendingFiles.map((item, index) => `
            <article class="admin-image-manager__pending-item">
              <img src="${escapeHtml(item.previewUrl)}" alt="待上传图片 ${index + 1}" />
              <div class="admin-image-manager__pending-meta">
                <strong title="${escapeHtml(item.file.name)}">${escapeHtml(item.file.name)}</strong>
                <span>${escapeHtml((item.file.size / 1024).toFixed(1))} KB</span>
              </div>
              <button
                class="ghost-button ghost-button--small ghost-button--danger"
                type="button"
                data-admin-image-pending-remove="${index}"
                aria-label="移除待上传图片 ${escapeHtml(item.file.name)}"
                ${adminImageManagerUploading ? "disabled" : ""}
              >
                移除
              </button>
            </article>
          `).join("")
        : "";
    }

    if (adminImageManagerClear) {
      adminImageManagerClear.disabled = !hasPendingFiles || adminImageManagerUploading;
    }

    if (adminImageManagerUpload) {
      adminImageManagerUpload.disabled = !hasPendingFiles || adminImageManagerUploading;
      adminImageManagerUpload.textContent = adminImageManagerUploading ? "上传中..." : "确认上传";
    }

    if (adminImageManagerInput) {
      adminImageManagerInput.disabled = adminImageManagerUploading;
    }

    adminImageManagerCloseButtons.forEach((button) => {
      button.disabled = adminImageManagerUploading;
    });
  }

  function addAdminImageManagerPendingFiles(files) {
    const knownKeys = new Set(adminImageManagerPendingFiles.map((item) => item.key));

    Array.from(files || []).forEach((file) => {
      const key = getAdminImageFileKey(file);
      if (knownKeys.has(key)) {
        return;
      }

      knownKeys.add(key);
      adminImageManagerPendingFiles.push({
        file,
        key,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (adminImageManagerInput) {
      adminImageManagerInput.value = "";
    }
    renderAdminImageManagerPendingFiles();
  }

  function clearAdminImageManagerPendingFiles() {
    adminImageManagerPendingFiles.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    adminImageManagerPendingFiles = [];
    if (adminImageManagerInput) {
      adminImageManagerInput.value = "";
    }
    renderAdminImageManagerPendingFiles();
  }

  function removeAdminImageManagerPendingFile(index) {
    const item = adminImageManagerPendingFiles[index];
    if (!item || adminImageManagerUploading) {
      return;
    }

    URL.revokeObjectURL(item.previewUrl);
    adminImageManagerPendingFiles.splice(index, 1);
    renderAdminImageManagerPendingFiles();
  }

  function closeAdminProductImageManager() {
    clearAdminImageManagerPendingFiles();
    if (adminImageManagerInput) {
      adminImageManagerInput.value = "";
    }
    if (adminImageManagerFeedback) {
      adminImageManagerFeedback.textContent = "";
      adminImageManagerFeedback.dataset.state = "";
    }
    activeAdminImageManagerProduct = null;
    if (adminImageManager) {
      adminImageManager.hidden = true;
      adminImageManager.classList.remove("is-open");
      adminImageManager.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("has-modal");
  }

  function renderAdminDescriptionEditorState() {
    if (!adminDescriptionEditor || !activeAdminDescriptionProduct) {
      return;
    }

    const currentValue = String(adminDescriptionEditorInput?.value || "");
    const normalizedValue = normalizeProductDescription(currentValue);
    const isOverLimit = currentValue.length > PRODUCT_DESCRIPTION_MAX_LENGTH;
    const hasChanged = normalizedValue !== adminDescriptionInitialValue;

    if (adminDescriptionEditorCount) {
      adminDescriptionEditorCount.textContent = `${currentValue.length} / ${PRODUCT_DESCRIPTION_MAX_LENGTH}`;
      adminDescriptionEditorCount.dataset.state = isOverLimit ? "error" : "";
    }

    if (adminDescriptionEditorInput) {
      adminDescriptionEditorInput.disabled = adminDescriptionSubmitting;
    }

    if (adminDescriptionEditorSave) {
      adminDescriptionEditorSave.disabled = adminDescriptionSubmitting || isOverLimit || !hasChanged;
      adminDescriptionEditorSave.textContent = adminDescriptionSubmitting ? "保存中..." : "保存介绍";
    }

    adminDescriptionEditorCloseButtons.forEach((button) => {
      button.disabled = adminDescriptionSubmitting;
    });
  }

  function closeAdminDescriptionEditor() {
    if (adminDescriptionSubmitting) {
      return;
    }

    activeAdminDescriptionProduct = null;
    adminDescriptionInitialValue = "";
    if (adminDescriptionEditorInput) {
      adminDescriptionEditorInput.value = "";
      adminDescriptionEditorInput.disabled = false;
    }
    if (adminDescriptionEditorFeedback) {
      adminDescriptionEditorFeedback.textContent = "";
      adminDescriptionEditorFeedback.dataset.state = "";
    }
    if (adminDescriptionEditor) {
      adminDescriptionEditor.hidden = true;
      adminDescriptionEditor.classList.remove("is-open");
      adminDescriptionEditor.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("has-modal");
  }

  function openAdminDescriptionEditor(product) {
    if (!adminDescriptionEditor || !adminDescriptionEditorInput) {
      return;
    }

    activeAdminDescriptionProduct = product;
    adminDescriptionInitialValue = normalizeProductDescription(product.description);
    adminDescriptionSubmitting = false;
    adminDescriptionEditorInput.value = adminDescriptionInitialValue;
    if (adminDescriptionEditorTitle) {
      adminDescriptionEditorTitle.textContent = `编辑“${product.name}”的介绍`;
    }
    if (adminDescriptionEditorSummary) {
      adminDescriptionEditorSummary.textContent = `商品 ID：${product.productId} · 留空并保存即可清空介绍`;
    }
    if (adminDescriptionEditorFeedback) {
      adminDescriptionEditorFeedback.textContent = adminDescriptionInitialValue ? "当前介绍已加载。" : "当前商品暂无介绍。";
      adminDescriptionEditorFeedback.dataset.state = "";
    }
    adminDescriptionEditor.hidden = false;
    adminDescriptionEditor.classList.add("is-open");
    adminDescriptionEditor.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-modal");
    renderAdminDescriptionEditorState();
    adminDescriptionEditorInput.focus();
  }

  async function submitAdminDescriptionEditor() {
    if (!activeAdminDescriptionProduct || adminDescriptionSubmitting) {
      return;
    }

    const productId = Number(activeAdminDescriptionProduct.productId);
    const currentValue = String(adminDescriptionEditorInput?.value || "");
    if (currentValue.length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
      setFeedback(adminDescriptionEditorFeedback, "商品介绍不能超过 1000 个字符。", true);
      renderAdminDescriptionEditorState();
      return;
    }

    const description = normalizeProductDescription(currentValue);
    if (description === adminDescriptionInitialValue) {
      return;
    }

    adminDescriptionSubmitting = true;
    renderAdminDescriptionEditorState();
    setFeedback(adminDescriptionEditorFeedback, "正在保存商品介绍...");

    try {
      const result = await updateAdminProductDescriptionToApi(productId, description);
      await refreshAdminProductsFromApi();
      activeAdminDescriptionProduct = products.find((item) => item.productId === productId) || {
        ...activeAdminDescriptionProduct,
        description: result.description || "",
      };
      adminDescriptionInitialValue = normalizeProductDescription(result.description);
      if (adminDescriptionEditorInput) {
        adminDescriptionEditorInput.value = adminDescriptionInitialValue;
      }
      setFeedback(adminDescriptionEditorFeedback, result.message || "商品介绍保存成功。");
      setFeedback(productManageFeedback || productFeedback, result.message || "商品介绍保存成功。");
    } catch (error) {
      console.error("后台修改商品介绍失败：", error);
      setFeedback(adminDescriptionEditorFeedback, error.message || "修改商品介绍失败", true);
    } finally {
      adminDescriptionSubmitting = false;
      renderAdminDescriptionEditorState();
    }
  }

  function renderAdminProductImageManager() {
    if (!adminImageManager || !activeAdminImageManagerProduct) {
      closeAdminProductImageManager();
      return;
    }

    const images = getAdminProductImages(activeAdminImageManagerProduct);
    const onlyOneImage = images.length <= 1;

    adminImageManager.hidden = false;
    adminImageManager.classList.add("is-open");
    adminImageManager.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-modal");

    if (adminImageManagerTitle) {
      adminImageManagerTitle.textContent = `管理“${activeAdminImageManagerProduct.name}”的图片`;
    }

    if (adminImageManagerSummary) {
      adminImageManagerSummary.textContent = `商品 ID：${activeAdminImageManagerProduct.productId} · 当前共 ${images.length} 张有效图片${onlyOneImage ? "，至少保留一张图片" : ""}`;
    }

    if (adminImageManagerList) {
      adminImageManagerList.innerHTML = images.length ? images.map((image, index) => {
        const imageId = Number(image.id);
        const hasRealImageId = Number.isInteger(imageId) && imageId > 0;
        const isMain = Number(image.is_main || 0) === 1;
        const deleteDisabled = onlyOneImage || !hasRealImageId;
        const hint = !hasRealImageId
          ? "兼容主图暂不能直接删除"
          : onlyOneImage
            ? "至少保留一张图片"
            : "删除后不可在页面中继续使用该图片";

        return `
          <article class="admin-image-manager__item">
            <div class="admin-image-manager__visual">
              <img src="${escapeHtml(getAdminImageSrc(image.image_url))}" alt="${escapeHtml(activeAdminImageManagerProduct.name)} 图片 ${index + 1}" loading="lazy" decoding="async" />
              ${isMain ? '<span class="admin-image-manager__badge">主图</span>' : ""}
            </div>
            <div class="admin-image-manager__item-meta">
              <span>图片 ID：${hasRealImageId ? escapeHtml(imageId) : "兼容图片"}</span>
              <small>${escapeHtml(hint)}</small>
              <button
                type="button"
                class="ghost-button ghost-button--small ghost-button--danger"
                data-admin-image-delete-id="${hasRealImageId ? imageId : ""}"
                data-admin-image-delete-product-id="${activeAdminImageManagerProduct.productId}"
                data-admin-image-delete-main="${isMain ? "1" : "0"}"
                ${deleteDisabled ? "disabled" : ""}
              >
                删除图片
              </button>
            </div>
          </article>
        `;
      }).join("") : '<p class="admin-image-manager__empty">当前商品暂无有效图片，可以在下方选择并上传新图片。</p>';
    }

    renderAdminImageManagerPendingFiles();
  }

  async function submitAdminImageManagerUpload() {
    if (!activeAdminImageManagerProduct || !adminImageManagerPendingFiles.length || adminImageManagerUploading) {
      return;
    }

    const productId = activeAdminImageManagerProduct.productId;
    const imageFiles = adminImageManagerPendingFiles.map((item) => item.file);

    try {
      adminImageManagerUploading = true;
      adminImageManagerUpload.disabled = true;
      renderAdminImageManagerPendingFiles();
      setFeedback(adminImageManagerFeedback, "上传中...");

      const result = await appendAdminProductImagesToApi(productId, imageFiles);
      clearAdminImageManagerPendingFiles();

      if (activeAdminImageManagerProduct?.productId === productId) {
        activeAdminImageManagerProduct = {
          ...activeAdminImageManagerProduct,
          image: result.image_url,
          image_url: result.image_url,
          images: result.images,
          imageCount: result.image_count,
          image_count: result.image_count,
        };
        renderAdminProductImageManager();
      }

      await refreshAdminProductsFromApi();

      if (activeAdminImageManagerProduct?.productId === productId) {
        activeAdminImageManagerProduct = products.find((product) => product.productId === productId) || activeAdminImageManagerProduct;
        renderAdminProductImageManager();
        setFeedback(adminImageManagerFeedback, result.message || "商品图片追加成功");
      }
      setFeedback(productManageFeedback || productFeedback, result.message || "商品图片追加成功");
    } catch (error) {
      console.error("后台追加商品图片失败：", error);
      if (activeAdminImageManagerProduct?.productId === productId) {
        setFeedback(adminImageManagerFeedback, `追加图片失败：${error.message}`, true);
      }
    } finally {
      adminImageManagerUploading = false;
      renderAdminImageManagerPendingFiles();
    }
  }

  function renderProductImagePreview() {
    productPreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    productPreviewUrls = [];

    if (!productImagePreview) {
      return;
    }

    const files = Array.from(productImageInput?.files || []);
    if (!files.length) {
      productImagePreview.hidden = true;
      productImagePreview.innerHTML = "";
      return;
    }

    productPreviewUrls = files.slice(0, 4).map((file) => URL.createObjectURL(file));
    productImagePreview.hidden = false;
    productImagePreview.innerHTML = `
      <p class="admin-image-preview__note">第 1 张将作为主图，共选择 ${escapeHtml(files.length)} 张</p>
      <div class="admin-image-preview__grid">
        ${productPreviewUrls.map((url, index) => `<img src="${escapeHtml(url)}" alt="本地图片 ${index + 1}" />`).join("")}
      </div>
    `;
  }

  if (productImageInput) {
    productImageInput.addEventListener("change", renderProductImagePreview);
  }

  [adminSkuColorsInput, adminSkuSizesInput].forEach((input) => {
    input?.addEventListener('input', rebuildAdminSkuMatrix);
  });
  adminSkuBasePriceInput?.addEventListener('change', rebuildAdminSkuMatrix);
  adminSkuMatrix?.addEventListener('input', updateAdminSkuMatrixValue);
  adminSkuMatrix?.addEventListener('change', updateAdminSkuMatrixValue);

  adminImageManagerCloseButtons.forEach((button) => {
    button.addEventListener("click", closeAdminProductImageManager);
  });

  adminImageManagerInput?.addEventListener("change", (event) => {
    addAdminImageManagerPendingFiles(event.target.files);
  });

  adminImageManagerPending?.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-admin-image-pending-remove]");
    if (!removeButton) {
      return;
    }
    removeAdminImageManagerPendingFile(Number(removeButton.dataset.adminImagePendingRemove));
  });

  adminImageManagerClear?.addEventListener("click", clearAdminImageManagerPendingFiles);
  adminImageManagerUpload?.addEventListener("click", submitAdminImageManagerUpload);
  window.addEventListener("beforeunload", clearAdminImageManagerPendingFiles);

  adminDescriptionEditorCloseButtons.forEach((button) => {
    button.addEventListener("click", closeAdminDescriptionEditor);
  });
  adminDescriptionEditorInput?.addEventListener("input", renderAdminDescriptionEditorState);
  adminDescriptionEditorSave?.addEventListener("click", submitAdminDescriptionEditor);

  adminSkuManagerCloseButtons.forEach((button) => {
    button.addEventListener('click', closeAdminSkuManager);
  });

  adminSkuAddGenerate?.addEventListener('click', () => {
    if (!activeAdminSkuManagerProduct) return;
    adminSkuManagerDraftRows = getMissingSkuCombinations(
      adminSkuManagerRows.filter((row) => Number(row.skuIsDeleted) !== 1),
      adminSkuAddColors?.value || '',
      adminSkuAddSizes?.value || '',
      {
        productName: activeAdminSkuManagerProduct.name,
        price: Number(adminSkuAddPrice?.value || activeAdminSkuManagerProduct.price || 0),
        stock: 0,
        onSale: 1,
      },
    );
    renderAdminSkuDrafts();
    setFeedback(
      adminSkuManagerFeedback,
      adminSkuManagerDraftRows.length ? `已生成 ${adminSkuManagerDraftRows.length} 个缺失组合。` : '没有需要新增的组合。',
    );
  });

  function updateAdminSkuDraft(event) {
    const draftElement = event.target.closest('[data-admin-sku-draft-index]');
    const index = Number(draftElement?.dataset.adminSkuDraftIndex);
    const row = Number.isInteger(index) ? adminSkuManagerDraftRows[index] : null;
    if (!row) return;
    if (event.target.matches('[data-admin-sku-draft-code]')) row.sku_code = event.target.value;
    if (event.target.matches('[data-admin-sku-draft-price]')) row.price = Number(event.target.value);
    if (event.target.matches('[data-admin-sku-draft-stock]')) row.stock = Number(event.target.value);
    if (event.target.matches('[data-admin-sku-draft-on-sale]')) row.on_sale = Number(event.target.value) === 0 ? 0 : 1;
  }
  adminSkuAddDrafts?.addEventListener('input', updateAdminSkuDraft);
  adminSkuAddDrafts?.addEventListener('change', updateAdminSkuDraft);

  adminSkuAddSubmit?.addEventListener('click', async () => {
    if (!activeAdminSkuManagerProduct || skuManagerSubmitting) return;
    try {
      const skus = parseAdminSkuRows({ skuRows: adminSkuManagerDraftRows });
      skuManagerSubmitting = true;
      adminSkuAddSubmit.disabled = true;
      await createAdminProductSkusToApi(activeAdminSkuManagerProduct.productId, skus);
      adminSkuManagerRows = await loadAdminProductSkusToApi(activeAdminSkuManagerProduct.productId);
      adminSkuManagerDraftRows = [];
      renderAdminSkuManager();
      await refreshAdminProductsFromApi();
      setFeedback(adminSkuManagerFeedback, '新增 SKU 组合成功。');
    } catch (error) {
      setFeedback(adminSkuManagerFeedback, error.message, true);
    } finally {
      skuManagerSubmitting = false;
      if (adminSkuAddSubmit) adminSkuAddSubmit.disabled = false;
    }
  });

  adminSkuManagerList?.addEventListener('click', async (event) => {
    const saveButton = event.target.closest('[data-admin-sku-save-id]');
    const deleteButton = event.target.closest('[data-admin-sku-delete-id]');
    if ((!saveButton && !deleteButton) || !activeAdminSkuManagerProduct || skuManagerSubmitting) return;

    const skuId = Number((saveButton || deleteButton).dataset.adminSkuSaveId || (saveButton || deleteButton).dataset.adminSkuDeleteId);
    const rowElement = adminSkuManagerList.querySelector(`[data-admin-sku-edit-row="${skuId}"]`);
    if (!rowElement || !Number.isInteger(skuId) || skuId <= 0) return;

    try {
      skuManagerSubmitting = true;
      if (saveButton) {
        saveButton.disabled = true;
        const [sku] = parseAdminSkuRows({ skuRows: [{
          sku_code: rowElement.querySelector('[data-admin-sku-edit-code]')?.value,
          sku_name: rowElement.querySelector('[data-admin-sku-edit-name]')?.value,
          color: rowElement.querySelector('[data-admin-sku-edit-color]')?.value,
          size: rowElement.querySelector('[data-admin-sku-edit-size]')?.value,
          price: Number(rowElement.querySelector('[data-admin-sku-edit-price]')?.value),
          stock: Number(rowElement.querySelector('[data-admin-sku-edit-stock]')?.value),
          on_sale: Number(rowElement.querySelector('[data-admin-sku-edit-on-sale]')?.value),
        }] });
        await updateAdminProductSkuToApi(activeAdminSkuManagerProduct.productId, skuId, sku);
        setFeedback(adminSkuManagerFeedback, `SKU ${skuId} 修改成功。`);
      } else {
        const confirmed = window.confirm(`确定逻辑删除 SKU ${skuId} 吗？历史订单不会被删除。`);
        if (!confirmed) return;
        deleteButton.disabled = true;
        await deleteAdminProductSkuToApi(activeAdminSkuManagerProduct.productId, skuId);
        setFeedback(adminSkuManagerFeedback, `SKU ${skuId} 已逻辑删除。`);
      }

      adminSkuManagerRows = await loadAdminProductSkusToApi(activeAdminSkuManagerProduct.productId);
      renderAdminSkuManager();
      await refreshAdminProductsFromApi();
    } catch (error) {
      setFeedback(adminSkuManagerFeedback, error.message, true);
    } finally {
      skuManagerSubmitting = false;
      if (saveButton) saveButton.disabled = false;
      if (deleteButton) deleteButton.disabled = false;
    }
  });

  if (adminImageManagerList) {
    adminImageManagerList.addEventListener("click", async (event) => {
      const deleteButton = event.target.closest("[data-admin-image-delete-id]");
      if (!deleteButton || deleteButton.disabled || !activeAdminImageManagerProduct) {
        return;
      }

      const productId = Number(deleteButton.dataset.adminImageDeleteProductId);
      const imageId = Number(deleteButton.dataset.adminImageDeleteId);
      const isMain = deleteButton.dataset.adminImageDeleteMain === "1";

      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
        setFeedback(adminImageManagerFeedback, "图片 ID 不正确，无法删除。", true);
        return;
      }

      const mainImageNote = isMain
        ? "这是当前主图，删除后系统会自动选择下一张图片作为主图。"
        : "这不是当前主图，删除后原主图保持不变。";
      const confirmed = window.confirm(
        `确定删除“${activeAdminImageManagerProduct.name}”的这张图片吗？\n${mainImageNote}\n删除后不可在页面中继续使用该图片。`
      );

      if (!confirmed) {
        return;
      }

      try {
        deleteButton.disabled = true;
        deleteButton.textContent = "删除中...";
        const result = await deleteAdminProductImageToApi(productId, imageId);

        activeAdminImageManagerProduct = {
          ...activeAdminImageManagerProduct,
          image: result.image_url,
          image_url: result.image_url,
          images: result.images,
          imageCount: result.image_count,
          image_count: result.image_count,
        };
        renderAdminProductImageManager();
        setFeedback(adminImageManagerFeedback, result.message || "商品图片删除成功");
        setFeedback(productManageFeedback || productFeedback, result.message || "商品图片删除成功");

        await refreshAdminProductsFromApi();
        activeAdminImageManagerProduct = products.find((product) => product.productId === productId) || activeAdminImageManagerProduct;
        renderAdminProductImageManager();
        setFeedback(adminImageManagerFeedback, result.message || "商品图片删除成功");
      } catch (error) {
        console.error("后台删除商品图片失败：", error);
        deleteButton.disabled = false;
        deleteButton.textContent = "删除图片";
        setFeedback(adminImageManagerFeedback, error.message || "删除商品图片失败", true);
      }
    });
  }

  if (productForm) {
    productForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const values = Object.fromEntries(new FormData(productForm).entries());
      const imageFiles = Array.from(productImageInput?.files || []);
      const name = String(values.name || '').trim();
      const categoryId = Number(values.category_id);
      const description = normalizeProductDescription(values.description);

      if (String(values.description || "").length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
        setFeedback(productFeedback, '商品介绍不能超过 1000 个字符。', true);
        return;
      }

      let skuRows = [];

      try {
        rebuildAdminSkuMatrix();
        skuRows = parseAdminSkuRows({ skuRows: adminSkuRows });
      } catch (error) {
        setFeedback(productFeedback, error.message, true);
        return;
      }

      if (!name || !Number.isInteger(categoryId) || categoryId <= 0) {
        setFeedback(productFeedback, '请完整填写商品名称并选择已有分类。', true);
        return;
      }

      try {
        if (productSubmitButton?.disabled) {
          return;
        }
        if (productSubmitButton) {
          productSubmitButton.disabled = true;
          productSubmitButton.textContent = "上架中...";
        }
        setFeedback(productFeedback, '正在写入数据库，请稍候...');

      const result = await createAdminProductToApi(
        {
          ...values,
          name,
          categoryId,
          description,
          skuRows,
        },
        imageFiles
      );

        setFeedback(
          productFeedback,
          `商品已写入数据库！商品ID：${result.product_id}，SKU 数量：${result.sku_count || 1}`
        );

        productForm.reset();
        adminSkuRows = [];
        renderAdminSkuMatrix();
        renderProductImagePreview();

        if (imageSelect?.options.length) {
          imageSelect.selectedIndex = 0;
        }

      await refreshAdminProductsFromApi();
      await refreshAdminCategoriesFromApi();
      syncPanels();
      } catch (error) {
        console.error("后台新增商品失败：", error);
        setFeedback(productFeedback, `新增商品失败：${error.message}`, true);
      } finally {
        if (productSubmitButton) {
          productSubmitButton.disabled = getActiveAdminCategories().length === 0;
          productSubmitButton.textContent = "上架新品";
        }
      }
    });
  }

  categoryForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const name = String(categoryNameInput?.value || '').trim();
    const sortOrder = Number(categorySortOrderInput?.value);
    const submitButton = categoryForm.querySelector('button[type="submit"]');
    if (!name || name === '全部' || name.length > 80) {
      setFeedback(categoryFeedback, name === '全部' ? '分类名称不能使用“全部”。' : '分类名称不能为空且最多 80 个字符。', true);
      return;
    }
    if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) {
      setFeedback(categoryFeedback, '排序值必须是 0 到 9999 的整数。', true);
      return;
    }
    try {
      submitButton.disabled = true;
      submitButton.textContent = '新增中...';
      const result = await createAdminCategoryToApi(name, sortOrder);
      setFeedback(categoryFeedback, result.restored ? '同名已删除分类已恢复。' : '分类新增成功。');
      categoryForm.reset();
      if (categorySortOrderInput) categorySortOrderInput.value = '0';
      await refreshAdminCategoriesFromApi();
      await refreshAdminProductsFromApi();
    } catch (error) {
      setFeedback(categoryFeedback, error.message, true);
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = '新增分类';
    }
  });

  categoryFilter?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-admin-category-filter-value]');
    if (!button) return;
    activeAdminCategoryFilter = button.dataset.adminCategoryFilterValue || 'ALL';
    renderAdminCategories();
  });

  categoryList?.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-admin-category-save], [data-admin-category-delete], [data-admin-category-restore]');
    if (!button || button.disabled) return;
    const categoryId = Number(button.dataset.adminCategorySave || button.dataset.adminCategoryDelete || button.dataset.adminCategoryRestore);
    const row = categoryList.querySelector(`[data-admin-category-row="${categoryId}"]`);
    if (!Number.isInteger(categoryId) || categoryId <= 0 || !row || pendingAdminCategoryIds.has(categoryId)) return;
    try {
      pendingAdminCategoryIds.add(categoryId);
      button.disabled = true;
      if (button.matches('[data-admin-category-save]')) {
        const name = String(row.querySelector('[data-admin-category-edit-name]')?.value || '').trim();
        const sortOrder = Number(row.querySelector('[data-admin-category-edit-sort]')?.value);
        await updateAdminCategoryToApi(categoryId, name, sortOrder);
        setFeedback(categoryFeedback, `分类 ${categoryId} 已保存。`);
      } else if (button.matches('[data-admin-category-delete]')) {
        if (!window.confirm('确定逻辑删除这个空分类吗？')) return;
        await deleteAdminCategoryToApi(categoryId);
        setFeedback(categoryFeedback, `分类 ${categoryId} 已删除。`);
      } else {
        await restoreAdminCategoryToApi(categoryId);
        setFeedback(categoryFeedback, `分类 ${categoryId} 已恢复。`);
      }
      await refreshAdminCategoriesFromApi();
      await refreshAdminProductsFromApi();
    } catch (error) {
      setFeedback(categoryFeedback, error.message, true);
    } finally {
      pendingAdminCategoryIds.delete(categoryId);
      renderAdminCategories();
    }
  });

  if (productFilterBar) {
    productFilterBar.addEventListener("click", (event) => {
      const filterButton = event.target.closest("[data-admin-product-filter]");

      if (!filterButton) {
        return;
      }

      const nextFilter = String(filterButton.dataset.adminProductFilter || "ALL").trim().toUpperCase();

      if (!adminProductFilters.some((filter) => filter.value === nextFilter)) {
        return;
      }

      activeAdminProductFilter = nextFilter;
      renderProducts();
    });
  }

  if (adminProductSearchInput) {
    adminProductSearchInput.addEventListener("input", (event) => {
      activeAdminProductSearchKeyword = String(event.target.value || "");
      updateAdminProductSearchClearState();
      renderProducts();
    });
  }

  if (adminProductSearchClear) {
    adminProductSearchClear.addEventListener("click", () => {
      activeAdminProductSearchKeyword = "";

      if (adminProductSearchInput) {
        adminProductSearchInput.value = "";
      }

      updateAdminProductSearchClearState();
      renderProducts();
      adminProductSearchInput?.focus();
    });
  }

  if (ordersBody) {
    ordersBody.addEventListener("click", async (event) => {
      const detailButton = event.target.closest("[data-admin-order-detail-id]");
      const approveRefundButton = event.target.closest("[data-admin-order-refund-approve-id]");
      const rejectRefundButton = event.target.closest("[data-admin-order-refund-reject-id]");
      const shipButton = event.target.closest("[data-admin-order-ship-id]");
      const unshipButton = event.target.closest("[data-admin-order-unship-id]");

      if (detailButton) {
        const orderId = Number(detailButton.dataset.adminOrderDetailId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        if (activeAdminOrderDetailId === orderId) {
          collapseAdminOrderDetail(orderId);
          renderAdminOrders(orders);
          return;
        }

        activeAdminOrderDetailId = orderId;
        renderAdminOrders(orders);
        await renderAdminOrderDetail(orderId);
        return;
      }

      if (approveRefundButton) {
        const orderId = Number(approveRefundButton.dataset.adminOrderRefundApproveId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        const confirmed = window.confirm("确定要同意这个退款申请吗？同意后会恢复库存并回滚销量。");

        if (!confirmed) {
          return;
        }

        try {
          approveRefundButton.disabled = true;
          approveRefundButton.textContent = "处理中...";

          await approveAdminRefundToApi(orderId, "管理员同意退款");
          await refreshAdminOrdersFromApi();
          setFeedback(orderFeedback, "退款已同意");
        } catch (error) {
          console.error("同意退款失败：", error);

          const container = getAdminOrderDetailContainer(orderId);

          if (container) {
            container.innerHTML = `<p class="order-detail__empty">同意退款失败：${escapeHtml(error.message)}</p>`;
          }

          setFeedback(orderFeedback, `同意退款失败：${error.message}`, true);
        }

        return;
      }

      if (rejectRefundButton) {
        const orderId = Number(rejectRefundButton.dataset.adminOrderRefundRejectId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        const confirmed = window.confirm("确定要拒绝这个退款申请吗？拒绝后订单会回到退款前状态。");

        if (!confirmed) {
          return;
        }

        try {
          rejectRefundButton.disabled = true;
          rejectRefundButton.textContent = "处理中...";

          await rejectAdminRefundToApi(orderId, "管理员拒绝退款");
          await refreshAdminOrdersFromApi();
          setFeedback(orderFeedback, "已拒绝退款申请");
        } catch (error) {
          console.error("拒绝退款失败：", error);

          const container = getAdminOrderDetailContainer(orderId);

          if (container) {
            container.innerHTML = `<p class="order-detail__empty">拒绝退款失败：${escapeHtml(error.message)}</p>`;
          }

          setFeedback(orderFeedback, `拒绝退款失败：${error.message}`, true);
        }

        return;
      }

      if (shipButton) {
        const orderId = Number(shipButton.dataset.adminOrderShipId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        const confirmed = window.confirm("确定要给这个已支付订单发货吗？发货后状态会变为已发货。");

        if (!confirmed) {
          return;
        }

        try {
          shipButton.disabled = true;
          shipButton.textContent = "发货中...";

          await shipAdminOrderToApi(orderId, "管理员后台发货");
          await refreshAdminOrdersFromApi();
          setFeedback(orderFeedback, "发货成功");
        } catch (error) {
          console.error("后台发货失败：", error);

          const container = getAdminOrderDetailContainer(orderId);

          if (container) {
            container.innerHTML = `<p class="order-detail__empty">发货失败：${escapeHtml(error.message)}</p>`;
          }

          setFeedback(orderFeedback, `发货失败：${error.message}`, true);
        }

        return;
      }

      if (unshipButton) {
        const orderId = Number(unshipButton.dataset.adminOrderUnshipId);

        if (!Number.isInteger(orderId) || orderId <= 0) {
          return;
        }

        const confirmed = window.confirm("确定要取消这个已发货订单的发货状态吗？");

        if (!confirmed) {
          return;
        }

        try {
          unshipButton.disabled = true;
          unshipButton.textContent = "取消中...";

          await unshipAdminOrderToApi(orderId, "管理员后台取消发货");
          await refreshAdminOrdersFromApi();
          setFeedback(orderFeedback, "取消发货成功");
        } catch (error) {
          console.error("后台取消发货失败：", error);

          const container = getAdminOrderDetailContainer(orderId);

          if (container) {
            container.innerHTML = `<p class="order-detail__empty">取消发货失败：${escapeHtml(error.message)}</p>`;
          }

          setFeedback(orderFeedback, `取消发货失败：${error.message}`, true);
        }
      }
    });
  }

  if (productList) {
  productList.addEventListener('change', (event) => {
    const select = event.target.closest('[data-admin-product-category-select]');
    if (!select) return;
    const productId = Number(select.dataset.adminProductCategorySelect);
    const button = productList.querySelector(`[data-admin-product-category-save="${productId}"]`);
    if (button) button.disabled = Number(select.value) === Number(select.dataset.adminProductCategoryOriginal);
  });

  productList.addEventListener("click", async (event) => {
    const categorySaveButton = event.target.closest('[data-admin-product-category-save]');
    const stockButton = event.target.closest("[data-admin-stock-save]");
    const statusButton = event.target.closest("[data-admin-product-status-id]");
    const deleteButton = event.target.closest("[data-admin-product-delete-id]");
    const manageImagesButton = event.target.closest("[data-admin-product-image-manage]");
    const manageSkusButton = event.target.closest("[data-admin-product-sku-manage]");
    const editDescriptionButton = event.target.closest("[data-admin-product-description-edit]");

    if (categorySaveButton) {
      const productId = Number(categorySaveButton.dataset.adminProductCategorySave);
      const select = productList.querySelector(`[data-admin-product-category-select="${productId}"]`);
      const categoryId = Number(select?.value);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(categoryId) || categoryId <= 0) return;
      try {
        categorySaveButton.disabled = true;
        categorySaveButton.textContent = '保存中...';
        await updateAdminProductCategoryToApi(productId, categoryId);
        setFeedback(productManageFeedback || productFeedback, `商品 ${productId} 分类修改成功。`);
        await refreshAdminProductsFromApi();
        await refreshAdminCategoriesFromApi();
      } catch (error) {
        setFeedback(productManageFeedback || productFeedback, `修改商品分类失败：${error.message}`, true);
        await refreshAdminProductsFromApi();
      }
      return;
    }

    if (editDescriptionButton) {
      const productId = Number(editDescriptionButton.dataset.adminProductDescriptionEdit);
      const product = products.find((item) => item.productId === productId);
      if (!product) {
        setFeedback(productManageFeedback || productFeedback, "商品数据不存在，无法编辑介绍。", true);
        return;
      }
      openAdminDescriptionEditor(product);
      return;
    }

    if (manageSkusButton) {
      const productId = Number(manageSkusButton.dataset.adminProductSkuManage);
      const product = products.find((item) => item.productId === productId);
      if (!product) {
        setFeedback(productManageFeedback || productFeedback, "商品数据不存在，无法管理规格。", true);
        return;
      }
      await openAdminSkuManager(product);
      return;
    }

    if (manageImagesButton) {
      const productId = Number(manageImagesButton.dataset.adminProductImageManage);
      clearAdminImageManagerPendingFiles();
      activeAdminImageManagerProduct = products.find((product) => product.productId === productId) || null;

      if (!activeAdminImageManagerProduct) {
        setFeedback(productManageFeedback || productFeedback, "商品数据不存在，无法管理图片。", true);
        return;
      }

      if (adminImageManagerFeedback) {
        adminImageManagerFeedback.textContent = "";
        adminImageManagerFeedback.dataset.state = "";
      }
      renderAdminProductImageManager();
      return;
    }

    if (stockButton) {
      const skuId = Number(stockButton.dataset.adminStockSave);
      const input = productList.querySelector(`[data-admin-stock-input="${skuId}"]`);
      const nextStock = Number(input?.value);

      if (!Number.isInteger(nextStock) || nextStock < 0) {
        setFeedback(productManageFeedback || productFeedback, "库存必须是大于等于 0 的整数。", true);
        return;
      }

      try {
        stockButton.disabled = true;
        stockButton.textContent = "更新中...";

        await updateAdminSkuStockToApi(skuId, nextStock);
        setFeedback(productFeedback, `SKU ${skuId} 库存已更新为 ${nextStock}。`);

        await refreshAdminProductsFromApi();
      } catch (error) {
        console.error("后台修改库存失败：", error);
        setFeedback(productFeedback, `修改库存失败：${error.message}`, true);
      }

      return;
    }

    if (deleteButton) {
      const productId = Number(deleteButton.dataset.adminProductDeleteId);

      if (!Number.isInteger(productId) || productId <= 0) {
        setFeedback(productManageFeedback || productFeedback, "商品 ID 不正确，无法删除。", true);
        return;
      }

      const confirmed = window.confirm("确定要删除这个商品吗？删除后前台和后台默认商品列表将不再显示，但历史订单数据不会被物理删除。");

      if (!confirmed) {
        return;
      }

      try {
        deleteButton.disabled = true;
        deleteButton.textContent = "删除中...";

        await deleteAdminProductToApi(productId);
        setFeedback(productManageFeedback || productFeedback, `商品 ${productId} 已删除。`);

        await refreshAdminProductsFromApi();
      } catch (error) {
        console.error("后台删除商品失败：", error);
        setFeedback(productManageFeedback || productFeedback, `删除商品失败：${error.message}`, true);
      }

      return;
    }

    if (statusButton) {
      const productId = Number(statusButton.dataset.adminProductStatusId);
      const nextStatus = statusButton.dataset.adminProductNextStatus;

      if (!Number.isInteger(productId) || productId <= 0) {
        setFeedback(productFeedback, "商品 ID 不正确，无法修改状态。", true);
        return;
      }

      if (!["ON_SALE", "OFF_SALE"].includes(nextStatus)) {
        setFeedback(productFeedback, "商品状态不正确，无法修改。", true);
        return;
      }

      const actionText = nextStatus === "ON_SALE" ? "重新上架" : "下架";
      const confirmed = window.confirm(`确定要${actionText}这个商品吗？`);

      if (!confirmed) {
        return;
      }

      try {
        statusButton.disabled = true;
        statusButton.textContent = "处理中...";

        await updateAdminProductStatusToApi(productId, nextStatus);
        setFeedback(productFeedback, `商品 ${productId} 已${actionText}。`);

        await refreshAdminProductsFromApi();
      } catch (error) {
        console.error("后台修改商品状态失败：", error);
        setFeedback(productFeedback, `修改商品状态失败：${error.message}`, true);
      }
    }
  });
}

  syncPanels();
  renderAdminAuthState();

  const hasAdminSession = requireAdminSessionBeforeLoading();

  if (hasAdminSession) {
    loadAdminDashboardFromApi();
  } else {
    resetAdminDashboardState();
    renderAdminAuthState('请先登录管理员账号');
  }
}

initScrollTools();

if (isAdminPage) {
  initAdminPage();
} else {
sidebarNavButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openSidebar(button.dataset.sidebarTarget);
  });
});

if (ordersList) {
  ordersList.addEventListener("click", (event) => {
    const filterButton = event.target.closest("[data-order-status-filter]");
    if (filterButton) {
      activeOrderStatusFilter = filterButton.dataset.orderStatusFilter || 'ALL';
      refreshOrdersFromApi();
      return;
    }

    const cancelButton = event.target.closest("[data-order-cancel-id]");
    if (cancelButton) {
      const orderId = Number(cancelButton.dataset.orderCancelId);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return;
      }

      handleCancelOrder(orderId);
      return;
    }

    const refundButton = event.target.closest("[data-order-refund-id]");
    if (refundButton) {
      const orderId = Number(refundButton.dataset.orderRefundId);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return;
      }

      handleRefundOrder(orderId);
      return;
    }

    const payButton = event.target.closest("[data-order-pay-id]");
    if (payButton) {
      const orderId = Number(payButton.dataset.orderPayId);

      if (!Number.isInteger(orderId) || orderId <= 0) {
        return;
      }

      handlePayPendingOrder(orderId);
      return;
    }

    const detailButton = event.target.closest("[data-order-detail-id]");
    if (!detailButton) {
      return;
    }

    const orderId = Number(detailButton.dataset.orderDetailId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return;
    }

    showOrderDetail(orderId);
  });
}

if (favoritesList) {
  favoritesList.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-favorite-remove-id]');
    const detailsButton = event.target.closest('[data-favorite-details-product-id]');

    if (removeButton) {
      removeFavorite(removeButton.dataset.favoriteRemoveId);
      return;
    }

    if (detailsButton && !detailsButton.disabled) {
      const product = productsById.get(detailsButton.dataset.favoriteDetailsProductId);
      if (!product) {
        setFeedback(sidebarFavoritesFeedback, '商品已不可用，无法查看实时详情。', true);
        return;
      }

      void openPurchaseModal(product, 'details').catch((error) => {
        console.error('打开收藏商品详情失败：', error);
      });
    }
  });

  favoritesList.addEventListener('error', (event) => {
    const image = event.target.closest?.('[data-favorite-image]');
    if (!image) {
      return;
    }

    image.hidden = true;
    image.closest('.favorite-card__visual')?.classList.add('is-image-missing');
  }, true);
}

if (cartList) {
  cartList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-cart-delete-id]');
    if (deleteButton) {
      deleteCartItemFromApi(deleteButton.dataset.cartDeleteId);
      return;
    }

    const selectButton = event.target.closest('[data-cart-select-id]');
    if (selectButton) {
      toggleCartSelection(selectButton.dataset.cartSelectId);
      renderSidebar();
      return;
    }

    const quantityStep = event.target.closest('[data-cart-quantity-step]');
    if (!quantityStep) {
      return;
    }

    const itemId = quantityStep.dataset.cartItemId;
    const delta = Number(quantityStep.dataset.cartQuantityStep || 0);

    if (!itemId || !delta) {
      return;
    }

    updateCartQuantityToApi(itemId, delta);
  });
}

if (cartSummary) {
  cartSummary.addEventListener("click", (event) => {
    const manageAddressButton = event.target.closest('[data-cart-manage-address]');
    if (manageAddressButton) {
      openSidebar('address');
      return;
    }

    const selectAllButton = event.target.closest('[data-cart-select-all]');
    if (selectAllButton) {
      toggleAllCheckoutableCartItems();
      renderSidebar();
      return;
    }

    const addressButton = event.target.closest("[data-cart-address-id]");
    if (addressButton) {
      setCartAddress(addressButton.dataset.cartAddressId);
      return;
    }
    const paymentButton = event.target.closest("[data-cart-payment-method]");
    if (paymentButton) {
      setCartPaymentMethod(paymentButton.dataset.cartPaymentMethod);
      return;
    }

    const confirmPaymentButton = event.target.closest('[data-cart-confirm-payment]');
    if (confirmPaymentButton) {
      submitCreatedCartOrderPayment();
      return;
    }

    const payLaterButton = event.target.closest('[data-cart-pay-later]');
    if (payLaterButton) {
      deferCreatedCartOrderPayment();
      return;
    }

    const checkoutButton = event.target.closest("[data-cart-checkout]");
    if (!checkoutButton) {
      return;
    }

    submitCartCheckout();
  });

  cartSummary.addEventListener('input', (event) => {
    const remarkInput = event.target.closest('[data-cart-checkout-remark]');
    if (remarkInput) {
      cartCheckoutState.buyerRemark = String(remarkInput.value || '').slice(0, 500);
      const count = cartSummary.querySelector('[data-cart-checkout-remark-count]');
      if (count) {
        count.textContent = `${cartCheckoutState.buyerRemark.length} / 500`;
      }
      return;
    }

    const passwordInput = event.target.closest('[data-cart-pay-password]');
    if (passwordInput) {
      cartCheckoutState.payPassword = String(passwordInput.value || '').replace(/\D/g, '').slice(0, 6);
      if (passwordInput.value !== cartCheckoutState.payPassword) {
        passwordInput.value = cartCheckoutState.payPassword;
      }
    }
  });
}

if (authTabLogin && authTabRegister && loginForm && registerForm) {
  authTabLogin.addEventListener('click', () => {
    authTabLogin.classList.add('is-active');
    authTabRegister.classList.remove('is-active');
    loginForm.classList.remove('is-hidden');
    registerForm.classList.add('is-hidden');
  });

  authTabRegister.addEventListener('click', () => {
    authTabRegister.classList.add('is-active');
    authTabLogin.classList.remove('is-active');
    registerForm.classList.remove('is-hidden');
    loginForm.classList.add('is-hidden');
  });
}

authCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeAuthModal());
});

if (loginForm) {
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(loginForm);

    if (!values.email || !values.password) {
      setFeedback(authFeedback, '请先填写邮箱和密码。', true);
      return;
    }

    const addressBook = getStoredAddressBook(storage);
    saveStoredProfile(storage, {
      user: {
        email: String(values.email),
        displayName: getDisplayName(String(values.email)),
      },
      addresses: addressBook.addresses,
      defaultAddressId: addressBook.defaultAddressId,
      address: getPrimaryAddress(addressBook),
    });

    setFeedback(authFeedback, '登录信息已保存。');
    renderSidebar();
    closeAuthModal();
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(registerForm);
    const validation = validateRegistration(values);

    if (!validation.ok) {
      setFeedback(
        authFeedback,
        validation.error === 'password-mismatch' ? '两次输入的密码不一致。' : '请把注册信息填写完整。',
        true,
      );
      return;
    }

    const addressBook = getStoredAddressBook(storage);
    saveStoredProfile(storage, {
      user: {
        email: String(values.email),
        displayName: String(values.displayName || getDisplayName(String(values.email))),
      },
      addresses: addressBook.addresses,
      defaultAddressId: addressBook.defaultAddressId,
      address: getPrimaryAddress(addressBook),
    });

    setFeedback(authFeedback, '注册成功，账号信息已保存。');
    renderSidebar();
    closeAuthModal();
  });
}

if (menuOpenButton) {
  menuOpenButton.addEventListener('click', () => {
    openSidebar('account');
  });
}

menuCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closeSidebar());
});

purchaseCloseButtons.forEach((button) => {
  button.addEventListener('click', () => closePurchaseModal());
});

if (purchaseImage) {
  purchaseImage.addEventListener('click', (event) => openImageLightbox(event.currentTarget));
  purchaseImage.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openImageLightbox(event.currentTarget);
    }
  });
}

imageLightboxCloseButtons.forEach((button) => {
  button.addEventListener('click', closeImageLightbox);
});

if (imageLightboxPrev) {
  imageLightboxPrev.addEventListener('click', () => showImageLightboxStep(-1));
}

if (imageLightboxNext) {
  imageLightboxNext.addEventListener('click', () => showImageLightboxStep(1));
}

if (imageLightbox) {
  imageLightbox.addEventListener('click', (event) => {
    if (event.target === event.currentTarget) {
      closeImageLightbox();
    }
  });
}

if (purchaseModal) {
  purchaseModal.addEventListener('click', (event) => {
    const galleryButton = event.target.closest('[data-purchase-gallery-image]');
    const quantityDecrease = event.target.closest('[data-purchase-quantity-decrease]');
    const quantityIncrease = event.target.closest('[data-purchase-quantity-increase]');
    const addressButton = event.target.closest('[data-purchase-address-id]');
    const colorButton = event.target.closest('[data-purchase-color]');
    const sizeButton = event.target.closest('[data-purchase-size]');
    const skuButton = event.target.closest('[data-purchase-sku-id]');
    const paymentButton = event.target.closest('[data-purchase-payment-method]');
    const manageAddressButton = event.target.closest('[data-purchase-manage-address]');
    const submitButton = event.target.closest('[data-purchase-submit]');

    if (galleryButton) {
      if (galleryButton.dataset.purchaseGalleryImage === activePurchaseImageUrl) {
        openImageLightbox(galleryButton);
        return;
      }

      activePurchaseImageUrl = galleryButton.dataset.purchaseGalleryImage || '';
      renderPurchaseModal();
      return;
    }

    if (activePurchaseAction === 'details') {
      return;
    }
    if (quantityDecrease) {
      setPurchaseQuantity(activePurchaseQuantity - 1);
      return;
    }

    if (quantityIncrease) {
      setPurchaseQuantity(activePurchaseQuantity + 1);
      return;
    }

    if (colorButton && !colorButton.disabled) {
      setPurchaseDimension('color', colorButton.dataset.purchaseColor);
      return;
    }

    if (sizeButton && !sizeButton.disabled) {
      setPurchaseDimension('size', sizeButton.dataset.purchaseSize);
      return;
    }

    if (skuButton) {
      setPurchaseSku(skuButton.dataset.purchaseSkuId);
      return;
    }

    if (addressButton) {
      setPurchaseAddress(addressButton.dataset.purchaseAddressId);
      return;
    }

    if (paymentButton) {
      setPurchasePaymentMethod(paymentButton.dataset.purchasePaymentMethod);
      return;
    }

    if (manageAddressButton) {
      closePurchaseModal();
      openSidebar('address');
      return;
    }

    if (submitButton) {
      submitPurchaseOrder();
    }
  });
}

if (purchaseBuyerRemark) {
  purchaseBuyerRemark.addEventListener('input', (event) => {
    activePurchaseBuyerRemark = String(event.target.value || '').slice(0, 500);
    if (purchaseBuyerRemarkCount) {
      purchaseBuyerRemarkCount.textContent = `${activePurchaseBuyerRemark.length} / 500`;
    }
  });
}

if (sidebarAddressForm) {
  sidebarAddressForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const values = readFieldValues(sidebarAddressForm);
    const validation = validateAddress(values);

    if (!validation.ok) {
      setFeedback(sidebarAddressFeedback, '请把收件人、手机号和地址信息填写完整。', true);
      return;
    }

    try {
      setFeedback(sidebarAddressFeedback, '正在保存到数据库...');

      const result = await addAddressToApi(values);

      const newAddressId = result.address_id;

      activePurchaseAddressId = Number(newAddressId);
      cartCheckoutState.selectedAddressId = Number(newAddressId);

      sidebarAddressForm.reset();

      setFeedback(sidebarAddressFeedback, '收货地址已保存到数据库。');

      await loadAddressesFromApi(CURRENT_USER_ID);

      renderSidebar();
      renderPurchaseModal();
    } catch (error) {
      console.error("新增数据库地址失败：", error);
      setFeedback(sidebarAddressFeedback, `新增收货地址失败：${error.message}`, true);
    }
  });
}

if (sidebarAddressList) {
  sidebarAddressList.addEventListener('click', async (event) => {
    const defaultButton = event.target.closest('[data-db-address-default]');
    if (defaultButton) {
      const addressId = Number(defaultButton.dataset.dbAddressDefault);

      if (!Number.isInteger(addressId) || addressId <= 0) {
        return;
      }

      try {
        setFeedback(sidebarAddressFeedback, '正在设置默认地址...');

        await setDefaultAddressToApi(addressId);

        activePurchaseAddressId = addressId;
        cartCheckoutState.selectedAddressId = addressId;

        setFeedback(sidebarAddressFeedback, '默认地址已更新。');

        renderSidebar();
        renderPurchaseModal();
      } catch (error) {
        console.error("设置默认地址失败：", error);
        setFeedback(sidebarAddressFeedback, `设置默认地址失败：${error.message}`, true);
      }

      return;
    }

    const deleteButton = event.target.closest('[data-db-address-delete]');
    if (deleteButton) {
      const addressId = Number(deleteButton.dataset.dbAddressDelete);

      if (!Number.isInteger(addressId) || addressId <= 0) {
        return;
      }

      try {
        setFeedback(sidebarAddressFeedback, '正在删除地址...');

        const result = await deleteAddressFromApi(addressId);

        if (!result) {
          setFeedback(sidebarAddressFeedback, '已取消删除。');
          return;
        }

        setFeedback(sidebarAddressFeedback, '地址已删除。');

        renderSidebar();
        renderPurchaseModal();
      } catch (error) {
        console.error("删除地址失败：", error);
        setFeedback(sidebarAddressFeedback, `删除地址失败：${error.message}`, true);
      }
    }
  });
}

if (productGrid) {
  productGrid.addEventListener('click', (event) => {
    const actionButton = event.target.closest('button');
    if (!actionButton) {
      return;
    }

    const productCard = actionButton.closest('[data-product-id]');
    const productId = productCard?.dataset.productId;
    const product = getStoredProductById(productId);

    if (!product) {
      return;
    }

    if (actionButton.dataset.productSkuId) {
      setSelectedSku(product.id, actionButton.dataset.productSkuId);
      return;
    }

    if (actionButton.dataset.purchaseLaunch === 'buy') {
      void openPurchaseModal(product, 'buy').catch((error) => {
        console.error("立即购买打开失败：", error);
      });
      return;
    }

    if (actionButton.dataset.favoriteToggle !== undefined) {
      toggleFavorite(product);
      return;
    }

    if (actionButton.dataset.sidebarLaunch === 'cart') {
      void openPurchaseModal(product, 'cart').catch((error) => {
        console.error("打开购物车弹窗失败：", error);
      });
      return;
    }

    if (actionButton.dataset.sidebarLaunch === 'checkout') {
      void openPurchaseModal(product, 'buy').catch((error) => {
        console.error("打开结算弹窗失败：", error);
      });
    }
  });
}

if (primaryCta) {
  primaryCta.addEventListener('click', () => {
    document.querySelector('#products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

if (secondaryCta) {
  secondaryCta.addEventListener('click', () => {
    document.querySelector('#collections')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

window.addEventListener('keydown', (event) => {
  if (lightboxState.isOpen) {
    if (event.key === 'Tab') {
      trapImageLightboxFocus(event);
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeImageLightbox();
      return;
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showImageLightboxStep(-1);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      showImageLightboxStep(1);
      return;
    }
  }

  if (event.key === 'Escape') {
    if (purchaseModal?.classList.contains('is-open')) {
      closePurchaseModal();
      return;
    }

    closeAuthModal();
    closeSidebar();
  }
});

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

renderHero();
updateView();
renderSidebar();
updateHeroParallax();
updateHeroScrollState();
// testLoadProductsFromApi(); 测试函数，通过以后就可以不再使用。
void Promise.all([loadProductsFromApi(), loadCategoriesFromApi()])
  .then(() => syncCartFromApi(CURRENT_USER_ID))
  .catch((error) => {
    console.error('初始化数据库购物车失败，继续使用本地缓存：', error);
    refreshCommerceIndicators();
  });

window.addEventListener('scroll', scheduleHeroParallax, { passive: true });
window.addEventListener('resize', scheduleHeroParallax);

window.requestAnimationFrame(() => {
  setInitialScrollPosition();
  updateHeroParallax();
  updateHeroScrollState();
});
}
