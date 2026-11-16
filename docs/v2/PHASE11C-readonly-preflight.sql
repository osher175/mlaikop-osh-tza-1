-- READ ONLY. Run manually in the Supabase SQL Editor.
-- SELECT and metadata only. Do not add INSERT, UPDATE, DELETE, or any RPC.
-- Results are names and counts. They do not include customer, payment, or sale rows.

SELECT to_regclass('public.employees') AS employees_table,
       to_regclass('public.sale_transactions') AS sale_transactions_table,
       to_regclass('public.sale_lines') AS sale_lines_table,
       to_regclass('public.import_payments') AS import_payments_table,
       to_regprocedure('public.record_legacy_sale(uuid,uuid,integer,numeric,uuid,text,uuid)') AS record_legacy_sale,
       to_regprocedure('public.record_purchase_receipt(uuid,uuid,integer,uuid,numeric,uuid,text)') AS record_purchase_receipt,
       to_regprocedure('public.record_customer_return(uuid,uuid,integer,uuid,text,text)') AS record_customer_return,
       to_regprocedure('public.record_supplier_return(uuid,uuid,uuid,integer,uuid,text,text)') AS record_supplier_return,
       to_regprocedure('public.sale_cost_known(numeric,text)') AS sale_cost_known,
       to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') AS complete_quick_sale,
       to_regprocedure('public.reverse_quick_sale(uuid,uuid)') AS reverse_quick_sale;

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'import_payments'
  AND column_name IN ('payment_method', 'client_request_id', 'payee_supplier_id', 'payment_status', 'amount_ils')
ORDER BY column_name;

SELECT conname
FROM pg_constraint
WHERE conrelid = 'public.inventory_actions'::regclass
  AND conname = 'check_sale_data';

SELECT COUNT(*) AS employee_rows FROM public.employees;
SELECT COUNT(*) AS sale_transaction_rows FROM public.sale_transactions;
SELECT COUNT(*) AS legacy_sale_request_rows
FROM public.inventory_actions
WHERE reference_type = 'legacy_sale_request';
SELECT COUNT(*) AS customer_return_rows
FROM public.inventory_actions
WHERE reference_type = 'customer_return';
SELECT COUNT(*) AS supplier_return_rows
FROM public.inventory_actions
WHERE reference_type = 'supplier_return';
