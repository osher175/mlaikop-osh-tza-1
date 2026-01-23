-- Update reports_aggregate function to ensure correct calendar year behavior
-- No hardcoded dates - the function uses date_from and date_to parameters
-- The calling code provides January 1st as start date for each calendar year

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
BEGIN
  -- Total items added to inventory in the period
  SELECT COALESCE(SUM(ia.quantity_changed), 0)
    INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Total items removed from inventory (sales only with financial data)
  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0)
    INTO total_removed
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Total inventory value (cost-based)
  SELECT COALESCE(SUM(ia.quantity_changed * COALESCE(p.cost, 0)), 0)
    INTO total_value
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Calculate revenue (gross - includes VAT) from sales with financial data
  SELECT COALESCE(SUM(ia.sale_total_ils), 0)
    INTO revenue_gross
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Calculate net revenue (without 18% VAT)
  revenue_net := revenue_gross / 1.18;

  -- Calculate COGS (already without VAT)
  SELECT COALESCE(SUM(COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed)), 0)
    INTO cogs_total
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Gross profit (mixed - revenue with VAT minus COGS without VAT)
  gross_profit := revenue_gross - cogs_total;

  -- Net profit = revenue_net - COGS (both without VAT)
  net_profit := ROUND(revenue_net - cogs_total, 2);

  -- Top selling product (by quantity sold, only financial sales)
  SELECT p.name
    INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second'
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  -- Suppliers breakdown
  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', p.supplier_id,
        'total_purchased', SUM(ia.quantity_changed)
      ))
      INTO suppliers_breakdown
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
    GROUP BY p.supplier_id;
  EXCEPTION WHEN OTHERS THEN
    suppliers_breakdown := '[]'::jsonb;
  END;

  -- Timeline breakdown (daily sales)
  SELECT jsonb_agg(row_to_json(t))
    INTO timeline_breakdown
  FROM (
    SELECT
      to_char(ia.timestamp, 'YYYY-MM-DD') as date,
      SUM(ABS(ia.quantity_changed)) as sales
    FROM public.inventory_actions ia
    WHERE ia.action_type = 'remove'
      AND ia.sale_total_ils IS NOT NULL
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  RETURN jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', ROUND(gross_profit, 2),
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', COALESCE(suppliers_breakdown, '[]'::jsonb),
    'timeline_breakdown', COALESCE(timeline_breakdown, '[]'::jsonb)
  );
END;
$function$;

COMMENT ON FUNCTION public.reports_aggregate IS 'Aggregate business reports for a date range. Financial year resets every January 1st. Net profit = (revenue / 1.18) - COGS.';