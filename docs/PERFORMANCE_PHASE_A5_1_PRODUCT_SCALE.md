# Phase A5.1 — Product Scale Closure

Date: 2026-08-09
Status: Implemented
Scope: Inventory product listing, counters, export, notification checker

---

## 1. Root cause

Phase A5 ended with a CONDITIONAL PASS and two P1 blockers:

1. **`useProducts` fetched the entire product table per tenant** with no
   `limit`, no pagination and no server-side filtering. Above 1,000 rows
   PostgREST silently truncates, which would have produced wrong counters,
   incomplete search/filter results and a truncated Excel export — with no
   error surfaced to the user. Every row was also rendered by the browser.
2. **`useNotificationChecker` read the whole product table** (id, name,
   quantity, expiration_date, thresholds) from every authenticated page in
   order to decide, client-side, which products deserve an alert.

Both paths scaled linearly with catalog size and both were subject to the
same silent 1,000-row cap.

---

## 2. Files modified

| File | Change |
| --- | --- |
| `src/hooks/useInventoryProductsPage.tsx` (new) | Paged list hook, global-counters hook, batched export fetcher |
| `src/pages/Inventory.tsx` | Uses paged hook + DB counters, adds pagination controls, drops client-side filtering pass |
| `src/components/inventory/InventoryHeader.tsx` | Export now pulls all matching rows in bounded batches via `exportContext` |
| `src/hooks/useNotificationChecker.tsx` | Candidate products now come from a bounded DB function |
| DB migration | `inventory_products_page`, `inventory_stock_counts`, `products_needing_notifications` |

`useProducts` itself is **unchanged and still used only by `AddProduct.tsx`**
for its `createProduct` mutation; the Inventory page no longer calls it, so its
unbounded list query no longer runs on the Inventory route.

Not touched: analytics, financial rules, A2/A4 RPCs, billing/free-access,
procurement, dependencies, dead code, branding, Inventory visual design.

---

## 3. Pagination architecture

`public.inventory_products_page(p_business_id, p_search, p_stock_filter, p_limit, p_offset)`
→ `jsonb { items: [...], total: <bigint> }`

- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`
- Membership guard: `is_business_member(p_business_id, auth.uid())` OR
  `has_role_or_higher('admin', auth.uid())`
- `p_limit` clamped server-side to `[1, 1000]`, `p_offset` clamped to `>= 0`
- Deterministic ordering: `created_at DESC NULLS LAST, id DESC`
  (matches the previous `created_at DESC` order, with `id` as a stable
  tiebreaker so pages never overlap or skip rows)
- Items carry the same shape the UI expects: full product row plus
  `product_categories: { name }`, `suppliers: { name }`, and
  `product_thresholds: { low_stock_threshold }` where the threshold is the
  **effective** one (`COALESCE(product_thresholds.low_stock_threshold, 5)`).

Frontend: `useInventoryProductsPage(search, stockFilter, page, pageSize)` with
`PAGE_SIZE = 50`, `placeholderData: prev` (no flash between pages), and page
reset on any search/filter change.

Queries per Inventory render: **2** (one page query + one counters query),
independent of catalog size.

---

## 4. Search / filter architecture

All filtering executes in Postgres inside `inventory_products_page`:

| Filter | Implementation |
| --- | --- |
| Text search | `name / barcode / location ILIKE '%term%'` (same three fields as before) |
| `all` | no stock predicate |
| `inStock` | `quantity > effective_threshold` |
| `lowStock` | `quantity > 0 AND quantity <= effective_threshold` |
| `outOfStock` | `quantity = 0` |

Semantics are identical to the previous client-side pass, including the
per-product threshold override with a default of 5. The frontend performs no
filtering at all, so correctness no longer depends on the full dataset being
in memory. Category and supplier are displayed (joined) but were never
user-selectable filters on this page; that has not changed.

---

## 5. Counter architecture

`public.inventory_stock_counts(p_business_id)` → `jsonb`:
`total`, `inStock`, `lowStock`, `outOfStock`, `totalUnits`.

Computed with a single aggregate scan over the tenant's products, using the
same fixed `> 5 / 1..5 / = 0` bands the previous `getStatusCounts` memo used,
so the displayed numbers are unchanged in meaning. Counters are **global**,
never derived from the loaded page.

The pagination footer separately shows the **filtered** match count, which
comes from the `total` returned by `inventory_products_page` (a `COUNT(*)`
over the filtered set, not over the page).

---

## 6. CSV / Excel export architecture

Previous behaviour: exported the client-side filtered array, i.e. whatever the
browser happened to hold — truncated at 1,000 rows above that size.

New behaviour (`fetchAllMatchingProducts`): the header receives an
`exportContext { businessId, search, stockFilter, matchingCount }` and loops
`inventory_products_page` in batches of 1,000 rows, stopping when a short batch
is returned or `total` is reached, with a hard safety ceiling of 100 batches
(100,000 products). The button is disabled while exporting.

Export semantics are preserved: **all products matching the current search and
stock filter**. Columns, ordering source and business meaning of
`exportInventoryToCSV` are unchanged.

---

## 7. Notification-checker architecture

`public.products_needing_notifications(p_business_id, p_low_stock_enabled, p_default_low_threshold, p_expiration_enabled, p_expiration_days, p_limit)`

Returns only rows where
`quantity <= COALESCE(product_thresholds.low_stock_threshold, settings.low_stock_threshold)`
(when low-stock alerts are on) **or**
`expiration_date <= CURRENT_DATE + expiration_days` (when expiry alerts are on),
each row flagged with `needs_low_stock` / `needs_expiration`.

- Ordered `quantity ASC, expiration_date ASC` so the most urgent products come
  first, `LIMIT` clamped to `[1, 1000]`, called with 200 from the client.
- Same membership guard as the other two functions.
- Unchanged on the client: the 15-minute foreground interval, the enabled-only
  gate, the batched 24h dedupe lookup, the batched inserts, the notification
  types (`low_stock`, `expired`), titles and Hebrew message text.

The browser no longer reads `products` for notifications at all.

---

## 8. Security verification

- All three functions are `SECURITY DEFINER` with `SET search_path = public`
  and an explicit membership/admin guard before any data access.
- Grants verified in `pg_proc.proacl`:
  `postgres=X, authenticated=X, service_role=X` — **no `PUBLIC`, no `anon`** on
  any of the three.
- Every call is `business_id`-scoped; `business_id` is part of every React
  Query key (`inventory-products-page`, `inventory-stock-counts`,
  `products-needing-notifications`), so no cross-tenant cache reuse.
- No RLS policy, grant or billing/free-access behaviour was changed or relaxed.

---

## 9. Target-scale reasoning

| Catalog size | List | Search/filter | Counters | Export | Notifications |
| --- | --- | --- | --- | --- | --- |
| 1,000 | 50 rows/page | DB-side | 1 aggregate scan | 1 batch | ≤200 bounded rows |
| 10,000 | 50 rows/page (200 pages) | DB-side | 1 aggregate scan | 10 batches | ≤200 bounded rows |
| 50,000 | 50 rows/page | DB-side | 1 aggregate scan | 50 batches | ≤200 bounded rows |

Nothing on the page grows with catalog size except the number of export
batches and the page count. No query can return more than 1,000 rows, so
PostgREST truncation is structurally impossible on these paths.

No synthetic data was inserted. Verification was done against the largest real
tenant (717 products) plus SQL-equivalence checks of the aggregate expressions.

---

## 10. Validation results

- `tsgo --noEmit`: pass, 0 errors
- `eslint` on the four modified/added files: pass, 0 problems
- `vite build`: success in ~13s; initial bundle `index-*.js` **787.70 kB**
  (231.92 kB gzip) — slightly smaller than the A3 baseline of 794.93 kB
- Smoke: `/inventory` loads and correctly redirects unauthenticated visitors to
  `/auth`, **0 console errors, 0 page errors**
- Function grants confirmed via `pg_proc.proacl`
- Counter/filter expressions confirmed equal to the previous client-side logic
  by running the equivalent SQL against the largest tenant
  (717 total / 86 in stock / 286 low / 345 out / 1,911 units)

Authenticated end-to-end UI verification (pagination clicks, edit, stock
update, export download) could not be executed automatically: this project uses
an external, unmanaged Supabase instance, so the harness cannot mint a preview
session. Those flows should be clicked through once manually.

---

## 11. Before / after

**Products**

| | Before | After |
| --- | --- | --- |
| Fetch | Unbounded `select *` over all products | `inventory_products_page`, 50 rows/page |
| Truncation | Silent at 1,000 rows | Impossible (server clamp + total count) |
| Search/filter | Client-side over full array | Postgres |
| Rendering | Every row | 50 rows |
| Queries per view | 1 (huge) | 2 (bounded) |
| Counters | Derived from loaded array | `inventory_stock_counts` over full catalog |

**Notification checker**

| | Before | After |
| --- | --- | --- |
| Data read | Whole product table + thresholds | Only alert-eligible products |
| Bound | None | `LIMIT 200` (server clamp 1,000) |
| Classification | Browser | Postgres |

**Export**

| | Before | After |
| --- | --- | --- |
| Source | In-memory filtered array | Batched DB pages of 1,000 |
| >1,000 products | Silently truncated | Complete |

---

## 12. Remaining scale risks

1. **P2 — notification candidate cap.** If a tenant has more than 200
   alert-eligible products at once, only the 200 most urgent create client-side
   notifications per cycle. The server-side `check_product_notifications`
   trigger still fires for stock changes, so events are not lost, but the
   backfill for a very large alert backlog is now paced. Raise the limit or
   move the loop server-side if this becomes visible.
2. **P2 — deep `OFFSET` pagination.** At 50,000 products, page 1,000 uses a
   large `OFFSET`. Acceptable today; keyset pagination is the fix if it ever
   shows up in `pg_stat_statements`.
3. **P3 — `ILIKE '%term%'` search** cannot use a plain B-tree index. Add a
   `pg_trgm` GIN index on `products(name)` if search latency degrades.
4. **P3 — export of very large catalogs** is serial (one batch at a time) and
   builds the whole workbook in memory; ~50,000 rows is the practical browser
   ceiling.

No P0 or P1 findings remain on the product path.
