export const ALL_TAG_KEY = 'all-tags';
export const MAX_PRODUCT_TAGS = 5;

export function normalizeTagName(value) {
  return String(value ?? '').trim();
}

export function createApiTagKey(tagId) {
  return `tag:${Number(tagId)}`;
}

export function createStaticTagKey(name) {
  return `static-tag:${normalizeTagName(name)}`;
}

export function normalizeApiTag(row) {
  const tagId = Number(row?.tag_id ?? row?.tagId);
  const name = normalizeTagName(row?.tag_name ?? row?.name);

  if (!Number.isInteger(tagId) || tagId <= 0 || !name) {
    return null;
  }

  return {
    tagId,
    name,
    sortOrder: Number(row?.sort_order ?? row?.sortOrder ?? 0) || 0,
    isDeleted: Number(row?.is_deleted ?? row?.isDeleted ?? 0) === 1 ? 1 : 0,
    productCount: Math.max(0, Number(row?.product_count ?? row?.productCount ?? 0) || 0),
    onSaleProductCount: Math.max(0, Number(row?.on_sale_product_count ?? row?.onSaleProductCount ?? 0) || 0),
    createdAt: row?.created_at ?? row?.createdAt ?? '',
    updatedAt: row?.updated_at ?? row?.updatedAt ?? '',
    key: createApiTagKey(tagId),
  };
}

export function compareTags(left, right) {
  return Number(left?.sortOrder || 0) - Number(right?.sortOrder || 0)
    || String(left?.name || '').localeCompare(String(right?.name || ''), 'zh-CN')
    || Number(left?.tagId || 0) - Number(right?.tagId || 0);
}

export function normalizeApiTags(rows, { preserveInputOrder = false } = {}) {
  const tagsById = new Map();

  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const tag = normalizeApiTag(row);
    if (tag && !tagsById.has(tag.tagId)) {
      tagsById.set(tag.tagId, tag);
    }
  });

  const normalized = [...tagsById.values()];
  return preserveInputOrder
    ? normalized
    : normalized.sort((left, right) => left.isDeleted - right.isDeleted || compareTags(left, right));
}

export function normalizeProductTags(rows, options = {}) {
  return normalizeApiTags(rows, options).filter((tag) => tag.isDeleted === 0);
}

export function createStaticProductTags(badge) {
  const name = normalizeTagName(badge);
  if (!name) {
    return [];
  }

  return [{
    tagId: null,
    name,
    sortOrder: 0,
    isDeleted: 0,
    productCount: 0,
    onSaleProductCount: 0,
    key: createStaticTagKey(name),
    isStatic: true,
  }];
}

export function deriveApiTagsFromProducts(products) {
  const tagsById = new Map();

  (Array.isArray(products) ? products : []).forEach((product) => {
    normalizeProductTags(product?.tags).forEach((tag) => {
      const existing = tagsById.get(tag.tagId);
      if (existing) {
        existing.productCount += 1;
        if (String(product?.productStatus || product?.status || '').toUpperCase() === 'ON_SALE') {
          existing.onSaleProductCount += 1;
        }
        return;
      }

      tagsById.set(tag.tagId, {
        ...tag,
        productCount: 1,
        onSaleProductCount: String(product?.productStatus || product?.status || '').toUpperCase() === 'ON_SALE' ? 1 : 0,
      });
    });
  });

  return [...tagsById.values()].sort(compareTags);
}

export function createStaticTagsFromProducts(products) {
  const tagsByKey = new Map();

  (Array.isArray(products) ? products : []).forEach((product) => {
    const staticTags = Array.isArray(product?.tags) && product.tags.length
      ? product.tags.filter((tag) => tag?.isStatic || tag?.tagId == null)
      : createStaticProductTags(product?.badge);
    staticTags.forEach((tag) => {
      const normalized = createStaticProductTags(tag?.name)[0];
      if (!normalized) return;
      const existing = tagsByKey.get(normalized.key);
      if (existing) {
        existing.productCount += 1;
      } else {
        tagsByKey.set(normalized.key, { ...normalized, productCount: 1 });
      }
    });
  });

  return [...tagsByKey.values()].sort(compareTags);
}

export function resolveActiveTagKey(activeKey, tags) {
  if (activeKey === ALL_TAG_KEY) {
    return ALL_TAG_KEY;
  }

  return (Array.isArray(tags) ? tags : []).some((tag) => tag?.key === activeKey)
    ? activeKey
    : ALL_TAG_KEY;
}

export function filterProductsByTag(products, activeKey = ALL_TAG_KEY) {
  const source = Array.isArray(products) ? products : [];
  if (!activeKey || activeKey === ALL_TAG_KEY) {
    return [...source];
  }

  const apiMatch = /^tag:(\d+)$/.exec(String(activeKey));
  return source.filter((product) => {
    const tags = Array.isArray(product?.tags) ? product.tags : [];
    if (apiMatch) {
      return tags.some((tag) => Number(tag?.tagId) === Number(apiMatch[1]));
    }
    return tags.some((tag) => String(tag?.key || createStaticTagKey(tag?.name)) === activeKey);
  });
}

export function getVisibleProductTags(tags, limit = 3) {
  const normalized = Array.isArray(tags) ? tags.filter((tag) => normalizeTagName(tag?.name)) : [];
  const safeLimit = Math.max(0, Number(limit) || 0);
  return {
    visible: normalized.slice(0, safeLimit),
    overflowCount: Math.max(0, normalized.length - safeLimit),
  };
}
