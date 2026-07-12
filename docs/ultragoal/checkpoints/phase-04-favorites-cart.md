# Phase 04 - Favorites and Cart

Status: COMPLETE_WITH_LIMITATION

- Favorites now write and resync through the product-level database API.
- A one-time marker migrates distinct legacy favorite product IDs before DB-authoritative refresh.
- Cart remains SKU-row based through existing database endpoints and shared purchase SKU selection.
- Favorite and cart badges hide at zero, count distinct products/SKU rows, and cap at `99+`.
- Favorite red state and cart yellow state are independent.
- Successful purchase-modal favorite/cart actions retain `openSidebarAfterSuccess: false`.
- Sidebar/backdrop and purchase-modal/backdrop close controls remain wired.

TDD RED: 3/5 new tests failed before implementation. GREEN and full regression are recorded in the phase commit. Live DB/browser verification remains blocked by MySQL credentials.
