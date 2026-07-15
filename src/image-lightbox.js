function normalizeImageUrl(value, apiBaseUrl = '') {
  const rawUrl = typeof value === 'string' ? value.trim() : '';

  if (!rawUrl) {
    return '';
  }

  if (rawUrl.startsWith('/') && apiBaseUrl) {
    return `${String(apiBaseUrl).replace(/\/$/, '')}${rawUrl}`;
  }

  return rawUrl;
}

export function normalizeLightboxImages(product, apiBaseUrl = '') {
  const sourceImages = Array.isArray(product?.images)
    ? product.images
    : Array.isArray(product?.product_images)
      ? product.product_images
      : [];
  const fallbackUrl = normalizeImageUrl(product?.image_url || product?.image, apiBaseUrl);
  const candidates = [
    ...sourceImages,
    ...(fallbackUrl ? [{ image_url: fallbackUrl, is_main: 1, sort_order: 0 }] : []),
  ];
  const seen = new Set();

  return candidates
    .map((candidate, originalIndex) => {
      const source = typeof candidate === 'string' ? { image_url: candidate } : candidate;
      const imageUrl = normalizeImageUrl(source?.image_url, apiBaseUrl);

      if (!imageUrl || seen.has(imageUrl)) {
        return null;
      }

      seen.add(imageUrl);
      const sortOrder = Number(source?.sort_order);

      return {
        id: source?.id ?? null,
        image_url: imageUrl,
        is_main: Number(Boolean(Number(source?.is_main)) || imageUrl === fallbackUrl),
        sort_order: Number.isFinite(sortOrder) ? sortOrder : originalIndex,
        originalIndex,
      };
    })
    .filter(Boolean)
    .sort((left, right) => right.is_main - left.is_main || left.originalIndex - right.originalIndex)
    .map(({ originalIndex, ...image }) => image);
}

export function resolveLightboxIndex(images, selectedUrl) {
  if (!Array.isArray(images) || images.length === 0) {
    return 0;
  }

  const normalizedSelectedUrl = typeof selectedUrl === 'string' ? selectedUrl.trim() : '';
  const selectedIndex = images.findIndex((image) => image?.image_url === normalizedSelectedUrl);
  return selectedIndex >= 0 ? selectedIndex : 0;
}

export function wrapLightboxIndex(imageCount, index) {
  const count = Math.max(0, Math.trunc(Number(imageCount) || 0));

  if (count <= 1) {
    return 0;
  }

  const nextIndex = Math.trunc(Number(index) || 0);
  return ((nextIndex % count) + count) % count;
}

export function createImageLightboxState({
  product = null,
  selectedUrl = '',
  sourceElement = null,
  apiBaseUrl = '',
} = {}) {
  const images = normalizeLightboxImages(product, apiBaseUrl);
  const isOpen = images.length > 0;

  return {
    isOpen,
    images,
    index: isOpen ? resolveLightboxIndex(images, selectedUrl) : 0,
    context: String(product?.name || '').trim(),
    sourceElement,
    loading: isOpen,
    error: false,
    requestId: 0,
  };
}
