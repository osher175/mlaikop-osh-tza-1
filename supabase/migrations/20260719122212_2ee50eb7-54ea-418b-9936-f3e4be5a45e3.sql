
-- Add reversal columns to inventory_actions
ALTER TABLE public.inventory_actions
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reversed_by UUID,
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reverses_action_id UUID REFERENCES public.inventory_actions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_actions_reverses ON public.inventory_actions(reverses_action_id) WHERE reverses_action_id IS NOT NULL;

-- RPC: reverse an inventory action within 10 minutes
CREATE OR REPLACE FUNCTION public.reverse_inventory_action(p_action_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_action RECORD;
  v_user UUID := auth.uid();
  v_is_member BOOLEAN;
  v_is_admin BOOLEAN;
  v_new_qty INTEGER;
  v_reversal_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_action FROM public.inventory_actions WHERE id = p_action_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Action not found';
  END IF;

  IF v_action.is_reversal THEN
    RAISE EXCEPTION 'Cannot reverse a reversal';
  END IF;
  IF v_action.reversed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Action already reversed';
  END IF;
  IF v_action.action_type NOT IN ('remove','sale') THEN
    RAISE EXCEPTION 'Only sales/removals can be reversed via this action';
  END IF;
  IF now() - v_action.timestamp > interval '10 minutes' THEN
    RAISE EXCEPTION 'Undo window (10 minutes) has expired';
  END IF;

  -- Permission: original user, or owner/admin of business, or platform admin
  SELECT EXISTS (
    SELECT 1 FROM public.business_users bu
    WHERE bu.business_id = v_action.business_id
      AND bu.user_id = v_user
      AND bu.role IN ('owner','admin')
  ) INTO v_is_member;

  SELECT public.has_role(v_user, 'admin'::app_role) INTO v_is_admin;

  IF v_action.user_id <> v_user AND NOT v_is_member AND NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized to reverse this action';
  END IF;

  -- Restore product quantity (original changed by quantity_changed, so subtract it)
  UPDATE public.products
    SET quantity = quantity - v_action.quantity_changed,
        updated_at = now()
    WHERE id = v_action.product_id AND business_id = v_action.business_id
    RETURNING quantity INTO v_new_qty;

  -- Insert reversal row (flagged as reversal so reports ignore it)
  INSERT INTO public.inventory_actions (
    business_id, user_id, product_id, action_type, quantity_changed,
    currency, sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent,
    cost_snapshot_ils, notes, timestamp,
    is_reversal, reverses_action_id
  ) VALUES (
    v_action.business_id, v_user, v_action.product_id, v_action.action_type,
    -v_action.quantity_changed,
    v_action.currency, v_action.sale_total_ils, v_action.sale_unit_ils, v_action.list_unit_ils,
    v_action.discount_ils, v_action.discount_percent, v_action.cost_snapshot_ils,
    'ביטול פעולה', now(),
    true, v_action.id
  )
  RETURNING id INTO v_reversal_id;

  -- Mark original as reversed
  UPDATE public.inventory_actions
    SET reversed_at = now(), reversed_by = v_user
    WHERE id = v_action.id;

  RETURN jsonb_build_object(
    'success', true,
    'reversal_id', v_reversal_id,
    'action_id', v_action.id,
    'new_quantity', v_new_qty
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.reverse_inventory_action(UUID) TO authenticated;

-- Update reports_aggregate to exclude reversed rows and reversal rows
CREATE OR REPLACE FUNCTION public.reports_aggregate(business_id uuid, date_from timestamp with time zone, date_to timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_added integer;
  total_removed integer;
  total_value numeric;
  gross_profit numeric;
  net_profit numeric;
  revenue_gross numeric;
  revenue_net numeric;
  cogs_total numeric;
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
  top_products_list jsonb := '[]'::jsonb;
  purchases_breakdown jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(SUM(ia.quantity_changed), 0) INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0) INTO total_removed
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0)), 0) INTO total_value
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  SELECT COALESCE(SUM(ia.sale_total_ils), 0) INTO revenue_gross
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  revenue_net := revenue_gross / 1.18;

  SELECT COALESCE(SUM(COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed)), 0) INTO cogs_total
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL;

  gross_profit := revenue_gross - cogs_total;
  net_profit := ROUND(revenue_net - cogs_total, 2);

  SELECT p.name INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
    AND ia.is_reversal = false AND ia.reversed_at IS NULL
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO suppliers_breakdown
  FROM (
    SELECT s.id as supplier_id, COALESCE(s.name, 'ללא ספק') as supplier_name,
           SUM(ia.quantity_changed) as total_purchased
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY s.id, s.name
    ORDER BY SUM(ia.quantity_changed) DESC
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO timeline_breakdown
  FROM (
    SELECT to_char(ia.timestamp, 'YYYY-MM-DD') as date,
           SUM(ABS(ia.quantity_changed)) as sales,
           COALESCE(SUM(ia.sale_total_ils), 0) as sales_amount
    FROM public.inventory_actions ia
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO top_products_list
  FROM (
    SELECT p.id as product_id, p.name as product_name,
           SUM(ABS(ia.quantity_changed)) as quantity_sold,
           COALESCE(SUM(ia.sale_total_ils), 0) as revenue
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY p.id, p.name
    ORDER BY SUM(ABS(ia.quantity_changed)) DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO purchases_breakdown
  FROM (
    SELECT to_char(ia.timestamp, 'YYYY-MM') as month,
           SUM(ia.quantity_changed) as quantity,
           COALESCE(SUM(ia.purchase_total_ils), SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0))) as amount
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from AND ia.timestamp < date_to + interval '1 second'
      AND ia.is_reversal = false AND ia.reversed_at IS NULL
    GROUP BY to_char(ia.timestamp, 'YYYY-MM')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM')
  ) t;

  RETURN jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', ROUND(gross_profit, 2),
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', suppliers_breakdown,
    'timeline_breakdown', timeline_breakdown,
    'top_products_list', top_products_list,
    'purchases_breakdown', purchases_breakdown
  );
END;
$function$;

-- Update get_top_sales_by_dimension similarly
CREATE OR REPLACE FUNCTION public.get_top_sales_by_dimension(p_business_id uuid, p_date_from timestamp with time zone, p_date_to timestamp with time zone, p_dimension text DEFAULT 'product'::text, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF p_dimension = 'brand' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(b.id::text,'unknown') AS key, COALESCE(b.name,'ללא מותג') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.brands b ON b.id = p.brand_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY b.id, b.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSIF p_dimension = 'category' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(pc.id::text,'unknown') AS key, COALESCE(pc.name,'ללא קטגוריה') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.product_categories pc ON pc.id = p.product_category_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY pc.id, pc.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSIF p_dimension = 'supplier' THEN
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT COALESCE(s.id::text,'unknown') AS key, COALESCE(s.name,'ללא ספק') AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      LEFT JOIN public.suppliers s ON s.id = p.supplier_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY s.id, s.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  ELSE
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO result FROM (
      SELECT p.id::text AS key, p.name AS label,
        SUM(ABS(ia.quantity_changed)) AS quantity_sold, COALESCE(SUM(ia.sale_total_ils),0) AS revenue
      FROM public.inventory_actions ia
      JOIN public.products p ON p.id = ia.product_id
      WHERE (ia.action_type='remove' OR ia.action_type='sale')
        AND ia.business_id = p_business_id
        AND ia.timestamp >= p_date_from AND ia.timestamp < p_date_to + interval '1 second'
        AND ia.is_reversal = false AND ia.reversed_at IS NULL
      GROUP BY p.id, p.name ORDER BY SUM(ABS(ia.quantity_changed)) DESC LIMIT p_limit
    ) t;
  END IF;
  RETURN result;
END;
$function$;
