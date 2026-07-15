export const ALL_CATEGORY_KEY = 'all';

export function createApiCategoryKey(categoryId) {
  return `category:${Number(categoryId)}`;
}

export function createStaticCategoryKey(name) {
  return `static:${String(name || '').trim()}`;
}

export function normalizeApiCategory(row) {
  const categoryId = Number(row?.category_id ?? row?.categoryId);
  const name = String(row?.category_name ?? row?.name ?? '').trim();
  const sortOrder = Number(row?.sort_order ?? row?.sortOrder ?? 0);
  const productCount = Number(row?.product_count ?? row?.productCount ?? 0);
  const onSaleProductCount = Number(row?.on_sale_product_count ?? row?.onSaleProductCount ?? 0);
  const offSaleProductCount = Number(row?.off_sale_product_count ?? row?.offSaleProductCount ?? 0);

  return {
    categoryId,
    name,
    sortOrder,
    productCount,
    onSaleProductCount,
    offSaleProductCount,
    isDeleted: Number(row?.is_deleted ?? row?.isDeleted ?? 0),
    createdAt: row?.created_at ?? row?.createdAt ?? null,
    key: createApiCategoryKey(categoryId),
    source: 'api',
  };
}

export function compareCategories(left, right) {
  return Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0)
    || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN')
    || Number(left?.categoryId || 0) - Number(right?.categoryId || 0);
}

export function normalizeApiCategories(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map(normalizeApiCategory)
    .filter((item) => Number.isInteger(item.categoryId) && item.categoryId > 0 && item.name)
    .sort(compareCategories);
}

export function deriveApiCategoriesFromProducts(products) {
  const categoryMap = new Map();

  (Array.isArray(products) ? products : []).forEach((product) => {
    const categoryId = Number(product?.categoryId);
    const name = String(product?.category || '').trim();
    if (!Number.isInteger(categoryId) || categoryId <= 0 || !name) return;

    const existing = categoryMap.get(categoryId);
    if (existing) {
      existing.productCount += 1;
      if (String(product?.productStatus || '').toUpperCase() === 'ON_SALE') existing.onSaleProductCount += 1;
      else existing.offSaleProductCount += 1;
      return;
    }

    categoryMap.set(categoryId, {
      categoryId,
      name,
      sortOrder: 0,
      productCount: 1,
      onSaleProductCount: String(product?.productStatus || '').toUpperCase() === 'ON_SALE' ? 1 : 0,
      offSaleProductCount: String(product?.productStatus || '').toUpperCase() === 'ON_SALE' ? 0 : 1,
      isDeleted: 0,
      createdAt: null,
      key: createApiCategoryKey(categoryId),
      source: 'api',
    });
  });

  return Array.from(categoryMap.values()).sort(compareCategories);
}

export function createStaticCategories(collections, products = []) {
  const counts = new Map();
  (Array.isArray(products) ? products : []).forEach((product) => {
    const name = String(product?.category || '').trim();
    if (name) counts.set(name, Number(counts.get(name) || 0) + 1);
  });

  return (Array.isArray(collections) ? collections : [])
    .map((collection, index) => {
      const name = String(collection?.title ?? collection?.name ?? '').trim();
      return {
        categoryId: null,
        name,
        sortOrder: index,
        productCount: Number(counts.get(name) || 0),
        onSaleProductCount: 0,
        offSaleProductCount: 0,
        isDeleted: 0,
        createdAt: null,
        key: createStaticCategoryKey(name),
        source: 'static',
      };
    })
    .filter((item) => item.name);
}

export function resolveActiveCategoryKey(activeKey, categories) {
  if (activeKey === ALL_CATEGORY_KEY) return ALL_CATEGORY_KEY;
  return (Array.isArray(categories) ? categories : []).some((category) => category.key === activeKey)
    ? activeKey
    : ALL_CATEGORY_KEY;
}

export function filterProductsByCategory(products, activeKey = ALL_CATEGORY_KEY, keyword = '', getSearchText) {
  const normalizedKeyword = String(keyword || '').trim().toLowerCase();
  const apiMatch = /^category:(\d+)$/.exec(String(activeKey || ''));
  const staticMatch = /^static:(.*)$/.exec(String(activeKey || ''));

  return (Array.isArray(products) ? products : []).filter((product) => {
    const matchesCategory = activeKey === ALL_CATEGORY_KEY
      || (apiMatch && Number(product?.categoryId) === Number(apiMatch[1]))
      || (staticMatch && String(product?.category || '') === staticMatch[1]);
    const searchText = typeof getSearchText === 'function'
      ? getSearchText(product)
      : `${product?.name || ''} ${product?.category || ''}`.toLowerCase();
    return Boolean(matchesCategory) && (!normalizedKeyword || String(searchText).toLowerCase().includes(normalizedKeyword));
  });
}
