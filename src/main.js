import { getAdminImageOptions, getCollections, getProducts, getSiteCopy } from './content.js?v=20260705a';
import { formatSalesRank, getSalesRankMap } from './ranking.js?v=20260705a';
import {
  buildPurchaseOrder,
  getCartItemTotal,
  getCartTotals,
  getProductSalesRows,
  getSalesSummary,
  addAdminProduct,
  getStoredAdminProducts,
  getStoredAddressBook,
  getStoredCart,
  getStoredCartSelections,
  getStoredFavorites,
  getStoredMockOrders,
  getStoredOrders,
  getStoredProfile,
  renderAdminOrdersView,
  renderAdminProductsView,
  renderAdminStatsView,
  renderOrderItems,
  renderSavedProductItems,
  saveStoredCart,
  saveStoredAdminProducts,
  saveStoredFavorites,
  saveStoredMockOrders,
  saveStoredOrders,
  saveStoredProfile,
  saveStoredAddressBook,
  saveStoredCartSelections,
  validateAddress,
  validateRegistration,
} from './account-store.js?v=20260705a';

const API_BASE_URL = "http://127.0.0.1:8050";

const CURRENT_USER_ID = 2;
const CURRENT_ADDRESS_ID = 3;

const copy = getSiteCopy();
const collections = getCollections();
// const products = getProducts();
// const salesRankMap = getSalesRankMap(products);
// const productsById = new Map(products.map((product) => [product.id, product]));

// 先保留原来的静态商品，用它提供图片、样式等前端展示信息
const staticProducts = getProducts();

// products 改成 let，后面会用数据库商品替换
let products = staticProducts;
let salesRankMap = getSalesRankMap(products);
let productsById = new Map(products.map((product) => [product.id, product]));

const heroTitle = document.querySelector('[data-hero-title]');
const heroSlogan = document.querySelector('[data-hero-slogan]');
const heroIntro = document.querySelector('[data-hero-intro]');
const heroNote = document.querySelector('[data-hero-note]');
const primaryCta = document.querySelector('[data-primary-cta]');
const secondaryCta = document.querySelector('[data-secondary-cta]');
const collectionRail = document.querySelector('[data-collection-rail]');
const productGrid = document.querySelector('[data-product-grid]');
const activeCollectionLabel = document.querySelector('[data-active-collection]');
const productCountLabel = document.querySelector('[data-product-count]');
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
const purchaseImage = document.querySelector('[data-purchase-image]');
const purchaseAddressList = document.querySelector('[data-purchase-address-list]');
const purchaseQuantityValue = document.querySelector('[data-purchase-quantity-value]');
const purchaseQuantityDecrease = document.querySelector('[data-purchase-quantity-decrease]');
const purchaseQuantityIncrease = document.querySelector('[data-purchase-quantity-increase]');
const purchasePaymentOptions = document.querySelector('[data-purchase-payment-options]');
const purchaseTotal = document.querySelector('[data-purchase-total]');
const purchaseSubmit = document.querySelector('[data-purchase-submit]');
const purchaseFeedback = document.querySelector('[data-purchase-feedback]');

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
const ordersList = document.querySelector('[data-orders-list]');
const accountEmail = document.querySelector('[data-account-email]');
const accountDisplayName = document.querySelector('[data-account-display-name]');
const isAdminPage = Boolean(document.querySelector('[data-admin-shell]'));

const storage = window.localStorage;
const pageRoot = document.documentElement;
const heroBackgroundUrl = new URL('../assets/hero-background.png', import.meta.url).href;
let activePurchaseProduct = null;
let activePurchaseQuantity = 1;
let activePurchasePaymentMethod = 'alipay';
let activePurchaseAddressId = '';
let activeCartPaymentMethod = 'alipay';
let isCartCheckoutSubmitting = false;
let isCartQuantityUpdating = false;
const cancellingOrderIds = new Set();

const purchasePaymentMethods = [
  { value: 'alipay', label: '支付宝' },
  { value: 'wechat', label: '微信支付' },
  { value: 'cod', label: '先用后付' },
];

function getPaymentMethodLabel(method) {
  return purchasePaymentMethods.find((item) => item.value === method)?.label || '支付宝';
}

function setCartPaymentMethod(method) {
  const isAllowed = purchasePaymentMethods.some((item) => item.value === method);
  activeCartPaymentMethod = isAllowed ? method : 'alipay';
  renderSidebar();
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

let activeCategory = '全部';
let activeSidebarSection = 'account';
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

      productMap.set(productId, {
        // 前端原有 ranking.js 需要 id 是字符串
        id: `product-${productId}`,

        // 数据库字段
        productId,
        skuId,
        defaultSkuId: skuId,

        name: row.product_name,
        category: row.category_name,
        badge: "数据库商品",

        price: Number(row.price || 0),
        sales: Number(row.total_sold_count || 0),

        availableStock: Number(row.available_stock || 0),
        lockedStock: Number(row.locked_stock || 0),

        skuList: [
          {
            skuId,
            skuName: row.sku_name,
            price: Number(row.price || 0),
            availableStock: Number(row.available_stock || 0),
            lockedStock: Number(row.locked_stock || 0),
          },
        ],

        detail: "",

        // 继续复用原来的图片
        image: imageSource.image,
        imageFit: imageSource.imageFit,
        imageFocus: imageSource.imageFocus,
        imageZoom: imageSource.imageZoom,

        detailLayout: imageSource.detailLayout || "price-sales-rank",
        purchaseLayout: imageSource.purchaseLayout || "buy",
      });

      return;
    }

    const product = productMap.get(productId);

    product.skuList.push({
      skuId,
      skuName: row.sku_name,
      price: Number(row.price || 0),
      availableStock: Number(row.available_stock || 0),
      lockedStock: Number(row.locked_stock || 0),
    });

    product.price = Math.min(product.price, Number(row.price || 0));
    product.sales += Number(row.total_sold_count || 0);
    product.availableStock += Number(row.available_stock || 0);
    product.lockedStock += Number(row.locked_stock || 0);
  });

  return Array.from(productMap.values()).map((product) => {
    product.detail = `共 ${product.skuList.length} 个规格，库存 ${product.availableStock} 件，默认 SKU：${product.skuList[0]?.skuName || "无"}`;
    product.skuId = product.defaultSkuId;
    return product;
  });
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
    salesRankMap = getSalesRankMap(products);
    productsById = new Map(products.map((product) => [product.id, product]));

    updateView();

    console.log("已使用后端数据库商品渲染页面：", {
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("加载后端商品失败，继续使用静态商品：", error);

    // 失败时保留原来的静态商品，页面不会空白
    products = staticProducts;
    salesRankMap = getSalesRankMap(products);
    productsById = new Map(products.map((product) => [product.id, product]));
    updateView();
  }
}

function convertApiCartRows(apiRows) {
  return apiRows.map((row) => {
    const matchedProduct =
      products.find((product) => product.productId === Number(row.product_id)) ||
      products.find((product) => product.skuId === Number(row.sku_id)) ||
      products[0];

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
      quantity: Number(row.quantity || 1),
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

  console.log("已同步后端购物车：", {
    count: cartItems.length,
    cartItems,
  });

  return cartItems;
}


async function addCartToApi(product) {
  const skuId = product.defaultSkuId || product.skuId;

  if (!skuId) {
    setFeedback(sidebarCartFeedback, "加入购物车失败：当前商品没有 SKU。", true);
    openSidebar("cart");
    return;
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
        quantity: 1,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.detail || "加入购物车失败");
    }

    await syncCartFromApi(CURRENT_USER_ID);

    setFeedback(sidebarCartFeedback, "已加入数据库购物车。");
    openSidebar("cart");

    console.log("加入购物车成功：", result);
  } catch (error) {
    console.error("加入购物车失败：", error);

    setFeedback(
      sidebarCartFeedback,
      `加入购物车失败：${error.message}`,
      true
    );
    openSidebar("cart");
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

async function createDirectOrderFromApi(product, quantity = 1) {
  const skuId = product.defaultSkuId || product.skuId;

  if (!skuId) {
    throw new Error("当前商品没有 SKU，不能直接下单。");
  }

  const response = await fetch(`${API_BASE_URL}/orders/direct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: CURRENT_ADDRESS_ID,
      sku_id: skuId,
      quantity: Math.max(1, Number(quantity) || 1),
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
      address_id: CURRENT_ADDRESS_ID,
    }),
  });

  const orderResult = await response.json();

  if (!response.ok || !orderResult.success) {
    throw new Error(orderResult.detail || "从购物车创建订单失败");
  }

  console.log("从购物车创建订单成功，订单处于待支付状态：", orderResult);

  return orderResult;
}

async function createOrderFromSelectedCartFromApi(cartItemIds) {
  const response = await fetch(`${API_BASE_URL}/orders/from-cart-selected`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: CURRENT_USER_ID,
      address_id: CURRENT_ADDRESS_ID,
      cart_item_ids: cartItemIds,
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
  if (isCartCheckoutSubmitting) {
    return;
  }

  const cart = getStoredCart(storage);
  const selectedIds = getStoredCartSelections(storage);
  const selectedCartItemIds = getSelectedCartItemIds(cart, selectedIds);

  if (!selectedCartItemIds.length) {
    setFeedback(sidebarCartFeedback, "请先勾选要提交订单的商品。", true);
    return;
  }

  try {
    isCartCheckoutSubmitting = true;
    renderSidebar();

    setFeedback(sidebarCartFeedback, "正在从数据库购物车中创建待支付订单，请稍候...");

    const orderResult = await createOrderFromSelectedCartFromApi(selectedCartItemIds);

    const orderNo = orderResult.order_no || "未知订单号";

    console.log("购物车选中商品提交订单成功：", orderResult);

    setFeedback(
      sidebarCartFeedback,
      `选中商品订单已提交！订单号：${orderNo}，支付方式：${getPaymentMethodLabel(activeCartPaymentMethod)}，地址ID：${CURRENT_ADDRESS_ID}，当前状态：待支付。`
    );

    await syncCartFromApi(CURRENT_USER_ID);
    saveStoredCartSelections(storage, []);
    renderSidebar();

    const payResult = await payOrderWithPasswordPrompt(
      orderResult.order_id,
      activeCartPaymentMethod,
      sidebarCartFeedback
    );

    if (payResult.paid) {
      setFeedback(
        sidebarCartFeedback,
        `选中商品支付成功！订单号：${orderNo}，支付方式：${getPaymentMethodLabel(activeCartPaymentMethod)}。`
      );

      await loadProductsFromApi();
    }

    await refreshOrdersFromApi();

    setTimeout(() => {
      openSidebar("orders");
    }, 800);
  } catch (error) {
    console.error("购物车提交订单或支付失败：", error);
    setFeedback(sidebarCartFeedback, `购物车提交订单或支付失败：${error.message}`, true);
  } finally {
    isCartCheckoutSubmitting = false;
    renderSidebar();
  }
}

function formatOrderStatus(status) {
  const statusMap = {
    PENDING_PAYMENT: "待支付",
    PAID: "已支付",
    CANCELLED: "已取消",
    SHIPPED: "已发货",
    COMPLETED: "已完成",
  };

  return statusMap[status] || status || "未知状态";
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

  if (status === "PAID") {
    return "已支付订单不可取消";
  }

  if (status === "CANCELLED") {
    return "订单已取消";
  }

  return "当前状态不可取消";
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

function renderApiOrders(orders) {
  if (!ordersList) {
    return;
  }

  if (!orders.length) {
    ordersList.innerHTML = `<p class="orders-empty">暂无购买记录</p>`;
    return;
  }

  ordersList.innerHTML = orders
    .map((order) => {
      const orderId = Number(order.order_id);
      const isCancelling = cancellingOrderIds.has(orderId);
      const cancellable = canCancelOrder(order.status);
      const cancelHint = getOrderCancelHint(order.status);

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
                : `<span class="order-card__hint">${escapeHtml(cancelHint)}</span>`
            }
          </div>

          <p class="order-card__action-feedback" data-order-action-feedback="${order.order_id}"></p>
          <div data-order-detail-container="${order.order_id}"></div>
        </article>
      `;
    })
    .join("");
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

  if (heroIntro) {
    heroIntro.textContent = copy.intro;
  }

  if (heroNote) {
    heroNote.textContent = copy.note;
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

  const buttons = [{ title: '全部', summary: '浏览全部商品' }, ...collections].map((item) => {
    const isActive = item.title === activeCategory;

    return `
      <button class="collection-chip ${isActive ? 'is-active' : ''}" type="button" data-collection="${item.title}">
        <span class="collection-chip__title">${item.title}</span>
      </button>
    `;
  });

  collectionRail.innerHTML = buttons.join('');
  activeCollectionLabel.textContent = activeCategory;
}

function filteredProducts() {
  return activeCategory === '全部'
    ? products
    : products.filter((product) => product.category === activeCategory);
}

function renderProducts() {
  if (!productGrid || !productCountLabel) {
    return;
  }

  const visibleProducts = filteredProducts();

  productCountLabel.textContent = `${visibleProducts.length} 件商品`;
  productGrid.innerHTML = visibleProducts
    .map((product) => {
      const isPrimaryDetail = product.detailLayout === 'price-sales-rank';
      const isSplitDetail = product.detailLayout === 'split';
      const isPurchaseUi = product.purchaseLayout === 'buy';
      const isTopSeller = salesRankMap.get(product.id) === 1;
      const salesRankLabel = isTopSeller ? '网站销量第一' : formatSalesRank(salesRankMap.get(product.id));

      return `
        <article class="product-card ${isPrimaryDetail ? 'product-card--primary-detail' : ''} ${isSplitDetail ? 'product-card--split-detail' : ''} ${isPurchaseUi ? 'product-card--purchase-ui' : ''}" data-category="${product.category}" data-product-id="${product.id}">
          <div class="product-card__glow"></div>
          <div class="product-card__badge">${product.badge}</div>
          <div class="product-card__art" aria-hidden="true">
            <img class="product-card__image" src="${product.image}" alt="${product.name} 预览图" style="${getProductImageStyle(product)}" loading="lazy" decoding="async" />
            <span class="product-card__art-overlay"></span>
          </div>
          <div class="product-card__body ${isPrimaryDetail ? 'product-card__body--primary-detail' : ''} ${isSplitDetail ? 'product-card__body--split-detail' : ''}">
            <p class="product-card__category">${product.category}</p>
            ${
              isPrimaryDetail
                ? `
            <div class="product-card__primary-detail">
              <div class="product-card__primary-topline">
                <h3>${product.name}</h3>
                <strong class="product-card__price">${formatPrice(product.price)}</strong>
              </div>
              <div class="product-card__primary-subline">
                <span class="product-card__sales-chip">销量 ${product.sales}</span>
                <span class="product-card__sales-rank ${isTopSeller ? 'product-card__sales-rank--pill' : ''}">${salesRankLabel}</span>
              </div>
            </div>
            <p class="product-card__detail">${product.detail}</p>
                `
                : isSplitDetail
                  ? `
            <h3>${product.name}</h3>
            <div class="product-card__detail-grid">
              <div class="product-card__meta product-card__meta--stacked">
                <div class="product-card__info-line">
                  <span class="product-card__info-label">售价：</span>
                  <strong class="product-card__info-value">${formatPrice(product.price)}</strong>
                </div>
                <div class="product-card__info-line">
                  <span class="product-card__info-label">销量：</span>
                  <strong class="product-card__info-value product-card__info-value--muted">${product.sales}</strong>
                </div>
                <div class="product-card__info-line">
                  <span class="product-card__info-label">${salesRankLabel}</span>
                </div>
              </div>
              <p class="product-card__detail">${product.detail}</p>
            </div>
                  `
                  : `
            <h3>${product.name}</h3>
            <p class="product-card__detail">${product.detail}</p>
                  `
            }
            <div class="product-card__footer">
              <div class="product-card__actions ${isPurchaseUi ? 'product-card__actions--purchase' : ''}">
                ${
                  isPurchaseUi
                    ? `
                <button type="button" class="ghost-button ghost-button--icon ghost-button--icon-outline" aria-label="加入收藏夹" data-sidebar-launch="favorites">
                  <span class="ghost-button__icon">${getFavoriteIcon()}</span>
                </button>
                <button type="button" class="ghost-button ghost-button--icon ghost-button--icon-outline" aria-label="加入购物车" data-sidebar-launch="cart">
                  <span class="ghost-button__icon">${getCartIcon()}</span>
                </button>
                <button type="button" class="ghost-button ghost-button--solid ghost-button--buy" data-purchase-launch="buy">立即购买</button>
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

function renderPurchaseModal() {
  if (!purchaseModal) {
    return;
  }

  const addressBook = getStoredAddressBook(storage);
  const selectedAddress = getPurchaseAddress(addressBook, activePurchaseAddressId) || getPrimaryAddress(addressBook);

  if (selectedAddress) {
    activePurchaseAddressId = selectedAddress.id;
  }

  const product = activePurchaseProduct;
  const quantity = Math.max(1, Number(activePurchaseQuantity) || 1);
  const total = product ? product.price * quantity : 0;

  if (purchaseTitle) {
    purchaseTitle.textContent = product?.name || '立即购买';
  }

  if (purchaseCategory) {
    purchaseCategory.textContent = product?.category || '商品信息';
  }

  if (purchaseBadge) {
    purchaseBadge.textContent = product?.badge || '精选';
  }

  if (purchasePrice) {
    purchasePrice.textContent = formatPrice(product?.price || 0);
  }

  if (purchaseSales) {
    purchaseSales.textContent = product ? `销量 ${product.sales}` : '请选择商品';
  }

  if (purchaseImage) {
    if (product) {
      purchaseImage.src = product.image;
      purchaseImage.alt = `${product.name} 预览`;
    }
  }

  if (purchaseQuantityValue) {
    purchaseQuantityValue.textContent = String(quantity);
  }

  if (purchaseTotal) {
    purchaseTotal.textContent = formatPrice(total);
  }

  if (purchaseAddressList) {
    if (!addressBook.addresses.length) {
      purchaseAddressList.innerHTML = '<p class="purchase-empty">暂无收货地址，请先到个人中心添加。</p>';
    } else {
      purchaseAddressList.innerHTML = addressBook.addresses
        .map(
          (address) => `
            <button
              type="button"
              class="purchase-address ${address.id === activePurchaseAddressId ? 'is-active' : ''}"
              data-purchase-address-id="${address.id}"
            >
              <span class="purchase-address__name">${address.recipientName || '未命名地址'}</span>
              <span class="purchase-address__phone">${address.phone || ''}</span>
              <span class="purchase-address__detail">${address.province} ${address.city} ${address.detail}</span>
            </button>
          `,
        )
        .join('');
    }
  }

  if (purchasePaymentOptions) {
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
    purchaseSubmit.disabled = !product;
    purchaseSubmit.textContent = product ? `提交订单 ${formatPrice(total)}` : '请选择商品';
  }

  if (purchaseFeedback) {
    purchaseFeedback.textContent = '演示模式：使用数据库测试用户 2 和地址 3。';
    purchaseFeedback.dataset.state = 'success';
  }
}

function openPurchaseModal(product) {
  activePurchaseProduct = product;
  activePurchaseQuantity = 1;
  activePurchasePaymentMethod = 'alipay';

  const addressBook = getStoredAddressBook(storage);
  activePurchaseAddressId = getPrimaryAddress(addressBook)?.id || '';

  renderPurchaseModal();
  purchaseModal?.classList.add('is-open');
  purchaseModal?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-modal');
}

function closePurchaseModal() {
  if (!purchaseModal) {
    return;
  }

  purchaseModal.classList.remove('is-open');
  purchaseModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-modal');
}

function setPurchaseQuantity(nextQuantity) {
  activePurchaseQuantity = Math.min(99, Math.max(1, Number(nextQuantity) || 1));
  renderPurchaseModal();
}

function setPurchasePaymentMethod(method) {
  activePurchasePaymentMethod = method;
  renderPurchaseModal();
}

function setPurchaseAddress(addressId) {
  activePurchaseAddressId = addressId;
  renderPurchaseModal();
}

async function submitPurchaseOrder() {
  if (!activePurchaseProduct) {
    return;
  }

  const quantity = Math.max(1, Number(activePurchaseQuantity) || 1);
  const total = Number(activePurchaseProduct.price || 0) * quantity;

  try {
    if (purchaseSubmit) {
      purchaseSubmit.disabled = true;
      purchaseSubmit.textContent = "正在提交订单...";
    }

    setFeedback(purchaseFeedback, "正在创建待支付订单，请稍候...");

    const orderResult = await createDirectOrderFromApi(
      activePurchaseProduct,
      quantity
    );

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
      openSidebar("orders");
      refreshOrdersFromApi();
    }, 800);
  } catch (error) {
    console.error("提交订单或支付失败：", error);
    setFeedback(purchaseFeedback, `提交订单或支付失败：${error.message}`, true);
  } finally {
    if (purchaseSubmit) {
      purchaseSubmit.disabled = false;
      purchaseSubmit.textContent = `提交订单 ${formatPrice(total)}`;
    }
  }
}

function openSidebar(section = 'account') {
  activeSidebarSection = sidebarMeta[section] ? section : 'account';
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-sidebar');
  renderSidebar();

  if (activeSidebarSection === "orders") {
    refreshOrdersFromApi();
  }
}

function closeSidebar() {
  sidebar.classList.remove('is-open');
  sidebar.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('has-sidebar');
}

function getStoredProductById(productId) {
  return products.find((product) => product.id === productId) || null;
}

function upsertFavorite(product) {
  const favorites = getStoredFavorites(storage);

  if (favorites.some((item) => item.id === product.id)) {
    return favorites;
  }

  const nextFavorites = [
    ...favorites,
    {
      id: product.id,
      name: product.name,
      price: product.price,
      badge: product.badge,
      category: product.category,
      image: product.image,
    },
  ];

  saveStoredFavorites(storage, nextFavorites);
  return nextFavorites;
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

function renderProductShelf(listElement, items, emptyState, { showQuantity = false } = {}) {
  const shelf = renderSavedProductItems(items, emptyState);

  if (!listElement) {
    return;
  }

  if (shelf.emptyState) {
    listElement.innerHTML = `<p class="sidebar-empty">${shelf.emptyState}</p>`;
    return;
  }

  listElement.innerHTML = shelf.items
    .map(
      (item) => `
        <article class="saved-item">
          <div class="saved-item__header">
            <strong>${item.name}</strong>
            <span>${item.badge}</span>
          </div>
          <p>${item.category}</p>
          <p>${formatPrice(item.price)}${showQuantity ? ` × ${item.quantity}` : ''}</p>
        </article>
      `,
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
  const selectedIds = getStoredCartSelections(storage);
  const nextSelectedIds = selectedIds.includes(itemId)
    ? selectedIds.filter((id) => id !== itemId)
    : [...selectedIds, itemId];

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
  if (isCartQuantityUpdating) {
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

      return `
        <article class="cart-item ${isSelected ? 'is-selected' : ''}" data-cart-item-id="${item.id}">
          <button
            class="cart-item__select"
            type="button"
            data-cart-select-id="${item.id}"
            aria-label="${isSelected ? '取消选择' : '选择商品'}"
            aria-pressed="${isSelected ? 'true' : 'false'}"
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
              <strong class="cart-item__subtotal">${formatCartMoney(subtotal)}</strong>
            </div>
            <div class="cart-item__bottomline">
              <span class="cart-item__unit-price">${formatCartMoney(item.price)} / 件</span>
              <div class="cart-item__quantity-zone">
                <span class="cart-item__quantity-label">x${quantity}</span>
                <div class="cart-item__stepper">
                  <button class="cart-item__stepper-button" type="button" data-cart-quantity-step="-1" data-cart-item-id="${item.id}" aria-label="减少数量">-</button>
                  <span class="cart-item__quantity-value">${quantity}</span>
                  <button class="cart-item__stepper-button" type="button" data-cart-quantity-step="1" data-cart-item-id="${item.id}" aria-label="增加数量">+</button>
                </div>
              </div>
            </div>
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
  const selectedTotals = getCartTotals(cartItems, safeSelectedIds);
  const allTotals = getCartTotals(cartItems, null);
  const paymentLabel = getPaymentMethodLabel(activeCartPaymentMethod);
  const hasSelectedItems = selectedTotals.totalQuantity > 0;

  cartSummary.innerHTML = `
    <div class="cart-summary__checkout-panel">
      <div class="cart-summary__meta">
        <span>购物车共 ${allTotals.totalQuantity} 件，已选 ${selectedTotals.totalQuantity} 件</span>
        <strong>${formatCartMoney(selectedTotals.totalAmount)}</strong>
      </div>

      <div class="cart-summary__address">
        <span>收货地址</span>
        <strong>测试地址 ID：${CURRENT_ADDRESS_ID}</strong>
        <small>当前阶段固定使用数据库测试用户 ${CURRENT_USER_ID} 的地址 ${CURRENT_ADDRESS_ID}，后续再接入地址选择。</small>
      </div>

      <div class="cart-summary__payment">
        <span>支付方式</span>
        <div class="cart-summary__payment-options">
          ${purchasePaymentMethods
            .map(
              (method) => `
                <button
                  type="button"
                  class="cart-summary__payment-button ${method.value === activeCartPaymentMethod ? 'is-active' : ''}"
                  data-cart-payment-method="${method.value}"
                >
                  ${method.label}
                </button>
              `,
            )
            .join('')}
        </div>
      </div>

      <button
        class="cart-summary__checkout"
        type="button"
        data-cart-checkout
        ${hasSelectedItems && !isCartCheckoutSubmitting ? '' : 'disabled'}
      >
        ${
          isCartCheckoutSubmitting
            ? '结算中...'
            : hasSelectedItems
              ? `使用${paymentLabel}提交已选商品订单`
              : '请先勾选商品'
        }
      </button>
    </div>
  `;
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

  

  sidebarPanels.forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.sidebarPanel === activeSidebarSection);
  });

  if (accountEmail) {
    accountEmail.textContent = email;
  }

  if (accountDisplayName) {
    accountDisplayName.textContent = displayName;
  }

  renderSidebarAddressBook(getStoredAddressBook(storage));

  // const orderView = renderOrderItems(getStoredOrders(storage));
  // if (ordersList) {
  //   if (orderView.emptyState) {
  //     ordersList.innerHTML = `<p class="orders-empty">${orderView.emptyState}</p>`;
  //   } else {
  //     ordersList.innerHTML = orderView.items
  //       .map(
  //         (order) => `
  //           <article class="order-card">
  //             <div class="order-card__header">
  //               <strong>${order.orderNo}</strong>
  //               <span>${order.status}</span>
  //             </div>
  //             <p>${order.items.join(' 路 ')}</p>
  //             <p>合计：${formatPrice(order.totalPrice)}</p>
  //             <p>${order.createdAt}</p>
  //           </article>
  //         `,
  //       )
  //       .join('');
  //   }
  // }

  if (ordersList) {
    ordersList.innerHTML = `<p class="orders-empty">正在加载数据库订单...</p>`;
  }

  renderProductShelf(favoritesList, getStoredFavorites(storage), '暂无收藏夹');
  const cart = getStoredCart(storage);
  const selectedIds = getStoredCartSelections(storage);
  renderCartShelf(cartList, cart, '暂无购物车', selectedIds);
  renderCartSummary(cart, selectedIds);
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

    activeCategory = button.dataset.collection;
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
  const productForm = shell.querySelector('[data-admin-product-form]');
  const productFeedback = shell.querySelector('[data-admin-product-feedback]');
  const imageSelect = shell.querySelector('[data-admin-image-select]');
  let activePanel = 'orders';
  let products = [];
  let orders = [];
  let summary = null;
  let productRows = [];
  let renderedOrders = null;
  let renderedStats = null;
  let renderedProducts = null;

  function refreshAdminData() {
    products = getStoredAdminProducts(storage);
    orders = getStoredMockOrders(storage);
    summary = getSalesSummary(products, orders);
    productRows = getProductSalesRows(products, orders);
    renderedOrders = renderAdminOrdersView(products, orders);
    renderedStats = renderAdminStatsView(summary, productRows);
    renderedProducts = renderAdminProductsView(products);
  }

  function renderOrders() {
    if (!ordersBody) {
      return;
    }

    if (!renderedOrders || renderedOrders.emptyState) {
      ordersBody.innerHTML = `<tr><td colspan="6"><div class="admin-empty">${escapeHtml(renderedOrders.emptyState)}</div></td></tr>`;
      return;
    }

    ordersBody.innerHTML = renderedOrders.rows
      .map(
        (row) => `
          <tr>
            <td>${escapeHtml(row.orderNo)}</td>
            <td>${escapeHtml(row.customerName)}</td>
            <td>${escapeHtml(row.itemsLabel)}</td>
            <td>${escapeHtml(row.amountLabel)}</td>
            <td>${escapeHtml(row.status)}</td>
            <td>${escapeHtml(row.createdAt)}</td>
          </tr>
        `,
      )
      .join('');
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
    if (productSummary) {
      const newestProduct = products.at(-1);
      productSummary.innerHTML = `
        <p><strong>${products.length}</strong> 件商品正在管理中</p>
        <p>${newestProduct ? `最新上架：${escapeHtml(newestProduct.name)}` : '暂无商品'}</p>
      `;
    }

    if (!productList) {
      return;
    }

    if (!renderedProducts || renderedProducts.emptyState) {
      productList.innerHTML = `<div class="admin-empty">${escapeHtml(renderedProducts?.emptyState || '暂无商品数据')}</div>`;
      return;
    }

    productList.innerHTML = renderedProducts.rows
      .map(
        (row) => `
          <article class="admin-row">
            <div class="admin-row__header">
              <strong>${escapeHtml(row.name)}</strong>
              <span>${escapeHtml(row.priceLabel)}</span>
            </div>
            <span>${escapeHtml(row.category)} · ${escapeHtml(row.badge)}</span>
            <span>${escapeHtml(row.status)} · ${escapeHtml(row.imageLabel)}</span>
          </article>
        `,
      )
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

  function syncPanels() {
    navButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.adminNavTarget === activePanel);
      button.setAttribute('aria-pressed', String(button.dataset.adminNavTarget === activePanel));
    });

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.adminPanel === activePanel);
    });
  }

  refreshAdminData();
  populateImageSelect();
  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      activePanel = button.dataset.adminNavTarget || 'orders';
      syncPanels();
    });
  });

  if (productForm) {
    productForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(productForm).entries());
      const name = String(values.name || '').trim();
      const category = String(values.category || '').trim();
      const image = String(values.image || '').trim();
      const price = Number(values.price || 0);

      if (!name || !category || !image || !Number.isFinite(price) || price <= 0) {
        setFeedback(productFeedback, '请完整填写商品名称、分类、价格和图片。', true);
        return;
      }

      addAdminProduct(storage, {
        name,
        category,
        price,
        badge: String(values.badge || '新品'),
        image,
        detail: String(values.detail || '').trim(),
      });

      setFeedback(productFeedback, '新品已上架并保存到本地。');
      productForm.reset();
      if (imageSelect?.options.length) {
        imageSelect.selectedIndex = 0;
      }

      refreshAdminData();
      syncPanels();
      renderOrders();
      renderStats();
      renderProducts();
    });
  }

  syncPanels();
  renderOrders();
  renderStats();
  renderProducts();
}

if (isAdminPage) {
  initAdminPage();
} else {
collectionRail.addEventListener('click', (event) => {
  const button = event.target.closest('[data-collection]');
  if (!button) {
    return;
  }

  activeCategory = button.dataset.collection;
  updateView();
});

sidebarNavButtons.forEach((button) => {
  button.addEventListener('click', () => {
    openSidebar(button.dataset.sidebarTarget);
  });
});

if (ordersList) {
  ordersList.addEventListener("click", (event) => {
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

if (cartList) {
  cartList.addEventListener('click', (event) => {
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
    const paymentButton = event.target.closest("[data-cart-payment-method]");
    if (paymentButton) {
      setCartPaymentMethod(paymentButton.dataset.cartPaymentMethod);
      return;
    }

    const checkoutButton = event.target.closest("[data-cart-checkout]");
    if (!checkoutButton) {
      return;
    }

    submitCartCheckout();
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

if (purchaseModal) {
  purchaseModal.addEventListener('click', (event) => {
    const quantityDecrease = event.target.closest('[data-purchase-quantity-decrease]');
    const quantityIncrease = event.target.closest('[data-purchase-quantity-increase]');
    const addressButton = event.target.closest('[data-purchase-address-id]');
    const paymentButton = event.target.closest('[data-purchase-payment-method]');
    const manageAddressButton = event.target.closest('[data-purchase-manage-address]');
    const submitButton = event.target.closest('[data-purchase-submit]');

    if (quantityDecrease) {
      setPurchaseQuantity(activePurchaseQuantity - 1);
      return;
    }

    if (quantityIncrease) {
      setPurchaseQuantity(activePurchaseQuantity + 1);
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

if (sidebarAddressForm) {
  sidebarAddressForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(sidebarAddressForm);
    const validation = validateAddress(values);

    if (!validation.ok) {
      setFeedback(sidebarAddressFeedback, '请把收件人、手机号和地址信息填写完整。', true);
      return;
    }

    const addressBook = getStoredAddressBook(storage);
    const nextAddressId = `address-${addressBook.addresses.length + 1}`;
    const shouldBeDefault = Boolean(values.isDefault) || addressBook.addresses.length === 0;
    const nextAddresses = addressBook.addresses.map((address) => ({
      ...address,
      isDefault: false,
    }));

    nextAddresses.push({
      id: nextAddressId,
      recipientName: String(values.recipientName),
      phone: String(values.phone),
      province: String(values.province),
      city: String(values.city),
      detail: String(values.detail),
      isDefault: shouldBeDefault,
    });

    saveStoredAddressBook(storage, {
      addresses: nextAddresses,
      defaultAddressId: shouldBeDefault ? nextAddressId : addressBook.defaultAddressId || nextAddressId,
    });

    sidebarAddressForm.reset();

    setFeedback(sidebarAddressFeedback, '收货地址已保存。');
    renderSidebar();
    renderPurchaseModal();
  });
}

if (sidebarAddressList) {
  sidebarAddressList.addEventListener('click', (event) => {
    const defaultButton = event.target.closest('[data-sidebar-address-default]');

    if (!defaultButton) {
      return;
    }

    const addressId = defaultButton.dataset.sidebarAddressDefault;
    const addressBook = getStoredAddressBook(storage);

    if (!addressBook.addresses.length) {
      return;
    }

    saveStoredAddressBook(storage, {
      addresses: addressBook.addresses.map((address) => ({
        ...address,
        isDefault: address.id === addressId,
      })),
      defaultAddressId: addressId,
    });

    renderSidebar();
    renderPurchaseModal();
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

    if (actionButton.dataset.purchaseLaunch === 'buy') {
      openPurchaseModal(product);
      return;
    }

    if (actionButton.dataset.sidebarLaunch === 'favorites') {
      upsertFavorite(product);
      setFeedback(sidebarFavoritesFeedback, '已加入收藏夹。');
      openSidebar('favorites');
      return;
    }

    // if (actionButton.dataset.sidebarLaunch === 'cart') {
    //   upsertCartItem(product);
    //   setFeedback(sidebarCartFeedback, '已加入购物车。');
    //   openSidebar('cart');
    // }

    if (actionButton.dataset.sidebarLaunch === 'cart') {
        addCartToApi(product);
      }

      if (actionButton.dataset.sidebarLaunch === 'checkout') {
        createDirectOrderFromApi(product);
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
  if (event.key === 'Escape') {
    closeAuthModal();
    closeSidebar();
    closePurchaseModal();
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
loadProductsFromApi();

window.addEventListener('scroll', scheduleHeroParallax, { passive: true });
window.addEventListener('resize', scheduleHeroParallax);

window.requestAnimationFrame(() => {
  setInitialScrollPosition();
  updateHeroParallax();
  updateHeroScrollState();
});
}

