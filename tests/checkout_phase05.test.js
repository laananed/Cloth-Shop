import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../backend/app/main.py', import.meta.url), 'utf8');
test('purchase modal embeds remark order number and six digit payment UI', () => {
  for (const hook of ['data-purchase-buyer-remark', 'data-purchase-order-number', 'data-purchase-pay-password']) assert.ok(html.includes(hook));
  assert.match(js, /pendingPurchaseOrderId/);
  assert.match(js, /^\s*if \(!\/\^\\d\{6\}\$\/\.test\(payPassword\)\)/m);
});
test('direct order creation and payment are separate submit stages', () => {
  assert.ok(js.includes('await createDirectOrderFromApi'));
  assert.ok(js.includes('await payOrderFromApi(pendingPurchaseOrderId'));
  assert.match(js, /pendingPurchaseOrderId = Number\(orderResult\.order_id\)/);
});
test('buyer remark is trimmed to 200 and backend accepts at most 200', () => {
  assert.match(js, /\.trim\(\)\.slice\(0, 200\)/);
  assert.match(backend, /buyer_remark: str \| None = Field\(None, max_length=200\)/);
});
test('payment endpoint retains row lock and paid idempotency', () => {
  assert.match(backend, /FOR UPDATE/);
  assert.match(backend, /order_state\["status"\] == "PAID"/);
});
test('selected cart checkout has separate create and embedded payment stages', () => {
  assert.match(js, /pendingCartOrderId/);
  assert.match(js, /data-cart-pay-password/);
  assert.match(js, /pendingCartOrderId = Number\(orderResult\.order_id\)/);
  assert.match(js, /await payOrderFromApi\(pendingCartOrderId/);
});
