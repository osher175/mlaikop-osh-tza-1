-- UNAPPLIED. DO NOT EXECUTE.
-- Not in supabase/migrations.
-- Depends on docs/v2/production-upgrade/01_employees.additive.sql.
-- Do not also apply docs/v2/quick-sale-transaction.UNAPPLIED.sql.
--
-- Adds sale_transactions and sale_lines.
-- Adds a unique key on (business_id, id) to products and inventory_actions
-- only when that key is missing, so a composite foreign key can keep a line
-- inside one business. Those keys do not change any stored value.
-- Does not update quantities, prices, costs, or historical sales.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '180s';

DO $preconditions$
BEGIN
  IF to_regclass('public.employees') IS NULL THEN
    RAISE EXCEPTION 'apply 01_employees.additive.sql first';
  END IF;
  IF to_regprocedure('public.is_business_member(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.is_business_member(uuid,uuid) is required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products'
      AND column_name IN ('id', 'business_id', 'quantity', 'cost', 'updated_at')
    HAVING count(*) = 5
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_actions'
      AND column_name IN (
        'id', 'business_id', 'product_id', 'user_id', 'action_type', 'quantity_changed',
        'sale_total_ils', 'cost_snapshot_ils', 'reference_type', 'reference_id', 'source',
        'is_reversal', 'reversed_at', 'reversed_by', 'reverses_action_id', 'timestamp'
      )
    HAVING count(*) = 16
  ) THEN
    RAISE EXCEPTION 'products or inventory_actions is missing a column this upgrade reads';
  END IF;
  IF (
    to_regclass('public.sale_transactions') IS NULL
  ) <> (
    to_regclass('public.sale_lines') IS NULL
  ) THEN
    RAISE EXCEPTION 'only one quick-sale table exists; reconcile before continuing';
  END IF;
END;
$preconditions$;

-- Composite foreign keys need a unique key on (business_id, id).
-- The primary key on id does not satisfy that reference. Building the key
-- locks the table and validates existing rows; it does not rewrite them.
DO $product_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'public.products'::regclass
      AND con.contype IN ('u', 'p')
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
      ) = ARRAY['business_id', 'id']
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_business_id_id_key UNIQUE (business_id, id);
  END IF;
END;
$product_key$;

DO $action_key$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    WHERE con.conrelid = 'public.inventory_actions'::regclass
      AND con.contype IN ('u', 'p')
      AND (
        SELECT array_agg(att.attname::text ORDER BY cols.ord)
        FROM unnest(con.conkey) WITH ORDINALITY AS cols(attnum, ord)
        JOIN pg_attribute att
          ON att.attrelid = con.conrelid AND att.attnum = cols.attnum
      ) = ARRAY['business_id', 'id']
  ) THEN
    ALTER TABLE public.inventory_actions
      ADD CONSTRAINT inventory_actions_business_id_id_key UNIQUE (business_id, id);
  END IF;
END;
$action_key$;

DO $sale_tables$
BEGIN
  IF to_regclass('public.sale_transactions') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'sale_transactions' AND c.relrowsecurity
    ) OR NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'sale_lines' AND c.relrowsecurity
    ) THEN
      RAISE EXCEPTION 'quick-sale tables exist without row level security';
    END IF;
    RAISE NOTICE 'quick-sale tables already present; rows were not changed';
    RETURN;
  END IF;

  EXECUTE $ddl$
    CREATE TABLE public.sale_transactions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
      idempotency_key uuid NOT NULL,
      sold_at timestamptz NOT NULL DEFAULT now(),
      salesperson_employee_id uuid NULL,
      status text NOT NULL DEFAULT 'completed',
      notes text NULL,
      vat_rate numeric(6, 4) NOT NULL,
      currency text NOT NULL DEFAULT 'ILS',
      line_count integer NOT NULL,
      units_total integer NOT NULL,
      revenue_gross_ils numeric(16, 2) NOT NULL,
      revenue_net_ils numeric(16, 2) NOT NULL,
      vat_amount_ils numeric(16, 2) NOT NULL,
      known_cost_ex_vat_ils numeric(16, 2) NULL,
      cost_known_lines integer NOT NULL,
      created_by uuid NOT NULL,
      reversed_at timestamptz NULL,
      reversed_by uuid NULL,
      CONSTRAINT sale_transactions_business_id_id_key UNIQUE (business_id, id),
      CONSTRAINT sale_transactions_idempotency_key UNIQUE (business_id, idempotency_key),
      CONSTRAINT sale_transactions_status_check CHECK (status IN ('completed', 'reversed')),
      CONSTRAINT sale_transactions_currency_check CHECK (currency = 'ILS'),
      CONSTRAINT sale_transactions_vat_check CHECK (vat_rate >= 0 AND vat_rate < 1),
      CONSTRAINT sale_transactions_notes_check CHECK (notes IS NULL OR length(notes) <= 500),
      CONSTRAINT sale_transactions_reversal_check CHECK (
        (status = 'completed' AND reversed_at IS NULL AND reversed_by IS NULL)
        OR (status = 'reversed' AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL)
      ),
      CONSTRAINT sale_transactions_totals_check CHECK (
        line_count BETWEEN 1 AND 50
        AND units_total BETWEEN line_count AND line_count * 10000
        AND revenue_gross_ils >= 0
        AND revenue_net_ils = round(revenue_gross_ils / (1 + vat_rate), 2)
        AND vat_amount_ils = revenue_gross_ils - revenue_net_ils
        AND cost_known_lines BETWEEN 0 AND line_count
        AND (
          (cost_known_lines = 0 AND known_cost_ex_vat_ils IS NULL)
          OR (cost_known_lines > 0 AND known_cost_ex_vat_ils IS NOT NULL AND known_cost_ex_vat_ils >= 0)
        )
      )
    );

    ALTER TABLE public.sale_transactions
      ADD CONSTRAINT sale_transactions_salesperson_fkey
      FOREIGN KEY (business_id, salesperson_employee_id)
      REFERENCES public.employees (business_id, id)
      ON DELETE RESTRICT;

    CREATE TABLE public.sale_lines (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL,
      transaction_id uuid NOT NULL,
      product_id uuid NOT NULL,
      position integer NOT NULL,
      quantity integer NOT NULL,
      unit_price_gross_ils numeric(16, 2) NOT NULL,
      vat_rate numeric(6, 4) NOT NULL,
      unit_cost_ils numeric(16, 2) NULL,
      line_revenue_gross_ils numeric(16, 2) NOT NULL,
      line_revenue_net_ils numeric(16, 2) NOT NULL,
      line_vat_ils numeric(16, 2) NOT NULL,
      line_cost_ex_vat_ils numeric(16, 2) NULL,
      inventory_action_id uuid NOT NULL,
      axle text NOT NULL DEFAULT 'single',
      CONSTRAINT sale_lines_business_id_id_key UNIQUE (business_id, id),
      CONSTRAINT sale_lines_position_key UNIQUE (transaction_id, position),
      CONSTRAINT sale_lines_action_key UNIQUE (inventory_action_id),
      CONSTRAINT sale_lines_position_check CHECK (position > 0),
      CONSTRAINT sale_lines_quantity_check CHECK (quantity BETWEEN 1 AND 10000),
      CONSTRAINT sale_lines_price_check CHECK (unit_price_gross_ils >= 0 AND unit_price_gross_ils <= 9999999.99),
      CONSTRAINT sale_lines_vat_check CHECK (vat_rate >= 0 AND vat_rate < 1),
      CONSTRAINT sale_lines_cost_check CHECK (unit_cost_ils IS NULL OR unit_cost_ils >= 0),
      CONSTRAINT sale_lines_axle_check CHECK (axle IN ('single', 'front', 'rear')),
      CONSTRAINT sale_lines_money_check CHECK (
        line_revenue_gross_ils = round(unit_price_gross_ils * quantity, 2)
        AND line_revenue_net_ils = round(line_revenue_gross_ils / (1 + vat_rate), 2)
        AND line_vat_ils = line_revenue_gross_ils - line_revenue_net_ils
        AND (
          (unit_cost_ils IS NULL AND line_cost_ex_vat_ils IS NULL)
          OR (
            unit_cost_ils IS NOT NULL
            AND line_cost_ex_vat_ils = round(unit_cost_ils * quantity, 2)
          )
        )
      ),
      CONSTRAINT sale_lines_transaction_fkey
        FOREIGN KEY (business_id, transaction_id)
        REFERENCES public.sale_transactions (business_id, id)
        ON DELETE RESTRICT,
      CONSTRAINT sale_lines_product_fkey
        FOREIGN KEY (business_id, product_id)
        REFERENCES public.products (business_id, id)
        ON DELETE RESTRICT,
      CONSTRAINT sale_lines_action_fkey
        FOREIGN KEY (business_id, inventory_action_id)
        REFERENCES public.inventory_actions (business_id, id)
        ON DELETE RESTRICT
    );

    CREATE INDEX sale_transactions_business_sold_idx
      ON public.sale_transactions (business_id, sold_at)
      WHERE status = 'completed';
    CREATE INDEX sale_lines_business_transaction_idx
      ON public.sale_lines (business_id, transaction_id);
    CREATE INDEX sale_lines_business_product_idx
      ON public.sale_lines (business_id, product_id);

    COMMENT ON TABLE public.sale_transactions IS
      'One V2 sale. Dashboard revenue is recomputed from sale_lines by the application. These header totals are the confirmation snapshot, using the same 18% VAT-inclusive gross. inventory_actions rows for this sale keep sale_total_ils NULL so legacy reports do not count them again.';
    COMMENT ON COLUMN public.sale_transactions.salesperson_employee_id IS
      'Active employee of this business at confirmation, or NULL for an explicit unattributed sale. Never inventory_actions.user_id.';
    COMMENT ON COLUMN public.sale_transactions.known_cost_ex_vat_ils IS
      'Sum of known ex-VAT line costs, including a genuine zero. NULL when every line cost is unknown. Not a full profit figure when cost_known_lines is below line_count.';
    COMMENT ON COLUMN public.sale_lines.unit_cost_ils IS
      'Ex-VAT unit cost copied from products.cost at confirmation. NULL is unknown. Zero stays zero.';
    COMMENT ON COLUMN public.sale_lines.line_revenue_net_ils IS
      'Per-line net. The transaction net is rounded from the transaction gross, matching the application quote, and can differ from the sum of these line nets by a few agorot.';

    REVOKE ALL ON public.sale_transactions FROM PUBLIC, anon, authenticated;
    REVOKE ALL ON public.sale_lines FROM PUBLIC, anon, authenticated;
    GRANT SELECT ON public.sale_transactions TO authenticated;
    GRANT SELECT ON public.sale_lines TO authenticated;
    GRANT ALL ON public.sale_transactions TO service_role;
    GRANT ALL ON public.sale_lines TO service_role;

    ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.sale_lines ENABLE ROW LEVEL SECURITY;

    CREATE POLICY sale_transactions_member_read ON public.sale_transactions
      FOR SELECT TO authenticated
      USING (public.is_business_member(business_id, auth.uid()));
    CREATE POLICY sale_lines_member_read ON public.sale_lines
      FOR SELECT TO authenticated
      USING (public.is_business_member(business_id, auth.uid()));
  $ddl$;
END;
$sale_tables$;

COMMIT;
