import { getCollections, getProducts, getSiteCopy } from './content.js';
import { formatSalesRank, getSalesRankMap } from './ranking.js';
import {
  loadStoredProfile,
  saveStoredProfile,
  validateAddress,
  validateRegistration,
} from './account-state.js';

const copy = getSiteCopy();
const collections = getCollections();
const products = getProducts();
const productPreviewImages = [
  './assets/products/product-01.png',
  './assets/products/product-02.png',
  './assets/products/product-03.png',
  './assets/products/product-04.png',
  './assets/products/product-05.png',
  './assets/products/product-06.png',
  './assets/products/product-07.png',
  './assets/products/product-08.png',
];
const productsWithImages = products.map((product, index) => ({
  ...product,
  image: productPreviewImages[index],
}));
const salesRankMap = getSalesRankMap(productsWithImages);

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
const authToggle = document.querySelector('[data-auth-toggle]');
const loginPanel = document.querySelector('[data-login-panel]');
const registerPanel = document.querySelector('[data-register-panel]');
const authFeedback = document.querySelector('[data-auth-feedback]');
const addressForm = document.querySelector('[data-address-form]');
const checkoutFeedback = document.querySelector('[data-checkout-feedback]');
const addressFields = addressForm ? Array.from(addressForm.querySelectorAll('input, textarea')) : [];

const heroImageUrl = './assets/products/product-01.png';
const storedProfile = loadStoredProfile(window.localStorage);

let activeCategory = '全部';
let scrollFrame = 0;

function formatPrice(value) {
  return `¥${value}`;
}

function renderHero() {
  hero.style.setProperty('--hero-image', `url("${heroImageUrl}")`);
  document.body.style.setProperty('--page-portrait', `url("${heroImageUrl}")`);
  heroTitle.textContent = copy.brandName;
  heroSlogan.textContent = copy.slogan;
  heroIntro.textContent = copy.intro;
  heroNote.textContent = copy.note;
}

function renderCollections() {
  const buttons = [{ title: '全部', summary: '浏览全部风格' }, ...collections].map((item) => {
    const isActive = item.title === activeCategory;

    return `
      <button class="collection-chip ${isActive ? 'is-active' : ''}" type="button" data-collection="${item.title}">
        <span class="collection-chip__title">${item.title}</span>
        <span class="collection-chip__summary">${item.summary}</span>
      </button>
    `;
  });

  collectionRail.innerHTML = buttons.join('');
  activeCollectionLabel.textContent = activeCategory;
}

function filteredProducts() {
  return activeCategory === '全部'
    ? productsWithImages
    : productsWithImages.filter((product) => product.category === activeCategory);
}

function renderProducts() {
  const visibleProducts = filteredProducts();

  productCountLabel.textContent = `${visibleProducts.length} 件商品`;
  productGrid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="product-card" data-category="${product.category}">
          <div class="product-card__glow"></div>
          <div class="product-card__badge">${product.badge}</div>
          <div class="product-card__art" aria-hidden="true">
            <img class="product-card__image" src="${product.image}" alt="${product.name} 预览图" loading="lazy" decoding="async" />
            <span class="product-card__art-overlay"></span>
          </div>
          <div class="product-card__body">
            <p class="product-card__category">${product.category}</p>
            <h3>${product.name}</h3>
            <p class="product-card__detail">${product.detail}</p>
            <div class="product-card__footer">
              <div class="product-card__meta">
                <strong>${formatPrice(product.price)}</strong>
                <span class="product-card__rank">${formatSalesRank(salesRankMap.get(product.id))}</span>
                <span class="product-card__sales">销量 ${product.sales}</span>
              </div>
              <div class="product-card__actions">
                <button type="button" class="ghost-button">加入收藏</button>
                <button type="button" class="ghost-button ghost-button--solid">查看详情</button>
              </div>
            </div>
          </div>
        </article>
      `,
    )
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

function getCurrentProfile() {
  const profile = loadStoredProfile(window.localStorage);
  return profile || { user: null, address: null };
}

function prefillStoredState() {
  if (!storedProfile) {
    return;
  }

  if (storedProfile.user?.email) {
    const emailInput = loginPanel?.querySelector('input[name="email"]');
    const registerEmailInput = registerPanel?.querySelector('input[name="email"]');

    if (emailInput) {
      emailInput.value = storedProfile.user.email;
    }

    if (registerEmailInput) {
      registerEmailInput.value = storedProfile.user.email;
    }
  }

  if (storedProfile.address) {
    addressFields.forEach((field) => {
      if (field.name in storedProfile.address) {
        field.value = storedProfile.address[field.name] || '';
      }
    });
  }
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

if (authToggle && loginPanel && registerPanel) {
  authToggle.addEventListener('click', () => {
    loginPanel.classList.toggle('is-hidden');
    registerPanel.classList.toggle('is-hidden');
    setFeedback(authFeedback, '');
  });
}

if (loginPanel) {
  loginPanel.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(loginPanel);

    if (!values.email || !values.password) {
      setFeedback(authFeedback, '请先填写邮箱和密码。', true);
      return;
    }

    const profile = getCurrentProfile();
    saveStoredProfile(window.localStorage, {
      user: { email: String(values.email) },
      address: profile.address || null,
    });
    setFeedback(authFeedback, '登录信息已保存，地址可以继续复用。');
  });
}

if (registerPanel) {
  registerPanel.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(registerPanel);
    const validation = validateRegistration(values);

    if (!validation.ok) {
      setFeedback(
        authFeedback,
        validation.error === 'password-mismatch' ? '两次输入的密码不一致。' : '请把注册信息填写完整。',
        true,
      );
      return;
    }

    const profile = getCurrentProfile();
    saveStoredProfile(window.localStorage, {
      user: { email: String(values.email) },
      address: profile.address || null,
    });
    setFeedback(authFeedback, '注册成功，账号信息已保存到本地。');
  });
}

if (addressForm) {
  addressForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const values = readFieldValues(addressForm);
    const validation = validateAddress(values);

    if (!validation.ok) {
      setFeedback(checkoutFeedback, '请把收货人、手机号和地址信息填写完整。', true);
      return;
    }

    const profile = getCurrentProfile();
    saveStoredProfile(window.localStorage, {
      user: profile.user,
      address: {
        recipientName: String(values.recipientName),
        phone: String(values.phone),
        province: String(values.province),
        city: String(values.city),
        detail: String(values.detail),
      },
    });
    setFeedback(checkoutFeedback, '收货地址已保存，下次结算会自动带出。');
  });
}

prefillStoredState();

primaryCta.addEventListener('click', () => {
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

secondaryCta.addEventListener('click', () => {
  document.querySelector('#collections').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.addEventListener('scroll', scheduleHeroParallax, { passive: true });
window.addEventListener('resize', scheduleHeroParallax);

renderHero();
updateView();
updateHeroParallax();
