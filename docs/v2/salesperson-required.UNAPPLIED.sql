-- DO NOT APPLY. SUPERSEDED.
--
-- The previous combined script enforced a salesperson in the same transaction
-- that added the column. A legacy sale open in an older browser would fail
-- immediately, because that browser does not send salesperson_employee_id.
--
-- Approved order, still not executed:
--   docs/v2/salesperson-required-a.additive.sql
--   frontend deploy that can send the employee, with the flags still reviewed
--   docs/v2/salesperson-required-b.enforcement.sql
--
-- Recovery, only if a later approval needs to undo B or an unused A:
--   docs/v2/salesperson-required.rollback.manual.sql

DO $superseded$
BEGIN
  RAISE EXCEPTION 'do not apply this file; use salesperson-required-a then salesperson-required-b';
END;
$superseded$;
