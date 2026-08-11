# Fix: "column reference expires_at is ambiguous" on Import PIN unlock

## What happens
Entering the 4-digit import PIN fails with a database error instead of unlocking the module.

## Cause (verified)
`import_pin_verify` returns a column named `expires_at`, and inside the function it runs:

```text
DELETE FROM public.import_pin_sessions
 WHERE (business_id = p_business_id AND user_id = auth.uid()) OR expires_at < now();
```

The unqualified `expires_at` matches both the table column and the function's own output
parameter, so Postgres rejects the statement as ambiguous. The same applies to the
unqualified `business_id`/`user_id` references in that statement being fine, but
`expires_at` collides.

## Fix
One migration that recreates `public.import_pin_verify` with the delete statement
table-qualified (alias the table and use `s.expires_at`, `s.business_id`, `s.user_id`).
No behaviour, security, or signature change — same arguments, same return columns, same
`SECURITY DEFINER` and `search_path` settings, same lockout logic.

No frontend changes needed; `useImportPin` already handles the response shape.

## Verification
After the migration, re-enter the PIN in the Import module and confirm it unlocks and a
session row is issued.
