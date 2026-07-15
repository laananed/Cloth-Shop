import { compareProductsBySales } from './ranking.js';

function normalizeStatus(status) {
  return String(status || '').trim().toUpperCase();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDeletedSku(sku) {
  return Number(sku?.skuIsDeleted ?? sku?.sku_is_deleted ?? sku?.isDeleted ?? sku?.is_deleted ?? 0) === 1;
}

function resolveExplicitSaleStatus(value, fallbackFlag) {
  const status = normalizeStatus(value);

  if (status) {
    if (status === 'ON_SALE' || status === 'AVAILABLE') return true;
    if (status === 'OFF_SALE' || status === 'SOLD_OUT' || status === 'OUT_OF_STOCK') return false;
    return false;
  }

  if (fallbackFlag === undefined || fallbackFlag === null || fallbackFlag === '') {
    return null;
  }

  return fallbackFlag === true || fallbackFlag === 1 || fallbackFlag === '1';
}

export function resolveProductAvailabilityState(product) {
  const productStatusValue = product?.productStatus
    ?? product?.product_status
    ?? product?.status
    ?? product?.saleState
    ?? product?.sale_state;
  const normalizedProductStatus = normalizeStatus(productStatusValue);
  const productOnSale = resolveExplicitSaleStatus(
    productStatusValue,
    product?.onSale ?? product?.on_sale,
  );

  if (normalizedProductStatus === 'SOLD_OUT' || normalizedProductStatus === 'OUT_OF_STOCK') {
    return 'SOLD_OUT';
  }

  if (productOnSale === false) {
    return 'OFF_SALE';
  }

  if (productOnSale === null) {
    return 'AVAILABLE';
  }

  const skuList = Array.isArray(product?.skuList) ? product.skuList : [];
  const onSaleSkus = skuList.filter((sku) => {
    if (isDeletedSku(sku)) {
      return false;
    }

    const skuOnSale = resolveExplicitSaleStatus(
      sku?.skuStatus ?? sku?.sku_status ?? sku?.status,
      sku?.onSale ?? sku?.on_sale,
    );
    return skuOnSale !== false;
  });

  if (!onSaleSkus.length) {
    return 'OFF_SALE';
  }

  return onSaleSkus.some((sku) => toNumber(sku?.availableStock ?? sku?.available_stock ?? sku?.stock) > 0)
    ? 'AVAILABLE'
    : 'SOLD_OUT';
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
  return resolveProductAvailabilityState(product) === 'AVAILABLE';
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
    if (isDeletedSku(sku)) {
      return maxTime;
    }

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
