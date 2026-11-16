# Phase 14 and 14.1 purchase-order contract

Order statuses are `draft`, `awaiting_receipt`, `partially_received`, `completed`, and `cancelled`. A completed order records `fully_received` or `closed_unfulfilled`. A draft is not an order and does not change stock. A partial order cannot be cancelled. Closing the open balance does not receive it.

The order total is the sum of the agreed purchase prices. VAT is not added or removed. Null stays unknown.
Supplier prices have no defined VAT basis, so the order screen shows one labeled total and does not invent a before-VAT or VAT split.

A receipt resolves one catalog product by id, then by a unique barcode, then by brand, model, size, load index and speed rating together. Brand and size alone do not match. A repeated receipt key does not add quantity again. Stock, the movement, the order balance and the FIFO lot are one transaction in `post_purchase_receipt`. Opening stock stays undated.

Order persistence does not require FIFO lots. Physical receiving still does: employees, then `fifo-inventory-lots.UNAPPLIED.sql`, then a grant on `post_purchase_receipt`. See Phase 15A below. Do not also call `record_purchase_receipt` for that same receipt. Salesperson SQL is independent. Both purchase flags stay false.

# Phase 14 receiving contract

A purchase request is not a purchase order. A purchase order is not stock. A supplier payment and an import milestone are not a receipt.

The stored purchase unit cost is the receipt price. It is not converted to another VAT basis on this screen. Null stays unknown. Zero stays zero. A receipt total is unknown when any received line has an unknown cost.

Full receiving uses the open quantity, not the original ordered quantity. Each delivery is separate. The order stays open until every line is received or the remaining balance is closed. Closing that balance does not increase stock.

`PURCHASE_ORDERS_READY` and `PURCHASE_RECEIPT_ATOMIC_READY` stay false. The screen does not call `record_purchase_receipt` and does not create a FIFO lot. A draft is not a receipt.

`docs/v2/purchase-order-receipts.UNAPPLIED.sql` is not applied. It does not change `products.quantity`.

# Phase 15A order persistence

`PURCHASE_ORDERS_READY` gates draft save and confirmation. `PURCHASE_RECEIPT_ATOMIC_READY` still gates physical receiving. Both stay false. The client does not call `save_purchase_order` while the order flag is false.

Saving a draft or confirming an order does not change stock, does not write `inventory_actions`, and does not create a FIFO lot. Confirmation means the order was already agreed with the supplier. It does not send anything to the supplier.

Supplier purchase prices still have no VAT basis. The stored total is the sum of the entered agreed prices. Those amounts must not be used for inventory valuation or gross profit until a VAT basis is decided. That decision is required before physical receiving is activated.

Activation order, after a separate approval and a passing read of `docs/v2/PHASE15A-purchase-order-preflight.sql`:

1. Employees table, already in production.
2. `docs/v2/purchase-order-receipts.UNAPPLIED.sql`. It creates the order ledger and the receipt function, and grants execute only on `save_purchase_order`.
3. Do not grant `post_purchase_receipt` in this phase. Granting it requires `docs/v2/fifo-inventory-lots.UNAPPLIED.sql` first, then a separate receiving approval.
4. Only then set `PURCHASE_ORDERS_READY` to true in a reviewed build. Leave `PURCHASE_RECEIPT_ATOMIC_READY` false.

Rollback drops only the new purchase-order tables and the two functions. It does not drop employees, products, suppliers, inventory lots, or inventory actions.
