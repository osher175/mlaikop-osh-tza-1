-- UNAPPLIED. DO NOT EXECUTE.
-- Not in supabase/migrations.
-- Depends on docs/v2/production-upgrade/02_sale_tables.additive.sql.
--
-- New functions only. This file does not replace reverse_inventory_action
-- or any other existing function. CREATE OR REPLACE is intentionally unused.
-- The new trigger blocks the legacy reversal RPC from reversing one line of
-- a multi-line sale. Legacy rows are not affected.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $rpcs$
BEGIN
  IF to_regclass('public.sale_transactions') IS NULL OR to_regclass('public.sale_lines') IS NULL THEN
    RAISE EXCEPTION 'apply 02_sale_tables.additive.sql first';
  END IF;
  IF to_regprocedure('public.can_business_write(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.can_business_write(uuid) is required';
  END IF;
  IF to_regprocedure('public.reverse_inventory_action(uuid)') IS NULL THEN
    RAISE EXCEPTION 'public.reverse_inventory_action(uuid) must remain in place; this file does not recreate it';
  END IF;

  IF to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NOT NULL
     OR to_regprocedure('public.reverse_quick_sale(uuid,uuid)') IS NOT NULL
     OR to_regprocedure('public.guard_quick_sale_movement()') IS NOT NULL THEN
    IF to_regprocedure('public.complete_quick_sale(uuid,uuid,uuid,text,jsonb)') IS NULL
       OR to_regprocedure('public.reverse_quick_sale(uuid,uuid)') IS NULL
       OR to_regprocedure('public.guard_quick_sale_movement()') IS NULL THEN
      RAISE EXCEPTION 'only some quick-sale functions exist; reconcile before continuing';
    END IF;
    RAISE NOTICE 'quick-sale functions already present; existing function bodies were not replaced';
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_guard_quick_sale_movement' AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'trg_guard_quick_sale_movement already exists';
  END IF;

  EXECUTE $ddl$
    CREATE FUNCTION public.guard_quick_sale_movement()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY INVOKER
    SET search_path = public
    AS $guard$
    BEGIN
      IF OLD.reference_type = 'sale_transaction'
         AND (
           NEW.reversed_at IS DISTINCT FROM OLD.reversed_at
           OR NEW.is_reversal IS DISTINCT FROM OLD.is_reversal
         )
         AND current_setting('mlaiko.quick_sale_reversal', true) IS DISTINCT FROM 'on' THEN
        RAISE EXCEPTION 'A quick-sale movement can be reversed only through reverse_quick_sale'
          USING ERRCODE = '42501';
      END IF;
      RETURN NEW;
    END;
    $guard$;

    REVOKE ALL ON FUNCTION public.guard_quick_sale_movement() FROM PUBLIC, anon, authenticated;

    CREATE TRIGGER trg_guard_quick_sale_movement
      BEFORE UPDATE ON public.inventory_actions
      FOR EACH ROW EXECUTE FUNCTION public.guard_quick_sale_movement();

    CREATE FUNCTION public.complete_quick_sale(
      p_business_id uuid,
      p_idempotency_key uuid,
      p_salesperson_employee_id uuid,
      p_notes text,
      p_lines jsonb
    )
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $complete$
    DECLARE
      v_uid uuid := auth.uid();
      v_existing uuid;
      v_txn uuid;
      v_active boolean;
      v_rec record;
      v_item jsonb;
      v_index integer := 0;
      v_product uuid;
      v_qty integer;
      v_price numeric;
      v_axle text;
      v_stock integer;
      v_cost numeric;
      v_action uuid;
      v_needed integer;
      v_line_gross numeric(16, 2);
      v_line_net numeric(16, 2);
      v_line_vat numeric(16, 2);
      v_line_cost numeric(16, 2);
      v_units integer := 0;
      v_gross numeric(16, 2) := 0;
      v_known_cost numeric(16, 2) := 0;
      v_known_lines integer := 0;
      v_net numeric(16, 2);
      v_vat_amount numeric(16, 2);
      v_prepared jsonb := '[]'::jsonb;
      v_vat numeric(6, 4) := 0.1800; -- src/lib/financialConfig.ts VAT_RATE
    BEGIN
      IF v_uid IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
      END IF;
      IF p_business_id IS NULL OR p_idempotency_key IS NULL OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'invalid quick sale';
      END IF;
      IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
         OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
      END IF;
      IF jsonb_array_length(p_lines) < 1 OR jsonb_array_length(p_lines) > 50 THEN
        RAISE EXCEPTION 'a sale needs between 1 and 50 lines';
      END IF;
      IF p_notes IS NOT NULL AND length(p_notes) > 500 THEN
        RAISE EXCEPTION 'notes are too long';
      END IF;

      -- Same key waits for the in-flight attempt, then sees its committed row.
      PERFORM pg_advisory_xact_lock(
        hashtextextended(p_business_id::text || ':' || p_idempotency_key::text, 0)
      );

      SELECT id INTO v_existing
      FROM public.sale_transactions
      WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
      IF v_existing IS NOT NULL THEN
        RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
      END IF;

      IF p_salesperson_employee_id IS NOT NULL THEN
        SELECT e.is_active INTO v_active
        FROM public.employees e
        WHERE e.id = p_salesperson_employee_id AND e.business_id = p_business_id;
        IF v_active IS DISTINCT FROM true THEN
          RAISE EXCEPTION 'salesperson must be an active employee of this business' USING ERRCODE = '42501';
        END IF;
      END IF;

      PERFORM p.id
      FROM public.products p
      WHERE p.business_id = p_business_id
        AND p.id IN (
          SELECT DISTINCT (line->>'product_id')::uuid
          FROM jsonb_array_elements(p_lines) line
        )
      ORDER BY p.id
      FOR UPDATE;

      FOR v_product, v_needed IN
        SELECT (line->>'product_id')::uuid, SUM((line->>'quantity')::integer)::integer
        FROM jsonb_array_elements(p_lines) line
        GROUP BY 1
      LOOP
        IF v_product IS NULL OR v_needed IS NULL OR v_needed < 1 OR v_needed > 100000 THEN
          RAISE EXCEPTION 'invalid quantity';
        END IF;
        SELECT quantity INTO v_stock
        FROM public.products
        WHERE id = v_product AND business_id = p_business_id;
        IF v_stock IS NULL THEN
          RAISE EXCEPTION 'product is not in this business';
        END IF;
        IF v_stock < v_needed THEN
          RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
        END IF;
      END LOOP;

      FOR v_rec IN
        SELECT line.value AS item, line.ordinality::integer AS line_position
        FROM jsonb_array_elements(p_lines) WITH ORDINALITY AS line(value, ordinality)
      LOOP
        v_index := v_rec.line_position;
        v_item := v_rec.item;
        v_product := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::integer;
        v_price := (v_item->>'unit_price_gross')::numeric;
        v_axle := COALESCE(v_item->>'axle', 'single');
        IF v_product IS NULL
           OR v_qty IS NULL OR v_qty < 1 OR v_qty > 10000
           OR v_price IS NULL OR v_price < 0 OR v_price > 9999999.99
           OR v_price <> round(v_price, 2)
           OR v_axle NOT IN ('single', 'front', 'rear') THEN
          RAISE EXCEPTION 'invalid sale line';
        END IF;

        SELECT cost INTO v_cost
        FROM public.products
        WHERE id = v_product AND business_id = p_business_id;
        IF v_cost IS NOT NULL AND v_cost < 0 THEN
          RAISE EXCEPTION 'product cost is invalid';
        END IF;

        v_line_gross := round(v_price * v_qty, 2);
        v_line_net := round(v_line_gross / (1 + v_vat), 2);
        v_line_vat := v_line_gross - v_line_net;
        v_line_cost := CASE WHEN v_cost IS NULL THEN NULL ELSE round(v_cost * v_qty, 2) END;
        v_units := v_units + v_qty;
        v_gross := v_gross + v_line_gross;
        IF v_cost IS NULL THEN
          NULL;
        ELSE
          v_known_lines := v_known_lines + 1;
          v_known_cost := v_known_cost + v_line_cost;
        END IF;

        v_prepared := v_prepared || jsonb_build_array(jsonb_build_object(
          'position', v_index,
          'product_id', v_product,
          'quantity', v_qty,
          'unit_price_gross', v_price,
          'axle', v_axle,
          'unit_cost', v_cost,
          'line_gross', v_line_gross,
          'line_net', v_line_net,
          'line_vat', v_line_vat,
          'line_cost', v_line_cost
        ));
      END LOOP;

      IF v_index <> jsonb_array_length(p_lines) THEN
        RAISE EXCEPTION 'invalid quick sale';
      END IF;

      v_net := round(v_gross / (1 + v_vat), 2);
      v_vat_amount := v_gross - v_net;

      INSERT INTO public.sale_transactions (
        business_id, idempotency_key, salesperson_employee_id, notes, vat_rate, created_by,
        line_count, units_total, revenue_gross_ils, revenue_net_ils, vat_amount_ils,
        known_cost_ex_vat_ils, cost_known_lines
      ) VALUES (
        p_business_id, p_idempotency_key, p_salesperson_employee_id,
        NULLIF(btrim(p_notes), ''), v_vat, v_uid,
        v_index, v_units, v_gross, v_net, v_vat_amount,
        CASE WHEN v_known_lines = 0 THEN NULL ELSE v_known_cost END,
        v_known_lines
      )
      ON CONFLICT (business_id, idempotency_key) DO NOTHING
      RETURNING id INTO v_txn;

      IF v_txn IS NULL THEN
        SELECT id INTO v_existing
        FROM public.sale_transactions
        WHERE business_id = p_business_id AND idempotency_key = p_idempotency_key;
        RETURN jsonb_build_object('transaction_id', v_existing, 'replayed', true);
      END IF;

      FOR v_rec IN
        SELECT value AS item FROM jsonb_array_elements(v_prepared)
      LOOP
        v_item := v_rec.item;
        v_product := (v_item->>'product_id')::uuid;
        v_qty := (v_item->>'quantity')::integer;
        v_price := (v_item->>'unit_price_gross')::numeric;
        v_cost := (v_item->>'unit_cost')::numeric;
        v_index := (v_item->>'position')::integer;
        v_axle := v_item->>'axle';
        v_line_gross := (v_item->>'line_gross')::numeric;
        v_line_net := (v_item->>'line_net')::numeric;
        v_line_vat := (v_item->>'line_vat')::numeric;
        v_line_cost := (v_item->>'line_cost')::numeric;

        UPDATE public.products
        SET quantity = quantity - v_qty,
            updated_at = now()
        WHERE id = v_product
          AND business_id = p_business_id
          AND quantity >= v_qty;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'insufficient stock' USING ERRCODE = '23514';
        END IF;

        INSERT INTO public.inventory_actions (
          business_id, user_id, product_id, action_type, quantity_changed, currency,
          cost_snapshot_ils, sale_unit_ils, list_unit_ils, notes, timestamp,
          reference_type, reference_id, source, is_reversal
        ) VALUES (
          p_business_id, v_uid, v_product, 'sale', -v_qty, 'ILS',
          v_cost, v_price, v_price, 'quick sale', now(),
          'sale_transaction', v_txn, 'sale_transaction', false
        )
        RETURNING id INTO v_action;

        INSERT INTO public.sale_lines (
          business_id, transaction_id, product_id, position, quantity,
          unit_price_gross_ils, vat_rate, unit_cost_ils,
          line_revenue_gross_ils, line_revenue_net_ils, line_vat_ils, line_cost_ex_vat_ils,
          inventory_action_id, axle
        ) VALUES (
          p_business_id, v_txn, v_product, v_index, v_qty,
          v_price, v_vat, v_cost,
          v_line_gross, v_line_net, v_line_vat, v_line_cost,
          v_action, v_axle
        );
      END LOOP;

      RETURN jsonb_build_object('transaction_id', v_txn, 'replayed', false);
    END;
    $complete$;

    CREATE FUNCTION public.reverse_quick_sale(p_business_id uuid, p_transaction_id uuid)
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $reverse$
    DECLARE
      v_uid uuid := auth.uid();
      v_status text;
      v_created_by uuid;
      v_allowed boolean;
      v_line record;
    BEGIN
      IF v_uid IS NULL THEN
        RAISE EXCEPTION 'authentication required' USING ERRCODE = '42501';
      END IF;
      IF p_business_id IS NULL OR p_transaction_id IS NULL THEN
        RAISE EXCEPTION 'invalid reversal';
      END IF;
      IF public.is_business_member(p_business_id, v_uid) IS DISTINCT FROM true
         OR public.can_business_write(p_business_id) IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
      END IF;

      SELECT status, created_by INTO v_status, v_created_by
      FROM public.sale_transactions
      WHERE id = p_transaction_id AND business_id = p_business_id
      FOR UPDATE;
      IF v_status IS NULL THEN
        RAISE EXCEPTION 'sale not found';
      END IF;

      v_allowed := v_created_by = v_uid
        OR EXISTS (
          SELECT 1 FROM public.businesses b
          WHERE b.id = p_business_id AND b.owner_id = v_uid
        )
        OR EXISTS (
          SELECT 1 FROM public.business_users bu
          WHERE bu.business_id = p_business_id
            AND bu.user_id = v_uid
            AND bu.role IN ('owner', 'admin')
        );
      IF v_allowed IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'access denied' USING ERRCODE = '42501';
      END IF;
      IF v_status = 'reversed' THEN
        RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', true);
      END IF;

      PERFORM p.id
      FROM public.products p
      JOIN public.sale_lines l ON l.product_id = p.id AND l.business_id = p.business_id
      WHERE l.transaction_id = p_transaction_id AND l.business_id = p_business_id
      ORDER BY p.id
      FOR UPDATE;

      PERFORM set_config('mlaiko.quick_sale_reversal', 'on', true);

      FOR v_line IN
        SELECT product_id, quantity, inventory_action_id, unit_cost_ils
        FROM public.sale_lines
        WHERE transaction_id = p_transaction_id AND business_id = p_business_id
        ORDER BY position
      LOOP
        UPDATE public.products
        SET quantity = quantity + v_line.quantity,
            updated_at = now()
        WHERE id = v_line.product_id AND business_id = p_business_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'product missing; reversal aborted';
        END IF;

        UPDATE public.inventory_actions
        SET reversed_at = now(),
            reversed_by = v_uid
        WHERE id = v_line.inventory_action_id
          AND business_id = p_business_id
          AND reversed_at IS NULL
          AND reference_type = 'sale_transaction'
          AND reference_id = p_transaction_id;
        IF NOT FOUND THEN
          RAISE EXCEPTION 'sale movement missing; reversal aborted';
        END IF;

        INSERT INTO public.inventory_actions (
          business_id, user_id, product_id, action_type, quantity_changed, currency,
          cost_snapshot_ils, notes, timestamp, reference_type, reference_id, source,
          is_reversal, reverses_action_id
        ) VALUES (
          p_business_id, v_uid, v_line.product_id, 'sale', v_line.quantity, 'ILS',
          v_line.unit_cost_ils, 'quick sale reversal', now(),
          'sale_transaction', p_transaction_id, 'sale_transaction',
          true, v_line.inventory_action_id
        );
      END LOOP;

      UPDATE public.sale_transactions
      SET status = 'reversed',
          reversed_at = now(),
          reversed_by = v_uid
      WHERE id = p_transaction_id
        AND business_id = p_business_id
        AND status = 'completed';
      IF NOT FOUND THEN
        RAISE EXCEPTION 'sale reversal was not recorded';
      END IF;

      RETURN jsonb_build_object('transaction_id', p_transaction_id, 'replayed', false);
    END;
    $reverse$;

    REVOKE ALL ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) FROM PUBLIC, anon;
    REVOKE ALL ON FUNCTION public.reverse_quick_sale(uuid, uuid) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) TO authenticated, service_role;
    GRANT EXECUTE ON FUNCTION public.reverse_quick_sale(uuid, uuid) TO authenticated, service_role;

    COMMENT ON FUNCTION public.complete_quick_sale(uuid, uuid, uuid, text, jsonb) IS
      'Atomically confirms one V2 sale. Retries with the same idempotency key return the original transaction and do not deduct stock again. A different cart must use a new key. Does not update historical transactions.';
    COMMENT ON FUNCTION public.reverse_quick_sale(uuid, uuid) IS
      'Reverses one V2 sale once, restores stock once, and preserves the original transaction and lines. Does not call or replace reverse_inventory_action.';
  $ddl$;
END;
$rpcs$;

COMMIT;
