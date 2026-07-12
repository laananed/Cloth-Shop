import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const js = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('favorites use product-level database API and one-time legacy migration', () => {
  assert.match(js, /syncFavoritesFromApi/);
  assert.match(js, /migrateLegacyFavoritesToApi/);
  assert.match(js, /\/favorites\/user\/\$\{CURRENT_USER_ID\}/);
  assert.match(js, /product_id: Number\(product\.productId\)/);
  assert.doesNotMatch(js, /favoriteId = `\$\{product\.id\}-sku-/);
});

test('favorite and cart badges count distinct products and SKU rows', () => {
  assert.ok(html.includes('data-sidebar-badge="favorites"'));
  assert.ok(html.includes('data-sidebar-badge="cart"'));
  assert.match(js, /formatSidebarBadgeCount/);
  assert.match(js, /new Set\(favorites\.map/);
  assert.match(js, /cart\.length/);
  assert.match(js, /99\+/);
});

test('favorite and cart visual states are independent', () => {
  assert.match(js, /is-product-favorite/);
  assert.match(js, /is-product-in-cart/);
  assert.match(js, /favorite.*red|red.*favorite/i);
  assert.match(js, /cart.*yellow|yellow.*cart/i);
});

test('successful favorite and cart actions do not open sidebar automatically', () => {
  assert.match(js, /upsertFavorite\(activePurchaseProduct[^\n]*openSidebarAfterSuccess: false/);
  assert.match(js, /addCartToApi\(activePurchaseProduct[^\n]*openSidebarAfterSuccess: false/);
});

test('all modal and sidebar close controls are wired', () => {
  assert.ok((html.match(/data-purchase-close/g) || []).length >= 2);
  assert.ok((html.match(/data-menu-close/g) || []).length >= 2);
  assert.match(js, /purchaseCloseButtons\.forEach/);
  assert.match(js, /menuCloseButtons\.forEach/);
});
