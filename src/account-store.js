import { getAdminMockOrdersSeed, getProducts } from './content.js?v=20260705a';

const PROFILE_KEY = 'blue-song-profile';
const ORDERS_KEY = 'blue-song-orders';
const FAVORITES_KEY = 'blue-song-favorites';
const CART_KEY = 'blue-song-cart';
const CART_SELECTIONS_KEY = 'blue-song-cart-selections';
const ADMIN_PRODUCTS_KEY = 'blue-song-admin-products';
const ADMIN_ORDERS_KEY = 'blue-song-admin-orders';
const ADMIN_CATALOG_VERSION_KEY = 'blue-song-admin-catalog-version';
const ADMIN_CATALOG_VERSION = '20260706-catalog-17';

function readJsonList(storage, key, fallbackFactory) {
  const raw = storage.getItem(key);

  if (!raw) {
    const fallback = fallbackFactory();
    storage.setItem(key, JSON.stringify(fallback));
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallbackFactory();
  } catch {
    return fallbackFactory();
  }
}

function normalizeAdminProduct(product, index = 0) {
  return {
    id: product.id,
    name: product.name,
    category: product.category,
    price: Number(product.price) || 0,
    badge: product.badge || '新品',
    sales: product.sales || '0',
    image: product.image || '',
    detail: product.detail || '',
    status: product.status || 'published',
    createdAt: product.createdAt || `2026-07-${String(index + 1).padStart(2, '0')}`,
    isCustom: Boolean(product.isCustom),
  };
}

function getProductLookup(products) {
  return new Map(products.map((product) => [product.id, product]));
}

function seedAdminProducts(storage) {
  const seededProducts = getProducts().map(normalizeAdminProduct);
  storage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(seededProducts));
  storage.setItem(ADMIN_CATALOG_VERSION_KEY, ADMIN_CATALOG_VERSION);
  return seededProducts;
}

function hasCurrentCatalogProducts(products) {
  const defaultIds = new Set(getProducts().map((product) => product.id));
  const storedIds = new Set(products.map((product) => product?.id).filter(Boolean));

  return [...defaultIds].every((id) => storedIds.has(id));
}

function getOrderItems(order) {
  return Array.isArray(order?.items) ? order.items : [];
}

function formatCurrency(value) {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

function getNextAdminProductId(products) {
  const numericIds = products
    .map((product) => String(product.id || ''))
    .map((id) => {
      const match = id.match(/^admin-product-(\d+)$/);
      return match ? Number(match[1]) : 0;
    });

  const nextIndex = Math.max(0, ...numericIds) + 1;
  return `admin-product-${String(nextIndex).padStart(3, '0')}`;
}

function createAddressId(index) {
  return `address-${index + 1}`;
}

function normalizeAddressEntry(entry, index, defaultAddressId = '') {
  const id = String(entry?.id || createAddressId(index));

  return {
    id,
    recipientName: String(entry?.recipientName || ''),
    phone: String(entry?.phone || ''),
    province: String(entry?.province || ''),
    city: String(entry?.city || ''),
    detail: String(entry?.detail || ''),
    isDefault: Boolean(entry?.isDefault || id === defaultAddressId),
  };
}

function normalizeAddressList(addresses = [], defaultAddressId = '') {
  const normalized = addresses.map((address, index) => normalizeAddressEntry(address, index, defaultAddressId));
  const resolvedDefaultId =
    defaultAddressId || normalized.find((address) => address.isDefault)?.id || normalized[0]?.id || '';

  return {
    addresses: normalized.map((address) => ({
      ...address,
      isDefault: address.id === resolvedDefaultId,
    })),
    defaultAddressId: resolvedDefaultId,
  };
}

function stripAddressFlags(address) {
  if (!address) {
    return null;
  }

  const { isDefault, ...rest } = address;
  return rest;
}

function formatOrderTimestamp(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getLegacyAddressBook(profile) {
  if (!profile?.address) {
    return {
      addresses: [],
      defaultAddressId: '',
    };
  }

  const legacyAddress = normalizeAddressEntry(
    {
      id: 'address-1',
      ...profile.address,
      isDefault: true,
    },
    0,
    'address-1',
  );

  return {
    addresses: [legacyAddress],
    defaultAddressId: legacyAddress.id,
  };
}

export function validateRegistration(input) {
  if (!input.email || !input.password || !input.confirmPassword) {
    return { ok: false, error: 'missing-fields' };
  }

  if (input.password !== input.confirmPassword) {
    return { ok: false, error: 'password-mismatch' };
  }

  return { ok: true, error: null };
}

export function validateAddress(input) {
  const requiredFields = ['recipientName', 'phone', 'province', 'city', 'detail'];

  if (requiredFields.some((field) => String(input[field] || '').trim() === '')) {
    return { ok: false, error: 'missing-fields' };
  }

  return { ok: true, error: null };
}

export function getStoredProfile(storage) {
  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveStoredProfile(storage, profile) {
  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getStoredAddressBook(storage) {
  const profile = getStoredProfile(storage);

  if (!profile) {
    return {
      addresses: [],
      defaultAddressId: '',
    };
  }

  if (Array.isArray(profile.addresses) && profile.addresses.length > 0) {
    return normalizeAddressList(profile.addresses, profile.defaultAddressId || '');
  }

  return getLegacyAddressBook(profile);
}

export function saveStoredAddressBook(storage, addressBook) {
  const profile = getStoredProfile(storage) || {};
  const normalized = normalizeAddressList(addressBook.addresses || [], addressBook.defaultAddressId || '');
  const selectedAddress =
    normalized.addresses.find((address) => address.id === normalized.defaultAddressId) ||
    normalized.addresses[0] ||
    null;

  saveStoredProfile(storage, {
    ...profile,
    addresses: normalized.addresses,
    defaultAddressId: normalized.defaultAddressId,
    address: stripAddressFlags(selectedAddress),
  });

  return normalized;
}

export function getStoredOrders(storage) {
  const raw = storage.getItem(ORDERS_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredOrders(storage, orders) {
  storage.setItem(ORDERS_KEY, JSON.stringify(orders));
}

function getFavoriteIdentityCandidates(value) {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const candidates = new Set();
  const addCandidate = (candidate) => {
    const normalized = String(candidate ?? '').trim();
    if (!normalized) {
      return;
    }

    candidates.add(normalized);
    const legacyId = normalized.replace(/-sku-[^-]+$/, '');
    candidates.add(legacyId);

    if (/^\d+$/.test(normalized)) {
      candidates.add(`product-${Number(normalized)}`);
    }

    const productIdMatch = normalized.match(/^product-0*(\d+)$/);
    if (productIdMatch) {
      candidates.add(String(Number(productIdMatch[1])));
      candidates.add(`product-${Number(productIdMatch[1])}`);
    }
  };

  addCandidate(value.productId);
  addCandidate(value.id);
  return [...candidates];
}

function findCurrentFavoriteProduct(favorite, products) {
  const favoriteCandidates = new Set(getFavoriteIdentityCandidates(favorite));
  return products.find((product) =>
    getFavoriteIdentityCandidates(product).some((candidate) => favoriteCandidates.has(candidate)),
  ) || null;
}

function getCanonicalFavoriteId(value) {
  const candidates = getFavoriteIdentityCandidates(value);
  return candidates.find((candidate) => candidate.startsWith('product-') && !candidate.includes('-sku-'))
    || candidates.find((candidate) => !/^\d+$/.test(candidate) && !candidate.includes('-sku-'))
    || '';
}

function getLegacyProductName(favorite) {
  const name = String(favorite?.name || '').trim();
  const skuName = String(favorite?.skuName || '').trim();
  const suffix = skuName ? ` / ${skuName}` : '';

  return suffix && name.endsWith(suffix) ? name.slice(0, -suffix.length).trim() : name;
}

function createProductFavorite(product, fallback = null) {
  const source = product || fallback;
  const id = getCanonicalFavoriteId(product) || getCanonicalFavoriteId(fallback);

  if (!source || !id) {
    return null;
  }

  return {
    id,
    productId: product?.productId ?? fallback?.productId ?? id,
    name: String(product?.name || getLegacyProductName(fallback) || '').trim(),
    category: String(product?.category || fallback?.category || '').trim(),
    image: String(product?.image || fallback?.image || '').trim(),
    detail: String(product?.detail || fallback?.detail || '').trim(),
    price: Number(product?.price ?? fallback?.price ?? 0) || 0,
    badge: String(product?.badge || fallback?.badge || '').trim(),
  };
}

export function normalizeProductFavorites(favorites, products = []) {
  const sourceFavorites = Array.isArray(favorites) ? favorites : [];
  const currentProducts = Array.isArray(products) ? products : [];
  const normalizedById = new Map();

  sourceFavorites.forEach((favorite) => {
    const currentProduct = findCurrentFavoriteProduct(favorite, currentProducts);
    const normalized = createProductFavorite(currentProduct, favorite);

    if (normalized && !normalizedById.has(normalized.id)) {
      normalizedById.set(normalized.id, normalized);
    }
  });

  return [...normalizedById.values()];
}

export function isProductFavorited(favorites, product) {
  const productCandidates = new Set(getFavoriteIdentityCandidates(product));
  return (Array.isArray(favorites) ? favorites : []).some((favorite) =>
    getFavoriteIdentityCandidates(favorite).some((candidate) => productCandidates.has(candidate)),
  );
}

export function toggleProductFavorite(favorites, product) {
  const normalized = normalizeProductFavorites(favorites, [product]);

  if (isProductFavorited(normalized, product)) {
    const productCandidates = new Set(getFavoriteIdentityCandidates(product));
    return normalized.filter((favorite) =>
      !getFavoriteIdentityCandidates(favorite).some((candidate) => productCandidates.has(candidate)),
    );
  }

  const nextFavorite = createProductFavorite(product);
  return nextFavorite ? [...normalized, nextFavorite] : normalized;
}

export function getStoredFavorites(storage, products = []) {
  const raw = storage.getItem(FAVORITES_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalized = normalizeProductFavorites(parsed, products);
    const normalizedRaw = JSON.stringify(normalized);

    if (normalizedRaw !== raw) {
      storage.setItem(FAVORITES_KEY, normalizedRaw);
    }

    return normalized;
  } catch {
    return [];
  }
}

export function saveStoredFavorites(storage, favorites) {
  storage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function getStoredCart(storage) {
  const raw = storage.getItem(CART_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredCart(storage, cart) {
  storage.setItem(CART_KEY, JSON.stringify(cart));
}

export function getStoredCartSelections(storage) {
  const raw = storage.getItem(CART_SELECTIONS_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveStoredCartSelections(storage, selectedIds) {
  storage.setItem(CART_SELECTIONS_KEY, JSON.stringify(Array.isArray(selectedIds) ? selectedIds : []));
}

export function getCartItemTotal(item) {
  const price = Number(item?.price || 0);
  const quantity = Math.max(0, Number(item?.quantity || 0));

  return price * quantity;
}

export function getCartTotals(cart, selectedIds = null) {
  const items = Array.isArray(cart) ? cart : [];
  const selectedItems = Array.isArray(selectedIds) ? items.filter((item) => selectedIds.includes(item?.id)) : items;

  return selectedItems.reduce(
    (totals, item) => {
      const quantity = Math.max(0, Number(item?.quantity || 0));

      totals.distinctItems += 1;
      totals.totalQuantity += quantity;
      totals.totalAmount += getCartItemTotal(item);
      return totals;
    },
    {
      distinctItems: 0,
      totalQuantity: 0,
      totalAmount: 0,
    },
  );
}

export function getStoredAdminProducts(storage) {
  const products = readJsonList(storage, ADMIN_PRODUCTS_KEY, () => getProducts().map(normalizeAdminProduct)).map(normalizeAdminProduct);
  const catalogVersion = storage.getItem(ADMIN_CATALOG_VERSION_KEY);

  if (catalogVersion !== ADMIN_CATALOG_VERSION || !hasCurrentCatalogProducts(products)) {
    return seedAdminProducts(storage);
  }

  return products;
}

export function saveStoredAdminProducts(storage, products) {
  storage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(products));
  storage.setItem(ADMIN_CATALOG_VERSION_KEY, ADMIN_CATALOG_VERSION);
}

export function getStoredMockOrders(storage) {
  const catalogVersion = storage.getItem(ADMIN_CATALOG_VERSION_KEY);

  if (catalogVersion !== ADMIN_CATALOG_VERSION) {
    const seededOrders = getAdminMockOrdersSeed(getStoredAdminProducts(storage));
    storage.setItem(ADMIN_ORDERS_KEY, JSON.stringify(seededOrders));
    return seededOrders;
  }

  return readJsonList(storage, ADMIN_ORDERS_KEY, () => getAdminMockOrdersSeed(getStoredAdminProducts(storage)));
}

export function saveStoredMockOrders(storage, orders) {
  storage.setItem(ADMIN_ORDERS_KEY, JSON.stringify(orders));
  storage.setItem(ADMIN_CATALOG_VERSION_KEY, ADMIN_CATALOG_VERSION);
}

export function getSalesSummary(products, orders) {
  const productMap = getProductLookup(products);
  let totalRevenue = 0;
  let totalUnitsSold = 0;

  for (const order of orders) {
    for (const item of getOrderItems(order)) {
      const quantity = Number(item?.quantity || 0);
      const product = productMap.get(item?.id);
      const price = Number(item?.price ?? product?.price ?? 0);

      totalUnitsSold += quantity;
      totalRevenue += quantity * price;
    }
  }

  return {
    totalRevenue,
    totalOrders: orders.length,
    totalProducts: products.length,
    totalUnitsSold,
  };
}

export function getProductSalesRows(products, orders) {
  const productMap = getProductLookup(products);
  const totals = new Map(products.map((product) => [product.id, { unitsSold: 0, revenue: 0 }]));

  for (const order of orders) {
    for (const item of getOrderItems(order)) {
      const quantity = Number(item?.quantity || 0);
      const product = productMap.get(item?.id);

      if (!product || quantity <= 0) {
        continue;
      }

      const price = Number(item?.price ?? product.price ?? 0);
      const current = totals.get(product.id) || { unitsSold: 0, revenue: 0 };

      current.unitsSold += quantity;
      current.revenue += quantity * price;
      totals.set(product.id, current);
    }
  }

  return products
    .map((product) => {
      const current = totals.get(product.id) || { unitsSold: 0, revenue: 0 };

      return {
        id: product.id,
        name: product.name,
        category: product.category,
        price: Number(product.price) || 0,
        badge: product.badge || '新品',
        image: product.image || '',
        unitsSold: current.unitsSold,
        revenue: current.revenue,
      };
    })
    .sort((left, right) => {
      if (right.unitsSold !== left.unitsSold) {
        return right.unitsSold - left.unitsSold;
      }

      if (right.revenue !== left.revenue) {
        return right.revenue - left.revenue;
      }

      return left.id.localeCompare(right.id);
    });
}

export function renderAdminOrdersView(products, orders) {
  const productMap = getProductLookup(products);

  if (!orders.length) {
    return {
      emptyState: '暂无订单数据',
      rows: [],
    };
  }

  return {
    emptyState: null,
    rows: orders.map((order) => {
      const items = getOrderItems(order);
      const itemNames = items
        .map((item) => item?.name || productMap.get(item?.id)?.name || item?.id || '未知商品')
        .filter(Boolean);
      const fallbackTotal = items.reduce((sum, item) => {
        const quantity = Number(item?.quantity || 0);
        const product = productMap.get(item?.id);
        const price = Number(item?.price ?? product?.price ?? 0);
        return sum + quantity * price;
      }, 0);
      const total = Number.isFinite(Number(order?.totalPrice)) && Number(order?.totalPrice) > 0
        ? Number(order.totalPrice)
        : fallbackTotal;

      return {
        orderNo: order.orderNo || '',
        customerName: order.customerName || '匿名用户',
        itemsLabel: itemNames.join('、'),
        amountLabel: formatCurrency(total),
        status: order.status || '未知',
        createdAt: order.createdAt || '',
      };
    }),
  };
}

export function renderAdminStatsView(summary, productRows) {
  const maxUnits = Math.max(1, ...productRows.map((row) => row.unitsSold || 0));

  return {
    kpis: [
      { label: '总营业额', value: formatCurrency(summary.totalRevenue), detail: `${summary.totalOrders} 笔订单` },
      { label: '总订单数', value: String(summary.totalOrders), detail: '所有 mock 订单' },
      { label: '在售商品', value: String(summary.totalProducts), detail: '含新增新品' },
      { label: '售出件数', value: String(summary.totalUnitsSold), detail: '所有产品销量总和' },
    ],
    rows: productRows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      unitsSold: row.unitsSold,
      unitsLabel: `${row.unitsSold} 件`,
      revenue: row.revenue,
      revenueLabel: formatCurrency(row.revenue),
      barWidth: `${Math.round((row.unitsSold / maxUnits) * 100)}%`,
      })),
  };
}

export function addAdminProduct(storage, draft) {
  const products = getStoredAdminProducts(storage);
  const nextProduct = normalizeAdminProduct(
    {
      id: getNextAdminProductId(products),
      name: String(draft?.name || '').trim(),
      category: String(draft?.category || '').trim(),
      price: Number(draft?.price || 0),
      badge: String(draft?.badge || '新品').trim() || '新品',
      sales: '0',
      image: String(draft?.image || '').trim(),
      detail: String(draft?.detail || '').trim() || '新品上架，先使用预设图库展示。',
      status: '上架中',
      createdAt: '2026-07-05 12:00',
      isCustom: true,
    },
    products.length,
  );

  const nextProducts = [...products, nextProduct];
  saveStoredAdminProducts(storage, nextProducts);
  return nextProducts;
}

export function renderAdminProductsView(products) {
  return {
    emptyState: products.length ? null : '暂无商品数据',
    rows: products.map((product) => ({
      id: product.id,
      name: product.name,
      category: product.category,
      priceLabel: formatCurrency(product.price),
      badge: product.badge || '新品',
      status: product.status || '在售',
      imageLabel: product.image ? product.image.split('/').pop() : '',
      createdAt: product.createdAt || '',
    })),
  };
}

export function buildPurchaseOrder({ product, quantity, paymentMethod, address }) {
  const safeQuantity = Math.max(1, Number(quantity) || 1);
  const unitPrice = Number(product?.price || 0);
  const totalPrice = unitPrice * safeQuantity;
  const now = new Date();

  return {
    orderNo: `BUY-${now.getTime()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    status: '待支付',
    productId: product?.id || '',
    productName: product?.name || '',
    badge: product?.badge || '',
    quantity: safeQuantity,
    paymentMethod,
    address: address ? { ...address } : null,
    totalPrice,
    items: [`${product?.name || '商品'} × ${safeQuantity}`],
    createdAt: formatOrderTimestamp(now),
  };
}

export function renderFavoriteProductItems(favorites, products, emptyState) {
  const favoriteItems = Array.isArray(favorites) ? favorites : [];
  const currentProducts = Array.isArray(products) ? products : [];

  if (!favoriteItems.length) {
    return {
      emptyState,
      items: [],
    };
  }

  return {
    emptyState: null,
    items: favoriteItems.map((favorite) => {
      const currentProduct = findCurrentFavoriteProduct(favorite, currentProducts);
      const source = currentProduct || favorite || {};
      const detail = String(source.detail || '').trim() || '暂无商品介绍';

      return {
        id: String(favorite?.id || ''),
        productId: currentProduct?.productId ?? favorite?.productId ?? favorite?.id ?? '',
        currentProductId: currentProduct?.id || '',
        name: String(source.name || '未命名商品').trim(),
        category: String(source.category || '商品').trim(),
        image: String(source.image || '').trim(),
        detail,
        price: Number(source.price || 0),
        badge: String(source.badge || '').trim(),
        isAvailable: Boolean(currentProduct),
      };
    }),
  };
}

export function renderOrderItems(orders) {
  if (!orders.length) {
    return {
      emptyState: '暂无购买记录',
      items: [],
    };
  }

  return {
    emptyState: null,
    items: orders.map((order) => ({
      orderNo: order.orderNo,
      status: order.status,
      items: order.items,
      totalPrice: order.totalPrice,
      createdAt: order.createdAt,
    })),
  };
}

export function renderSavedProductItems(items, emptyState) {
  if (!items.length) {
    return {
      emptyState,
      items: [],
    };
  }

  return {
    emptyState: null,
    items: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      badge: item.badge || '',
      category: item.category || '',
      quantity: item.quantity || 1,
      image: item.image || '',
    })),
  };
}

