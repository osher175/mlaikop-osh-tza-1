
## Diagnosis

Queried `api_keys` for business **צמיגי פאר** (`0ed7a81d-cd0b-45fe-9ed7-6961412a7f5f`). Existing keys:

| Name | Prefix | Scope | Rate/min | Status |
|---|---|---|---|---|
| QA Public A | `riq_Z_885A-i` | **public** | 60 | active |
| QA Retail IQ A | `riq_v-bmneuD` | **retail_iq** | **5** | active (QA only) |
| Integration-Test | `mlk_ra34mc1Y` | **public** | 60 | active |
| WorkAgent-Test | `mlk_WBxuAUX4` | public | 60 | revoked |

→ The key configured in Retail IQ is almost certainly `riq_Z_885A-i` (public) or `mlk_ra34mc1Y` (public). The only `retail_iq`-scoped key is the QA one capped at 5 req/min — unsuitable for production.

## Plan

1. **Mint a new production key** for צמיגי פאר with:
   - `name = "Retail IQ Production"`
   - `scope = retail_iq`
   - `rate_limit_per_min = 120`
   - `business_id = 0ed7a81d-cd0b-45fe-9ed7-6961412a7f5f`
   - `expires_at = NULL`

   Since `key_hash` requires the SHA-256 of the raw token (and the raw token is shown only once), I will mint via a one-off Deno script invoking the same `generateKey()` + `sha256Hex()` logic used by `api-keys-manage`, then INSERT the row directly. The raw `riq_…` token will be returned in chat once and **not** stored anywhere else.

2. **Verify** with `SELECT id, name, key_prefix, scope, rate_limit_per_min FROM api_keys WHERE id = <new>` and confirm `scope='retail_iq'`.

3. **Smoke-test** the new key against the live endpoint:
   ```
   curl -H "x-mlaiko-api-key: <new>" \
        https://gtakgctmtayalcbpnryg.supabase.co/functions/v1/retail-iq-api/branches
   ```
   Expect `200` with the business row (not `401 scope_mismatch`).

4. **Hand off** the raw key to you; you paste it into Retail IQ and re-run your connector test. (Optionally revoke `QA Retail IQ A` once production key is in use — will ask before doing so.)

## Files / changes

- **No source code changes.** No migrations, no edge-function edits.
- One INSERT into `public.api_keys` (single row).
- One temporary local script to generate the token + hash; deleted after use.

## Out of scope

- Rotating or revoking the existing `public`-scoped keys (`riq_Z_885A-i`, `mlk_ra34mc1Y`) — leave untouched unless you ask.
- Any change to the `retail-iq-api` function itself (it already validates scope correctly, which is exactly why the current request was rejected).
