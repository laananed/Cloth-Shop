# Phase 05 - Checkout and Payment

Status: COMPLETE_WITH_LIMITATION

- Direct-buy and selected-cart checkout now create an unpaid order on the first submit and expose the generated order number.
- Payment is a separate second submit using embedded 6-digit numeric password controls.
- Submission guards prevent duplicate order creation and concurrent payment requests.
- Buyer remarks are trimmed to 200 characters and sent to all relevant order-creation APIs; backend validation matches.
- Existing row-lock and already-paid idempotency checks remain in the payment endpoint.
- After successful payment, products, orders, cart, selections, and badges refresh through existing APIs.
- Pending orders retain the existing order-center continue-payment action; address, cancel, refund, and order-detail paths are unchanged.

TDD RED: 3/4 initial checkout contracts failed. GREEN: direct checkout 4/4, expanded cart checkout 5/5, and full regression 106/106 passed. Live DB/browser execution remains blocked by MySQL `ERROR 1045`.
