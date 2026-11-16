# I5 receiving screen — specification only

This screen is not active. I3 does not post stock, capitalize landed cost, or open a receiving route.

The Michelin, Falken, and Linglong rows in the approved receiving mockup are illustrations. They are not records.

## Navigation

- Enter from an eligible import order or shipment.
- Keep the order id and the shipment id. The visible order number is not the route key.
- A shipment may be partial. A container may belong to more than one order.
- Return to the order or shipment the user came from.
- There is no `/import/:id/receiving` route in I3.
- The order screen shows a disabled control, `קליטת סחורה חדשה — בקרוב`.
- The existing receipt dialog stays on the order’s קליטות tab and is separate from this screen.

## Screen contents, when I5 is approved

- Order and shipment identity from saved rows.
- Per line: ordered quantity, previously accepted quantity, and editable accepted, damaged, and missing quantities.
- Reconciliation: accepted + damaged + missing must equal the quantity being received for that line.
- Receiving notes.
- Supporting documents already stored for the order.
- A summary of accepted, damaged, and missing totals.
- Draft save that does not change `products.quantity` or cost layers.
- One idempotency key per receipt so a repeat does not post twice.
- Existing receipt history remains visible and is not rewritten.

## Posting

Posting stays disabled until a separate approval turns on the existing blocked receipt engine. The confirm control must stay disabled and labeled unavailable until that approval. Damaged and missing quantities do not become saleable stock.
