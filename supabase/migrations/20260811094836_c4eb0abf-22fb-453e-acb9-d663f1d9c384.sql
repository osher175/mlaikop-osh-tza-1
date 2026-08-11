ALTER TABLE public.import_order_items
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS size_label text,
  ADD COLUMN IF NOT EXISTS local_alternative_unit_cost_ils numeric;

COMMENT ON COLUMN public.import_order_items.local_alternative_unit_cost_ils IS
  'Optional historical snapshot: price per unit the business could have paid a local Israeli supplier at import decision time. Used for import-vs-local comparison only.';