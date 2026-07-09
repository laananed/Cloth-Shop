import { compareProductsBySales } from './ranking.js';

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseDateTimeValue(value) {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const text = String(value || '').trim();
  if (!text) {
    return 0;
  }

  const time = Date.parse(text);
  return Number.isFinite(time) ? time : 0;
}

export function isProductSellable(product) {
  const productStatus = normalizeStatus(product?.productStatus || product?.status);
  const skuList = Array.isArray(product?.skuList) ? product.skuList : [];

  if (!productStatus) {
    return true;
  }

  if (productStatus !== 'ON_SALE') {
    return false;
  }

  if (!skuList.length) {
    return true;
  }

  return skuList.some((sku) => {
    const skuStatus = normalizeStatus(sku?.skuStatus || sku?.status);
    return skuStatus === 'ON_SALE' && toNumber(sku?.availableStock ?? sku?.available_stock) > 0;
  });
}

export function getProductUnavailableAt(product) {
  const productStatus = normalizeStatus(product?.productStatus || product?.status);
  const productUpdatedAt = parseDateTimeValue(product?.productUpdatedAt || product?.product_updated_at || product?.updatedAt || product?.updated_at);

  if (productStatus === 'OFF_SALE') {
    return productUpdatedAt;
  }

  if (productStatus !== 'ON_SALE') {
    return productUpdatedAt;
  }

  const skuList = Array.isArray(product?.skuList) ? product.skuList : [];
  const inventoryUpdatedAt = skuList.reduce((maxTime, sku) => {
    const skuStatus = normalizeStatus(sku?.skuStatus || sku?.status);
    if (skuStatus !== 'ON_SALE') {
      return maxTime;
    }

    const stock = toNumber(sku?.availableStock ?? sku?.available_stock);
    if (stock > 0) {
      return maxTime;
    }

    const skuUpdatedAt = parseDateTimeValue(sku?.inventoryUpdatedAt || sku?.inventory_updated_at);
    return Math.max(maxTime, skuUpdatedAt);
  }, 0);

  if (inventoryUpdatedAt > 0) {
    return inventoryUpdatedAt;
  }

  return productUpdatedAt;
}

export function compareProductsForCustomer(left, right) {
  const leftSellable = isProductSellable(left);
  const rightSellable = isProductSellable(right);

  if (leftSellable !== rightSellable) {
    return leftSellable ? -1 : 1;
  }

  if (leftSellable) {
    return compareProductsBySales(left, right);
  }

  const unavailableDiff = getProductUnavailableAt(left) - getProductUnavailableAt(right);
  if (unavailableDiff !== 0) {
    return unavailableDiff;
  }

  const leftProductId = Number(left?.productId);
  const rightProductId = Number(right?.productId);
  if (Number.isFinite(leftProductId) && Number.isFinite(rightProductId) && leftProductId !== rightProductId) {
    return leftProductId - rightProductId;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}
