# Cloth Shop Requirements Matrix

| ID | Requirement | Implementation | Automated evidence | DB/API evidence | UI evidence | Status |
| --- | --- | --- | --- | --- | --- | --- |
| R1 | Product description | `11_catalog_metadata_favorites_tags.sql` adds `product.description` and exposes it through the view | migration contract tests | live DB blocked by `ERROR 1045` | pending | PARTIAL |
| R2 | Product image management | sorted return and transactional main/sort synchronization | Phase02 and legacy image tests | live DB blocked | pending | PARTIAL |
| R3 | New SKU default stock | omitted stock 50; explicit 0 preserved | Phase02 contract test | live DB blocked | pending | PARTIAL |
| R4 | Product-level favorites | `product_favorite` with unique user/product key | migration contract tests | live DB blocked by `ERROR 1045` | pending | PARTIAL |
| R5 | SKU-level cart | pending | baseline cart tests pass | pending | pending | PENDING |
| R6 | Checkout confirmation | order creation retained with buyer remark persistence | Phase02 and legacy order tests | live DB blocked | pending | PARTIAL |
| R7 | Decoupled payment | payment locks state and returns idempotently for paid orders | Phase02 contract test | live DB blocked | pending | PARTIAL |
| R8 | Buyer remark | adds `order_main.buyer_remark` without rewriting orders | migration contract tests | live DB blocked by `ERROR 1045` | pending | PARTIAL |
| R9 | Availability state | pending | baseline availability tests pass | pending | pending | PENDING |
| R10 | Shared product details | pending | pending | pending | pending | PENDING |
| R11 | Responsive close controls | pending | pending | pending | pending | PENDING |
| R12 | Favorite/cart visual state | pending | pending | pending | pending | PENDING |
| R13 | Favorite/cart badges | pending | pending | pending | pending | PENDING |
| R14 | Multi-image lightbox | pending | baseline gallery tests pass | pending | pending | PENDING |
| R15 | Operation log | creates or safely extends non-sensitive operation metadata | migration contract tests | live DB blocked by `ERROR 1045` | pending | PARTIAL |
| R16 | Simplified footer | pending | pending | pending | pending | PENDING |
| R17 | Simplified products heading | pending | pending | pending | pending | PENDING |
| R18 | Categories and multiple tags | protected uncategorized, six seeds, tag and relation tables, tag-aware view | migration contract tests | live DB blocked by `ERROR 1045` | pending | PARTIAL |
| R19 | Promotional copy | pending | pending | pending | pending | PENDING |

Rows move to `PASS`, `PARTIAL`, or `BLOCKED` only with concrete implementation and verification evidence.
