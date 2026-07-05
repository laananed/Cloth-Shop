const PROFILE_KEY = 'blue-song-profile';
const ORDERS_KEY = 'blue-song-orders';
const FAVORITES_KEY = 'blue-song-favorites';
const CART_KEY = 'blue-song-cart';

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

export function getStoredFavorites(storage) {
  const raw = storage.getItem(FAVORITES_KEY);
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
