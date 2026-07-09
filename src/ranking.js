export function parseSalesValue(sales) {
  const normalized = String(sales).trim().toLowerCase();

  if (normalized.endsWith('k')) {
    const value = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(value) ? Math.round(value * 1000) : 0;
  }

  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? value : 0;
}

export function compareProductsBySales(left, right) {
  const salesDiff = parseSalesValue(right?.sales) - parseSalesValue(left?.sales);
  if (salesDiff !== 0) {
    return salesDiff;
  }

  const leftProductId = Number(left?.productId);
  const rightProductId = Number(right?.productId);

  if (Number.isFinite(leftProductId) && Number.isFinite(rightProductId) && leftProductId !== rightProductId) {
    return leftProductId - rightProductId;
  }

  return String(left?.id ?? '').localeCompare(String(right?.id ?? ''));
}

export function getSalesRankMap(products) {
  const sorted = [...products].sort(compareProductsBySales);

  return new Map(sorted.map((product, index) => [product.id, index + 1]));
}

export function formatSalesRank(rank) {
  return `销量第${rank}名`;
}
