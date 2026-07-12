export function normalizeDimensionValues(value) {
  const source = Array.isArray(value) ? value : String(value ?? '').split(/[\n,，]+/);
  const result = [];
  const seen = new Set();

  source.forEach((item) => {
    const normalized = String(item ?? '').trim();
    const key = normalized.toLocaleLowerCase();

    if (!normalized || seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

export function createSkuDimensionKey(color, size) {
  return JSON.stringify([String(color ?? '').trim(), String(size ?? '').trim()]);
}

function compactCodePart(value, fallback) {
  const ascii = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  if (ascii) {
    return ascii;
  }

  let hash = 0;
  for (const character of String(value ?? '')) {
    hash = ((hash * 31) + character.codePointAt(0)) >>> 0;
  }
  return hash ? `${fallback}-${hash.toString(36).toUpperCase()}` : fallback;
}

export function buildSuggestedSkuCode(productName, color, size) {
  const productPart = compactCodePart(productName, 'PRODUCT');
  const colorPart = compactCodePart(color, 'COLOR');
  const sizePart = compactCodePart(size, 'SIZE');

  return `${productPart}-${colorPart}-${sizePart}`.slice(0, 100);
}

export function buildSkuMatrix(colorsValue, sizesValue, previousRows = [], defaults = {}) {
  const colors = normalizeDimensionValues(colorsValue);
  const sizes = normalizeDimensionValues(sizesValue);
  const previousMap = new Map(
    (Array.isArray(previousRows) ? previousRows : []).map((row) => [
      row.key || createSkuDimensionKey(row.color, row.size),
      row,
    ]),
  );

  return colors.flatMap((color) => sizes.map((size) => {
    const key = createSkuDimensionKey(color, size);
    const previous = previousMap.get(key);

    if (previous) {
      return { ...previous, key, color, size };
    }

    return {
      key,
      color,
      size,
      sku_code: buildSuggestedSkuCode(defaults.productName, color, size),
      sku_name: `${color} / ${size}`,
      price: Number(defaults.price || 0),
      stock: Number(defaults.stock || 0),
      on_sale: defaults.onSale === 0 ? 0 : 1,
    };
  }));
}

export function isStructuredSku(sku) {
  return Boolean(String(sku?.color ?? '').trim() && String(sku?.size ?? '').trim());
}

function isDeletedSku(sku) {
  return Number(sku?.skuIsDeleted ?? sku?.sku_is_deleted ?? 0) === 1;
}

function isSaleStatus(value, fallbackOnSale) {
  if (fallbackOnSale === 0 || fallbackOnSale === false || fallbackOnSale === '0') return false;
  return String(value || 'ON_SALE').trim().toUpperCase() === 'ON_SALE';
}

function getProductSkuList(product) {
  return Array.isArray(product?.skuList) ? product.skuList : [];
}

export function isStructuredProduct(product) {
  const activeSkus = getProductSkuList(product).filter((sku) => !isDeletedSku(sku));
  return activeSkus.length > 0 && activeSkus.every(isStructuredSku);
}

export function isStructuredSkuSellable(product, sku) {
  const productOnSale = isSaleStatus(product?.productStatus || product?.status, product?.on_sale);
  const skuOnSale = isSaleStatus(sku?.skuStatus || sku?.status, sku?.on_sale);
  return productOnSale && !isDeletedSku(sku) && skuOnSale && Number(sku?.availableStock ?? sku?.stock ?? 0) > 0;
}

export function getSellableStructuredSkus(product) {
  if (!isStructuredProduct(product)) return [];
  return getProductSkuList(product).filter((sku) => isStructuredSkuSellable(product, sku));
}

export function getDimensionOptions(product, selection = {}, dimension) {
  if (!['color', 'size'].includes(dimension) || !isStructuredProduct(product)) return [];

  const otherDimension = dimension === 'color' ? 'size' : 'color';
  const otherValue = String(selection?.[otherDimension] ?? '').trim();
  const allValues = normalizeDimensionValues(
    getProductSkuList(product)
      .filter((sku) => !isDeletedSku(sku) && isStructuredSku(sku))
      .map((sku) => sku[dimension]),
  );
  const sellableSkus = getSellableStructuredSkus(product);

  return allValues.map((value) => ({
    value,
    disabled: !sellableSkus.some((sku) => (
      sku[dimension] === value && (!otherValue || sku[otherDimension] === otherValue)
    )),
  }));
}

export function selectSkuDimension(product, selection = {}, dimension, value) {
  const next = {
    color: String(selection?.color ?? '').trim() || null,
    size: String(selection?.size ?? '').trim() || null,
    skuId: null,
  };

  if (!['color', 'size'].includes(dimension)) return next;

  next[dimension] = String(value ?? '').trim() || null;
  const otherDimension = dimension === 'color' ? 'size' : 'color';
  const sellableSkus = getSellableStructuredSkus(product);

  if (next[otherDimension]) {
    const hasCombination = sellableSkus.some((sku) => (
      sku[dimension] === next[dimension] && sku[otherDimension] === next[otherDimension]
    ));
    if (!hasCombination) next[otherDimension] = null;
  }

  if (next.color && next.size) {
    const selectedSku = sellableSkus.find((sku) => sku.color === next.color && sku.size === next.size);
    next.skuId = selectedSku ? Number(selectedSku.skuId ?? selectedSku.id) : null;
  }
  return next;
}

export function getInitialSkuSelection(product) {
  let selection = { color: null, size: null, skuId: null };
  const colors = getDimensionOptions(product, selection, 'color').filter((option) => !option.disabled);
  const sizes = getDimensionOptions(product, selection, 'size').filter((option) => !option.disabled);

  if (colors.length === 1) selection = selectSkuDimension(product, selection, 'color', colors[0].value);
  if (sizes.length === 1) selection = selectSkuDimension(product, selection, 'size', sizes[0].value);
  return selection;
}

export function getMissingSkuCombinations(existingRows, colorsValue, sizesValue, defaults = {}) {
  const existingKeys = new Set(
    (Array.isArray(existingRows) ? existingRows : [])
      .filter(isStructuredSku)
      .map((row) => createSkuDimensionKey(row.color, row.size)),
  );

  return buildSkuMatrix(colorsValue, sizesValue, [], defaults)
    .filter((row) => !existingKeys.has(row.key));
}
