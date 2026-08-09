# Mlaiko — Phase A2.1: Database Change Proposal (NOT EXECUTED)

Date: 2026-08-09
Status: **proposal only. No migration was run. No index was created or dropped. No RLS policy, function, view or grant was changed.**
Companion: `docs/PERFORMANCE_PHASE_A2_RESULTS.md`

Every statement below is written out exactly as it would need to run, with a rollback. Nothing here has been applied.

---

## SAFE / HIGH CONFIDENCE

### S1 — Close the cross-tenant hole in the two analytics RPCs (SECURITY-SENSITIVE, highest priority)

**Evidence.** `reports_aggregate(business_id, date_from, date_to)` and `get_top_sales_by_dimension(...)` are both `SECURITY DEFINER`, both take `business_id` as a **caller-supplied parameter**, and neither verifies that the caller belongs to that business. Their ACLs are:

```
reports_aggregate:            anon=X, authenticated=X, service_role=X
get_top_sales_by_dimension:   anon=X, authenticated=X, service_role=X
```

`SECURITY DEFINER` bypasses RLS, so any caller holding the anon key can post an arbitrary `business_id` and read another tenant's revenue, profit, COGS, supplier breakdown and top products. This is a data-isolation defect, not a performance issue — it is listed first because A2 recommends routing *more* traffic through these functions.

```sql
-- Guard both aggregate RPCs with a membership check and remove anon access.
CREATE OR REPLACE FUNCTION public.reports_aggregate(business_id uuid, date_from timestamptz, date_to timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
STABLE                               -- also fixes S3
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  -- ... existing DECLARE block unchanged ...
BEGIN
  IF NOT public.is_business_member(reports_aggregate.business_id, auth.uid())
     AND NOT public.has_role_or_higher('admin'::public.user_role) THEN
    RAISE EXCEPTION 'not a member of this business' USING ERRCODE = '42501';
  END IF;
  -- ... existing body unchanged ...
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_top_sales_by_dimension(p_business_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_dimension text DEFAULT 'product', p_limit integer DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.is_business_member(p_business_id, auth.uid())
     AND NOT public.has_role_or_higher('admin'::public.user_role) THEN
    RAISE EXCEPTION 'not a member of this business' USING ERRCODE = '42501';
  END IF;
  -- ... existing body unchanged ...
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_top_sales_by_dimension(uuid, timestamptz, timestamptz, text, integer) FROM anon;
```

Rollback: re-`CREATE OR REPLACE` both functions without the guard block and `GRANT EXECUTE ... TO anon;`.

Risk: **low** for logged-in members (behaviour identical); it will break any unauthenticated caller. Verify the Public Read API / Retail IQ edge functions call these with the service role before applying — the service role is unaffected by the guard only if it is admin-equivalent, so add `OR auth.role() = 'service_role'` if those functions rely on it.

### S2 — Drop the duplicate index on `api_key_usage_log`

**Evidence.** `idx_api_key_usage_log_key_created` and `idx_api_usage_key_time` are byte-identical: `btree (api_key_id, created_at DESC)`. Scan counts: **9,810** vs **7**. Both are 368 kB and both are maintained on every API request write.

```sql
DROP INDEX IF EXISTS public.idx_api_usage_key_time;
```

Rollback:
```sql
CREATE INDEX idx_api_usage_key_time ON public.api_key_usage_log USING btree (api_key_id, created_at DESC);
```

Benefit: one fewer index maintained per insert on the fastest-growing table (4,932 rows). Storage: −368 kB. Risk: **very low** — the surviving index has the identical definition.

### S3 — Mark read-only functions STABLE

**Evidence.** `pg_proc.provolatile`: `reports_aggregate` = `v` (VOLATILE), `require_premium` = `v`, `generate_weekly_stock_summary` = `v`. The first two only read. A VOLATILE function cannot be hoisted out of a loop and, if ever used in an RLS policy, is evaluated **per row**.

```sql
ALTER FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) STABLE;
ALTER FUNCTION public.require_premium(uuid) STABLE;
```

Rollback:
```sql
ALTER FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) VOLATILE;
ALTER FUNCTION public.require_premium(uuid) VOLATILE;
```

Note: `require_premium` is referenced by billing gating. Under `CODE_FREEZE_SUBSCRIPTION.md` this one statement needs the 4-step freeze review even though it changes no logic. `generate_weekly_stock_summary` writes and must stay VOLATILE.

---

## CONDITIONAL — likely useful, needs one more measurement first

### C1 — Force single evaluation of `has_role_or_higher` in RLS policies (SECURITY-SENSITIVE)

**Evidence.** `user_roles` holds **7 rows** but has recorded **6,103,430 sequential scans** reading **32,530,199 tuples** (~5.3 rows per scan). `businesses` holds **6 rows** with **1,062,162 sequential scans** / 3.2 M tuples. Both are reached from RLS predicates of the form:

```sql
has_role_or_higher('admin'::user_role) OR (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))
```

used on `audit_logs`, `notifications`, `notification_settings`, `api_keys`, `api_key_usage_log`, `billing_events`, `payment_sessions` and others. The scan-to-row ratio is consistent with **per-row** evaluation rather than a once-per-statement InitPlan.

The standard Supabase remedy is to wrap the call in a scalar subquery so the planner promotes it to an InitPlan:

```sql
-- Example for ONE policy; the same rewrite applies to each policy listed above.
ALTER POLICY "Users can view own or business notifications" ON public.notifications
USING (
  (user_id = (SELECT auth.uid()))
  OR (SELECT public.has_role_or_higher('admin'::public.user_role))
  OR (business_id IN (SELECT id FROM public.businesses WHERE owner_id = (SELECT auth.uid())))
);
```

Rollback: `ALTER POLICY ... USING (<original predicate>)` — capture each original from `pg_policies` before changing anything.

**Why conditional:** the predicate is unchanged semantically, but this touches RLS on tables that include `payment_sessions` and `billing_events`, which are inside the subscription freeze. It must not be applied blind. Required first step: run `EXPLAIN (ANALYZE, BUFFERS)` on a representative `notifications` and `audit_logs` select as an authenticated role and confirm the function appears as a per-row filter rather than an InitPlan. Apply to **one non-billing table** first, re-measure `pg_stat_user_tables.seq_scan` on `user_roles`, then decide.

Note the tables are 6–7 rows; each individual scan is cheap. The cost is the **call count**, and it is the top row-read source in the entire database.

### C2 — `notifications` covering indexes

**Evidence.** `notifications` has **only** `notifications_pkey`. Post-A1 the client issues one batched lookup per scan cycle:

```
business_id = ? AND product_id IN (...) AND type IN (...) AND created_at >= now() - 24h
```

and the RLS predicate additionally filters `user_id`.

```sql
CREATE INDEX idx_notifications_business_product_type_created
  ON public.notifications USING btree (business_id, product_id, type, created_at DESC);
CREATE INDEX idx_notifications_user_unread
  ON public.notifications USING btree (user_id, is_read, created_at DESC);
```

Rollback:
```sql
DROP INDEX IF EXISTS public.idx_notifications_business_product_type_created;
DROP INDEX IF EXISTS public.idx_notifications_user_unread;
```

**Why conditional:** `notifications` does not appear in the top-25 `seq_tup_read` ranking, i.e. it is currently small enough that no scan cost is measurable. Adding indexes now is speculative. Recommended trigger: revisit once `notifications` passes ~10,000 rows, or immediately if `useNotifications` (15 s staleTime, mounted in the header) starts appearing in `pg_stat_statements`.

### C3 — Never-used indexes

**Evidence** (`pg_stat_user_indexes.idx_scan`):

| Index | Scans | Size |
|---|---|---|
| `idx_api_usage_business` (business_id, created_at DESC) | 0 | 368 kB |
| `idx_audit_logs_action_type` | 0 | 64 kB |
| `idx_audit_logs_timestamp` | 0 | 96 kB |
| `idx_audit_logs_user_id` | 0 | 56 kB |
| `idx_proc_req_approval` (business_id, approval_status, status) | 0 | 16 kB |
| `idx_inventory_actions_reverses` | 0 | 16 kB |

```sql
DROP INDEX IF EXISTS public.idx_audit_logs_action_type;
DROP INDEX IF EXISTS public.idx_audit_logs_user_id;
DROP INDEX IF EXISTS public.idx_api_usage_business;
```

Rollback:
```sql
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs USING btree (action_type);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs USING btree (user_id);
CREATE INDEX idx_api_usage_business ON public.api_key_usage_log USING btree (business_id, created_at DESC);
```

**Why conditional:** zero scans may simply mean the feature (admin log filtering, per-business API usage reporting) has not been exercised yet rather than that the index is useless. `idx_inventory_actions_reverses` is brand new (added for the undo feature) and must be **kept**. `idx_proc_req_approval` supports the approval flow and should be kept until that flow has been used in production.

### C4 — Retention on unbounded log tables

**Evidence.** `audit_logs` 3,569 rows, `recent_activity` 4,297 rows, `api_key_usage_log` 4,932 rows, all growing with no scheduled pruning. `cleanup_old_audit_logs()` exists but nothing schedules it.

```sql
-- Requires pg_cron. Verify the extension and the existing cron schedule first.
SELECT cron.schedule('mlaiko-log-retention', '0 3 * * *', $$
  DELETE FROM public.api_key_usage_log WHERE created_at < now() - interval '90 days';
  DELETE FROM public.recent_activity   WHERE timestamp  < now() - interval '180 days';
  SELECT public.cleanup_old_audit_logs();
$$);
```

Rollback:
```sql
SELECT cron.unschedule('mlaiko-log-retention');
```

**Why conditional:** deleting audit/activity history is a **business and compliance decision**, not a technical one. Do not apply without the owner explicitly confirming the retention windows. Also confirm `cleanup_old_audit_logs()`'s own retention window before scheduling it.

---

## NOT RECOMMENDED — considered and rejected

| Idea | Why rejected |
|---|---|
| Index `product_thresholds(product_id)` | Already exists as the unique constraint `product_thresholds_product_id_key`. The 430,012 sequential scans / 28.4 M tuples come from the planner correctly choosing a seq scan on a 666-row table inside a `LIMIT 1` lateral. An index cannot beat it. |
| Index `suppliers(business_id)` | 107,484 seq scans over a **15-row** table. A seq scan of one page is faster than an index lookup; Postgres is right. |
| Index `businesses(owner_id)` | 6 rows. Same reasoning. The cost is call volume (C1), not scan cost. |
| Index `user_roles(user_id)` | Already exists (`user_roles_user_id_key`, unique). 7 rows — the planner will keep choosing a seq scan and should. |
| `products(business_id, quantity)` or a partial "low stock" index | The low-stock threshold lives in a **separate table** (`product_thresholds`), so the predicate is not expressible on `products` alone. A partial index cannot be built for it. |
| Materialized view for dashboard analytics | Introduces staleness into financial figures that the app currently presents as live, and needs a refresh strategy plus RLS wrapper. Rejected in favour of the existing RPC path — see the `reports_aggregate` assessment in the results document. |
| Extra index on `inventory_actions` | Already carries `(business_id, timestamp DESC)` (46,934 scans), `(business_id, action_type, timestamp DESC)` (1,581), `(product_id, business_id, timestamp DESC)` (5,771). Every observed analytics predicate is covered. |
| Dropping `idx_inventory_actions_timestamp` | 13,534 scans — in active use. |
| Partitioning `inventory_actions` | 3,757 rows. Two to three orders of magnitude too early. |

---

## Execution order if approved

1. **S1** (security — apply first, independently, and verify the Public Read API and Retail IQ functions still work).
2. **S2**, **S3** (trivial, independent).
3. **C1** on a single non-billing table, re-measure, then extend.
4. **C2** only when `notifications` grows.
5. **C3**, **C4** only after the owner confirms the feature/retention questions.

No statement in this document has been executed.
