function parseSalesValue(sales) {
  const normalized = String(sales).trim().toLowerCase();

  if (normalized.endsWith('k')) {
    const value = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(value) ? Math.round(value * 1000) : 0;
  }

  const value = Number.parseInt(normalized, 10);
  return Number.isFinite(value) ? value : 0;
}

export function getSalesRankMap(products) {
  const sorted = [...products].sort((left, right) => {
    const diff = parseSalesValue(right.sales) - parseSalesValue(left.sales);
    if (diff !== 0) {
      return diff;
    }
    return left.id.localeCompare(right.id);
  });

  return new Map(sorted.map((product, index) => [product.id, index + 1]));
}

export function formatSalesRank(rank) {
  return `销量第${rank}名`;
}
