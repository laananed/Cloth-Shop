import assert from 'node:assert/strict'; import fs from 'node:fs'; import test from 'node:test';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'); const js=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
test('shared details and lightbox shells exist once',()=>{assert.equal((html.match(/data-product-detail-modal/g)||[]).length,1); assert.equal((html.match(/data-product-lightbox/g)||[]).length,1); assert.match(js,/openProductDetailModal/);});
test('database description is the storefront detail source',()=>{assert.match(js,/detail: row\.description/); assert.match(js,/data-product-detail-launch/);});
test('lightbox supports navigation wrap counter keyboard overlay and focus restore',()=>{for(const token of ['lightboxImageIndex','data-lightbox-next','data-lightbox-prev','data-lightbox-counter','ArrowRight','ArrowLeft','event.key === \'Escape\'','previousLightboxFocus','has-lightbox']) assert.ok(js.includes(token),token);});
test('single image hides arrows and image failure uses placeholder',()=>{assert.match(js,/lightboxImages\.length <= 1/); assert.match(js,/data:image\/svg\+xml/);});
test('availability overlays are mutually exclusive',()=>{assert.match(js,/product-card__state--\$\{productState\.key\.toLowerCase\(\)\}/); assert.match(js,/productState\.key !== "OFF_SALE"/); assert.match(js,/openProductDetailModal\(product\)/);});
