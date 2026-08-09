# Mlaiko — Phase A2.S1: Aggregate RPC Tenant-Isolation Security Fix

Date: 2026-08-09
Scope: authorization patch for two analytics RPCs only. No frontend file was changed in this phase.
Related: `docs/PERFORMANCE_PHASE_A2_DB_PROPOSAL.md` §S1, `docs/PERFORMANCE_PHASE_A2_RESULTS.md` §6

---

## 1. Vulnerability summary

**Confirmed.**

`public.reports_aggregate` and `public.get_top_sales_by_dimension` are `SECURITY DEFINER` functions that accept the tenant identifier as a **caller-supplied parameter**. `SECURITY DEFINER` executes with the owner's privileges and therefore bypasses row-level security on `inventory_actions`, `products`, `suppliers`, `brands` and `product_categories`.

Neither function verified that the caller belonged to the business it was asked about, and both had `EXECUTE` granted to `PUBLIC` and to `anon`.

**Exact authorization flaw:** the only tenant scoping was the `WHERE ia.business_id = <parameter>` filter *inside* the query. That filter restricts which rows are returned, but the parameter is chosen entirely by the caller — so it scoped the result to whichever tenant the attacker named, rather than to the tenant the attacker belongs to. There was no `auth.uid()`-based check anywhere in either function.

**Impact:** anyone in possession of the project's publishable/anon key (which ships in the browser bundle of every deployed Lovable app and is not a secret) could POST any `business_id` to `/rest/v1/rpc/reports_aggregate` and receive that tenant's gross revenue, VAT-net revenue, COGS, gross and net profit, top product, full supplier purchase breakdown, daily sales timeline, top-20 product list and monthly purchase totals. No sign-in required. Signed-in users of tenant A could read tenant B's figures the same way.

## 2. Affected RPCs

| Function | Signature |
|---|---|
| `public.reports_aggregate` | `(business_id uuid, date_from timestamptz, date_to timestamptz) → jsonb` |
| `public.get_top_sales_by_dimension` | `(p_business_id uuid, p_date_from timestamptz, p_date_to timestamptz, p_dimension text DEFAULT 'product', p_limit integer DEFAULT 10) → jsonb` |

## 3. Pre-change state (as inspected before any modification)

| Property | `reports_aggregate` | `get_top_sales_by_dimension` |
|---|---|---|
| Owner | `postgres` | `postgres` |
| Security | `SECURITY DEFINER` | `SECURITY DEFINER` |
| Volatility | `VOLATILE` (`provolatile = 'v'`) | `STABLE` (`provolatile = 's'`) |
| `search_path` | `SET search_path TO 'public'` (already safe) | `SET search_path TO 'public'` (already safe) |
| ACL | `=X/postgres \| postgres=X \| anon=X \| authenticated=X \| service_role=X` | identical |
| Authorization behaviour | **none** — no `auth.uid()` check | **none** — no `auth.uid()` check |

`=X/postgres` is the grant to `PUBLIC`, so the functions were executable by every role in the database, not just `anon`.

### Membership helpers considered for reuse

| Helper | Reused? | Notes |
|---|---|---|
| `public.is_business_member(_business_id, _user_id)` | Partially — logic reused, not called directly | `STABLE STRICT SECURITY DEFINER`. Covers `user_businesses` **and** an owner fallback. **Does not cover approved `business_users` rows.** Being `STRICT`, it returns `NULL` (not `false`) when `auth.uid()` is `NULL`, which would silently skip a naive `IF NOT ...` guard. |
| `public.has_role_or_higher('admin', uid)` | **Yes** | Existing system-admin escalation used across the project's RLS. |
| `public.get_user_business_context(uid)` | Logic reused | This is the app's actual tenant resolver (`useBusinessAccess`). It grants access to the **owner** *and* to approved `business_users` rows. |
| `auth.role()` | Yes | Distinguishes internal `service_role` callers. Reads the PostgREST-verified JWT claim; not forgeable by a client. |

`is_business_member` alone was **rejected as the sole check**: it is narrower than `get_user_business_context`, so an approved staff member who is not in `user_businesses` would have been locked out of Reports. (Verified against live data: **0** approved members currently fall into that gap, but it was a latent regression.) `is_business_member` itself was left untouched because it is used by unrelated RLS policies and widening it would have been an out-of-scope RLS change.

## 4. Fix applied

Two migrations were applied.

**Migration 1** inserted an inline guard into both functions and corrected the grants.
**Migration 2** replaced the inline guard with a single shared helper that also recognises approved `business_users` members, matching `get_user_business_context` exactly.

### New helper

```sql
CREATE OR REPLACE FUNCTION public.can_access_business_analytics(_business_id uuid, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    COALESCE(auth.role() = 'service_role', false)
    OR (
      _business_id IS NOT NULL
      AND _user_id IS NOT NULL
      AND (
        COALESCE(public.has_role_or_higher('admin'::public.user_role, _user_id), false)
        OR EXISTS (SELECT 1 FROM public.businesses b      WHERE b.id = _business_id AND b.owner_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.user_businesses ub WHERE ub.business_id = _business_id AND ub.user_id = _user_id)
        OR EXISTS (SELECT 1 FROM public.business_users bu  WHERE bu.business_id = _business_id AND bu.user_id = _user_id AND bu.status = 'approved')
      )
    );
$function$;
```

Design notes:
- It is **not** `STRICT`, so a `NULL` `auth.uid()` yields `false` rather than `NULL`. Every branch is wrapped in `COALESCE`, so the guard can never evaluate to `NULL` and fall through.
- `_business_id IS NULL` and `_user_id IS NULL` are rejected explicitly, closing the "omit the parameter" path.
- All objects are schema-qualified and `search_path` is pinned to `public`.

### Guard inserted into both functions

Immediately after `BEGIN`, before any data is read:

```sql
IF NOT public.can_access_business_analytics(<business_id_param>, auth.uid()) THEN
  RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
END IF;
```

Everything below the guard is byte-identical to the previous definitions.

### What was deliberately NOT changed

Aggregation formulas, the `revenue_gross / 1.18` VAT rule, `net_profit := ROUND(revenue_net - cogs_total, 2)`, reversal filtering (`is_reversal = false AND reversed_at IS NULL`), the `remove`/`sale` dual action handling, the `date_to + interval '1 second'` boundary, all response keys, return types, function names, parameter names and order, and every frontend call signature. `reports_aggregate` was intentionally left `VOLATILE` — promoting it to `STABLE` is proposal item S3 and is out of scope for this patch.

## 5. Grant changes

```sql
REVOKE ALL ON FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.get_top_sales_by_dimension(uuid, timestamptz, timestamptz, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_top_sales_by_dimension(uuid, timestamptz, timestamptz, text, integer) FROM anon;

GRANT EXECUTE ON FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_sales_by_dimension(uuid, timestamptz, timestamptz, text, integer) TO authenticated, service_role;

-- new helper, same posture
REVOKE ALL ON FUNCTION public.can_access_business_analytics(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_business_analytics(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_access_business_analytics(uuid, uuid) TO authenticated, service_role;
```

Resulting ACL for both RPCs: `postgres=X/postgres | authenticated=X/postgres | service_role=X/postgres` — `PUBLIC` and `anon` are gone.

`service_role` was deliberately retained. `supabase/functions/public-api/index.ts` calls `reports_aggregate` for the `/reports/summary` endpoint using the service-role client, and it resolves `bid` **server-side from the API key record**, never from client input — so that path is already tenant-safe and the `service_role` short-circuit does not reopen the hole.

## 6. Security verification

Anonymous cases were tested end-to-end through the real PostgREST endpoint using the project's publishable key.

| Case | Test | Result |
|---|---|---|
| **C — anonymous** | `POST /rest/v1/rpc/reports_aggregate` with the anon key | **HTTP 401**, `42501 permission denied for function reports_aggregate` — blocked at the grant layer, before the function body |
| **C — anonymous** | `POST /rest/v1/rpc/get_top_sales_by_dimension` with the anon key | **HTTP 401**, `42501 permission denied for function get_top_sales_by_dimension` |
| **C — anonymous** | `POST /rest/v1/rpc/can_access_business_analytics` with the anon key | **HTTP 401**, `42501 permission denied` — the helper itself is not reachable anonymously either |
| **Grant state** | `pg_proc.proacl` for both RPCs | `postgres=X \| authenticated=X \| service_role=X`. `PUBLIC` and `anon` removed. Verified post-migration. |
| **A — authorized owner** | Guard predicate evaluated against live data for the owner of `צמיגי פאר` | `allowed = true` |
| **B — cross-tenant** | Owner of `צמיגי פאר` against `M2 Biz A`; owner of `M2 Biz A` against `צמיגי פאר` | `allowed = false` in **both** directions |
| **D — random/unknown UUID** | `00000000-0000-0000-0000-000000000009` against both businesses | `allowed = false`; `NULL` business_id and `NULL` user_id also rejected explicitly |
| **Staff coverage** | Approved `business_users` rows not present in `user_businesses` and not the owner | **0 across all 6 businesses** — no existing member loses access |

### Verification limitation (stated plainly)

Cases A, B and D were verified by **evaluating the guard's exact predicate against live production data**, not by issuing signed-in HTTP calls. A real user JWT could not be obtained in this session: `LOVABLE_BROWSER_AUTH_STATUS=external_unmanaged` (this is a BYO Supabase project, so the preview cannot inject a session), the available access token did not authenticate (`/auth/v1/user` returned no user), no service-role key is present in the sandbox, and the read-only SQL role (`supabase_read_only_user`) can neither `SET ROLE authenticated` nor execute the functions.

Consequently:
- **Anonymous blocking is verified end-to-end.**
- **Authorized-user success and cross-tenant denial are verified at the predicate level, not over HTTP.** The remaining unverified link is only that a real signed-in request reaches the guard with a correct `auth.uid()` — which is standard PostgREST behaviour and is the same mechanism every existing RLS policy in this project already relies on.
- **Recommended manual check:** sign in as a normal business owner and open **Reports** and the **Dashboard**. If the KPI cards, timeline chart, top-products list and top-sales widgets render as before, the authorized path is confirmed. If they show a `42501 access denied for this business` error, roll back using §8 and report it.

## 7. Regression verification

| Check | Result |
|---|---|
| TypeScript (`tsgo --noEmit -p tsconfig.app.json`) | **PASS** — 0 errors |
| ESLint (`src/`) | 111 errors / 14 warnings — **unchanged pre-existing baseline**; no frontend file was modified in this phase |
| Production build (`vite build`) | **PASS** — exit 0 |
| Browser smoke (Playwright) | `/inventory`, `/reports`, `/procurement`, `/auth` load; `/admin` correctly redirects to `/auth`; **0 console errors, 0 page errors** |
| Frontend call signatures | Unchanged — all 7 call sites (`useReportsData`, `useReports`, `useOptimizedReports`, `useDashboardReportsData`, `useBusinessInsights`, `useSalesByDimension`, `public-api` edge function) pass the same parameters as before |
| Supabase types (`src/integrations/supabase/types.ts`) | Signatures unchanged, so no regeneration was required |
| Authenticated Dashboard / Reports render | **NOT automatically verified** — see §6 limitation. Manual pass required. |

The Supabase linter reports 105 findings project-wide; these are pre-existing (`Extension in Public`, plus a large set of other `SECURITY DEFINER` functions still executable anonymously). The two functions in this phase are **no longer** among the anon-executable set. The remaining ones are outside the scope of A2.S1.

## 8. Rollback

Restores the pre-fix behaviour exactly, including the vulnerability. Only use if the authorized path is found to be broken.

```sql
-- 1. Remove the guard from both functions by re-creating them without the
--    "Phase A2.S1 authorization guard" block. The pre-fix bodies are preserved
--    verbatim in the migration history:
--      supabase/migrations/  (the A2.S1 migration files — take the body BELOW the guard)
--    Re-apply each CREATE OR REPLACE with the guard block deleted.

-- 2. Restore the original grants (this re-exposes the data publicly):
GRANT EXECUTE ON FUNCTION public.reports_aggregate(uuid, timestamptz, timestamptz) TO PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_top_sales_by_dimension(uuid, timestamptz, timestamptz, text, integer) TO PUBLIC, anon, authenticated, service_role;

-- 3. Drop the helper:
DROP FUNCTION IF EXISTS public.can_access_business_analytics(uuid, uuid);
```

**Safer partial rollback**, if the guard turns out to be too strict for a legitimate role: keep the revoked `anon`/`PUBLIC` grants (step 2 omitted) and only widen the membership branches inside `can_access_business_analytics`. That fixes access without re-opening anonymous access.

## 9. Confirmation of scope

Changed:
- `public.reports_aggregate` — guard block added; body otherwise identical.
- `public.get_top_sales_by_dimension` — guard block added; body otherwise identical.
- `public.can_access_business_analytics` — new helper, used only by the two functions above.
- `EXECUTE` grants on exactly those three functions.

Not changed: no table schema, no index, no RLS policy, no trigger, no other function, no other grant, no data rows, no billing or subscription logic, no payment flow, no frozen file under `CODE_FREEZE_SUBSCRIPTION.md`, no dependency, no frontend source file, no UI. Phase A2's remaining items (S2, S3, C1–C4) and the `useYearOverYear` / analytics migration were **not** started.
