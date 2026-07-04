import { getCollections, getProducts, getSiteCopy } from './content.js?v=20260704l';
import { formatSalesRank, getSalesRankMap } from './ranking.js?v=20260704l';
import {
  getStoredCart,
  getStoredFavorites,
  getStoredOrders,
  getStoredProfile,
  renderOrderItems,
  renderSavedProductItems,
  saveStoredCart,
  saveStoredFavorites,
  saveStoredProfile,
  validateAddress,
  validateRegistration,
} from './account-store.js?v=20260704l';

const copy = getSiteCopy();
const collections = getCollections();
const products = getProducts();
const salesRankMap = getSalesRankMap(products);

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
const hero = document.querySelector('.hero');

const authModal = document.querySelector('[data-auth-modal]');
const authCloseButtons = document.querySelectorAll('[data-auth-close]');
const authTabLogin = document.querySelector('[data-auth-tab-login]');
const authTabRegister = document.querySelector('[data-auth-tab-register]');
const loginForm = document.querySelector('[data-auth-login-form]');
const registerForm = document.querySelector('[data-auth-register-form]');
const authFeedback = document.querySelector('[data-auth-feedback]');

const sidebar = document.querySelector('[data-sidebar]');
const menuOpenButton = document.querySelector('[data-menu-open]');
const menuCloseButtons = document.querySelectorAll('[data-menu-close]');
const sidebarTitle = document.querySelector('[data-sidebar-title]');
const sidebarSubtitle = document.querySelector('[data-sidebar-subtitle]');
const sidebarNavButtons = document.querySelectorAll('[data-sidebar-target]');
const sidebarPanels = document.querySelectorAll('[data-sidebar-panel]');
const sidebarAddressForm = document.querySelector('[data-sidebar-address-form]');
const sidebarAddressFeedback = document.querySelector('[data-sidebar-address-feedback]');
const sidebarFavoritesFeedback = document.querySelector('[data-sidebar-favorites-feedback]');
const sidebarCartFeedback = document.querySelector('[data-sidebar-cart-feedback]');
const favoritesList = document.querySelector('[data-favorites-list]');
const cartList = document.querySelector('[data-cart-list]');
const ordersList = document.querySelector('[data-orders-list]');
const accountEmail = document.querySelector('[data-account-email]');
const accountDisplayName = document.querySelector('[data-account-display-name]');

const storage = window.localStorage;
const storedOrders = getStoredOrders(storage);

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

function formatPrice(value) {
  return `￥${value}`;
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
  const heroImageUrl = products[0]?.image || './assets/products/product-01.png';
  hero.style.setProperty('--hero-image', `url("${heroImageUrl}")`);
  document.body.style.setProperty('--page-portrait', `url("${heroImageUrl}")`);
  heroTitle.textContent = copy.brandName;
  heroSlogan.textContent = copy.slogan;
  heroIntro.textContent = copy.intro;
  heroNote.textContent = copy.note;
}

function renderCollections() {
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
  const visibleProducts = filteredProducts();

  productCountLabel.textContent = `${visibleProducts.length} 件商品`;
  productGrid.innerHTML = visibleProducts
    .map((product) => {
      const isSplitDetail = product.detailLayout === 'split';
      const isPurchaseUi = product.purchaseLayout === 'buy';
      const isTopSeller = salesRankMap.get(product.id) === 1;

      return `
        <article class="product-card ${isSplitDetail ? 'product-card--split-detail' : ''} ${isPurchaseUi ? 'product-card--purchase-ui' : ''}" data-category="${product.category}" data-product-id="${product.id}">
          <div class="product-card__glow"></div>
          <div class="product-card__badge">${product.badge}</div>
          <div class="product-card__art" aria-hidden="true">
            <img class="product-card__image" src="${product.image}" alt="${product.name} 预览图" style="${getProductImageStyle(product)}" loading="lazy" decoding="async" />
            <span class="product-card__art-overlay"></span>
          </div>
          <div class="product-card__body ${isSplitDetail ? 'product-card__body--split-detail' : ''}">
            <p class="product-card__category">${product.category}</p>
            <h3>${product.name}</h3>
            ${
              isSplitDetail
                ? `
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
                  <span class="product-card__info-label">${isTopSeller ? '网站销量第一' : formatSalesRank(salesRankMap.get(product.id))}</span>
                </div>
              </div>
              <p class="product-card__detail">${product.detail}</p>
            </div>
                `
                : `
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
                <button type="button" class="ghost-button ghost-button--solid ghost-button--buy">立即购买</button>
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
  authModal.classList.add('is-open');
  authModal.setAttribute('aria-hidden', 'false');
}

function closeAuthModal() {
  authModal.classList.remove('is-open');
  authModal.setAttribute('aria-hidden', 'true');
}

function getDisplayName(email, fallback = '') {
  if (fallback) {
    return fallback;
  }

  return email.includes('@') ? email.split('@')[0] : email;
}

function openSidebar(section = 'account') {
  activeSidebarSection = sidebarMeta[section] ? section : 'account';
  sidebar.classList.add('is-open');
  sidebar.setAttribute('aria-hidden', 'false');
  document.body.classList.add('has-sidebar');
  renderSidebar();
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

  const address = profile?.address || {};
  if (sidebarAddressForm) {
    Object.entries(address).forEach(([key, value]) => {
      const field = sidebarAddressForm.elements.namedItem(key);
      if (field) {
        field.value = value || '';
      }
    });
  }

  const orderView = renderOrderItems(storedOrders);
  if (ordersList) {
    if (orderView.emptyState) {
      ordersList.innerHTML = `<p class="orders-empty">${orderView.emptyState}</p>`;
    } else {
      ordersList.innerHTML = orderView.items
        .map(
          (order) => `
            <article class="order-card">
              <div class="order-card__header">
                <strong>${order.orderNo}</strong>
                <span>${order.status}</span>
              </div>
              <p>${order.items.join(' 路 ')}</p>
              <p>合计：${formatPrice(order.totalPrice)}</p>
              <p>${order.createdAt}</p>
            </article>
          `,
        )
        .join('');
    }
  }

  renderProductShelf(favoritesList, getStoredFavorites(storage), '暂无收藏夹');
  renderProductShelf(cartList, getStoredCart(storage), '暂无购物车', { showQuantity: true });
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
  });
}

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

    const profile = getStoredProfile(storage) || {};
    saveStoredProfile(storage, {
      user: {
        email: String(values.email),
        displayName: profile.user?.displayName || getDisplayName(String(values.email)),
      },
      address: profile.address || null,
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

    const profile = getStoredProfile(storage) || {};
    saveStoredProfile(storage, {
      user: {
        email: String(values.email),
        displayName: String(values.displayName || getDisplayName(String(values.email))),
      },
      address: profile.address || null,
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

if (sidebarAddressForm) {
  sidebarAddressForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(sidebarAddressForm);
    const validation = validateAddress(values);

    if (!validation.ok) {
      setFeedback(sidebarAddressFeedback, '请把收件人、手机号和地址信息填写完整。', true);
      return;
    }

    const profile = getStoredProfile(storage) || {};
    saveStoredProfile(storage, {
      user: profile.user || { email: '', displayName: '' },
      address: {
        recipientName: String(values.recipientName),
        phone: String(values.phone),
        province: String(values.province),
        city: String(values.city),
        detail: String(values.detail),
      },
    });

    setFeedback(sidebarAddressFeedback, '收货地址已保存。');
    renderSidebar();
  });
}

if (productGrid) {
  productGrid.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-sidebar-launch]');
    if (!actionButton) {
      return;
    }

    const productCard = actionButton.closest('[data-product-id]');
    const productId = productCard?.dataset.productId;
    const product = getStoredProductById(productId);

    if (!product) {
      return;
    }

    if (actionButton.dataset.sidebarLaunch === 'favorites') {
      upsertFavorite(product);
      setFeedback(sidebarFavoritesFeedback, '已加入收藏夹。');
      openSidebar('favorites');
      return;
    }

    if (actionButton.dataset.sidebarLaunch === 'cart') {
      upsertCartItem(product);
      setFeedback(sidebarCartFeedback, '已加入购物车。');
      openSidebar('cart');
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
  }
});

window.addEventListener('scroll', scheduleHeroParallax, { passive: true });
window.addEventListener('resize', scheduleHeroParallax);

openAuthModal();
renderHero();
updateView();
renderSidebar();
updateHeroParallax();
