import { getCollections, getProducts, getSiteCopy } from './content.js';

const copy = getSiteCopy();
const collections = getCollections();
const products = getProducts();

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

let activeCategory = '全部';

function formatPrice(value) {
  return `¥${value}`;
}

function renderHero() {
  heroTitle.textContent = copy.brandName;
  heroSlogan.textContent = copy.slogan;
  heroIntro.textContent = copy.intro;
  heroNote.textContent = copy.note;
}

function renderCollections() {
  const buttons = [
    { title: '全部', summary: '浏览全部风格' },
    ...collections,
  ].map((item) => {
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
    ? products
    : products.filter((product) => product.category === activeCategory);
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
            <span class="product-card__orb"></span>
            <span class="product-card__spark product-card__spark--one"></span>
            <span class="product-card__spark product-card__spark--two"></span>
          </div>
          <div class="product-card__body">
            <p class="product-card__category">${product.category}</p>
            <h3>${product.name}</h3>
            <p class="product-card__detail">${product.detail}</p>
            <div class="product-card__footer">
              <strong>${formatPrice(product.price)}</strong>
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

collectionRail.addEventListener('click', (event) => {
  const button = event.target.closest('[data-collection]');
  if (!button) {
    return;
  }

  activeCategory = button.dataset.collection;
  updateView();
});

primaryCta.addEventListener('click', () => {
  document.querySelector('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

secondaryCta.addEventListener('click', () => {
  document.querySelector('#collections').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

renderHero();
updateView();
