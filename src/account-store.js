const PROFILE_KEY = 'blue-song-profile';
const ORDERS_KEY = 'blue-song-orders';
const FAVORITES_KEY = 'blue-song-favorites';
const CART_KEY = 'blue-song-cart';

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

export function renderOrderItems(orders) {
  if (!orders.length) {
    return {
      emptyState: '鏆傛棤璐拱璁板綍',
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
