# Financial calculation contract

This is the reporting contract for the prepared V2 upgrade. It does not rewrite stored rows. Live SQL still uses the older formulas until the unapplied files in the migration manifest are applied.

## Amounts

- `sale_total_ils` and `sale_lines.line_revenue_gross_ils` are VAT-inclusive revenue. VAT is 18 percent.
- Revenue excluding VAT is that amount divided by 1.18.
- Gross profit is revenue excluding VAT minus known unit cost times absolute quantity.
- There is no operating-expense layer in these reports. Where a function still returns both `grossProfit` and `netProfit`, the prepared replacement sets both to that same known ex-VAT profit. The screen labels stay as they are.
- A quick-sale stock row keeps `sale_total_ils` null. Its revenue is counted once, from `sale_lines`, and only when the quick-sale read is enabled.
- A legacy sale is counted once, from the inventory row that has `sale_total_ils`.

## Cost

- Unknown cost is null. It stays in the VAT-inclusive revenue total and is left out of profit.
- A stored 0 on `reference_type = legacy_sale_request`, on a new purchase receipt, and on a V2 sale line is a real zero.
- On older inventory sale rows, both null and 0 stay unknown. The current sale dialog writes 0 when the product cost is missing. Those rows are not rewritten.
- `sale_cost_known` in `sale-profit-reporting.UNAPPLIED.sql` is the SQL form of this rule. V2 dashboard and employee performance already use the same split in the client.

## What is not a sale

- Purchases, supplier returns, stock adjustments, and damaged customer returns have no `sale_total_ils`. They are not revenue.
- A customer return does not record a financial refund and does not mark the original sale reversed.
- A full reversal after any customer return is rejected by `return-reversal-guard.UNAPPLIED.sql`.
- Rows with `is_reversal` or `reversed_at` are excluded from sales totals.

## Completeness

- `reports_aggregate`, `yoy_financials`, `bi_analytics_yearly`, and `insights_aggregate` aggregate in SQL. They do not page.
- The V2 dashboard, employee performance, and movement-journal money scan stop at 20,000 rows and mark the result partial. They must not present that partial sum as complete.
- The sale dialog preview in `SaleModal` subtracts cost from the VAT-inclusive amount. That preview is not this contract.

## Live gap until the SQL is applied

`reports_aggregate`, `yoy_financials`, `bi_analytics_yearly`, and `insights_aggregate` still treat a missing cost as zero, and their gross profit still starts from VAT-inclusive revenue. Dead-stock estimated value in insights still treats a missing product cost as zero. The prepared files change the displayed profit only. They do not change purchases, discounts, or stock-count insights.
