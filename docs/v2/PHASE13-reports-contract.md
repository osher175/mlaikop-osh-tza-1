# Phase 13 reports and FIFO contract

This screen does not replace the employee page. It does not add a route.

## Revenue

VAT-inclusive `sale_total_ils` and quick-sale `line_revenue_gross_ils`. Reversals and reversed rows are excluded. A quick-sale stock row has no `sale_total_ils`, so it is not added again.

The live `reports_aggregate` timeline sum is shown only when the filter is a date range. A product, brand, or supplier filter hides it, because that function cannot apply the filter. An empty timeline is a real zero. A missing daily amount is not a zero.

## Gross profit

Ex-VAT revenue minus known unit cost times quantity, and only on rows with a known cost. It is not net profit. The live function's `gross_profit` and `net_profit` are ignored because a missing cost becomes zero and the subtraction starts from VAT-inclusive revenue.

## Discounts

A stored list price and a stored discount are known, including a real zero. A missing list price stays unknown and is not rebuilt from the current catalog. A quick-sale stock row that copied the charged price into the list field stays unknown.

## Inventory value and FIFO

Current stock value uses a known purchase unit cost. A missing or zero catalog cost stays out of the value. Receipt units are not that value and are not a supplier payment. An import payment is not a receipt and is not COGS.

FIFO lots are in `docs/v2/fifo-inventory-lots.UNAPPLIED.sql`. Oldest known receipt is consumed first. Unknown-age lots are last and stay out of the known average. A repeated allocation key does not consume twice. A shortfall does not make a lot negative. A customer restock is a new lot at the return time. Transfers are rejected. The function does not change `products.quantity` and is not called by the live sale or purchase path. Existing stock is not given a fabricated receipt date.

## Dates

The window is `[from midnight, next midnight)` in the business calendar, passed to the live function so its extra second does not cross the next day.

## What is not applied

`docs/v2/reports-v2-overview.UNAPPLIED.sql` and `docs/v2/fifo-inventory-lots.UNAPPLIED.sql`. `V2_REPORTS_SQL_READY` and `FIFO_AGING_READY` stay false.
