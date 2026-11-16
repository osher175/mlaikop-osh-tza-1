# I3 import-order wizard

The Import Center opens a three-step wizard: order details, catalog product lines, and review.

The previous nested PostgREST insert is not the commit path. It was not proven here against the database, and it cannot lock tire identity or classify a supplier. `import_wizard_commit` in `i3/01-import-wizard-commit.UNAPPLIED.sql` is the intended single transaction. Until that file is approved and applied, the wizard calls the function and stops with an error if it is missing. No header, line, product, or stock row is written in that case.

The import list reads `serves_import`. Local purchasing pickers read `serves_local`, and until that column exists they keep the current full list so local buying does not stop. The server function rejects an import order for a supplier that is not marked for import, and local stock, quote, and preference writes reject an import-only supplier. A supplier may have both flags. A repeated wizard save uses `client_request_id` and does not create a second order.

Incoming status on the catalog is calculated from open import lines: ordered minus received minus not arriving. Completed and cancelled orders are excluded. A product with no saleable quantity shows **בדרך** and the earliest order arrival date, without a zero quantity. A product that already has stock keeps that quantity and adds the incoming note. A failed date read does not invent a date. Shipment-level dates are not in the applied schema.

A new tire is defined in the wizard and created only inside `import_wizard_commit`, with quantity 0 and no inventory movement. An existing product id is reused. Ambiguous identity fails the transaction. The catalog read uses applied import order lines, not a stored product flag.

Incoterms and a destination warehouse are not columns on `import_orders`, so the wizard does not show them. The working ILS rate is stored only as `working_exchange_rate_to_ils` and is not copied onto supplier prices.
