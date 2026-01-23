-- Update reports_aggregate function with CORRECT net profit formula:
-- net_profit = (SUM(sale_total_ils) / 1.18) - SUM(cost_snapshot_ils * ABS(quantity_changed))
-- Also filter out sales with NULL sale_total_ils (old operational data)

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
  -- Total items added to inventory
  SELECT COALESCE(SUM(ia.quantity_changed), 0)
    INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- Total items removed from inventory (sales only with financial data)
  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0)
    INTO total_removed
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL  -- Only count sales with financial data
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- Total inventory value (cost-based)
  SELECT COALESCE(SUM(ia.quantity_changed * COALESCE(p.cost, 0)), 0)
    INTO total_value
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- Calculate revenue (gross - includes VAT) from sales with financial data
  SELECT COALESCE(SUM(ia.sale_total_ils), 0)
    INTO revenue_gross
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL  -- Only include sales with financial data
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- Calculate net revenue (without 18% VAT)
  revenue_net := revenue_gross / 1.18;

  -- Calculate COGS (already without VAT)
  SELECT COALESCE(SUM(COALESCE(ia.cost_snapshot_ils, 0) * ABS(ia.quantity_changed)), 0)
    INTO cogs_total
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL  -- Only include sales with financial data
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- Gross profit (mixed - revenue with VAT minus COGS without VAT)
  gross_profit := revenue_gross - cogs_total;

  -- CORRECT: Net profit = revenue_net - COGS (both without VAT)
  net_profit := ROUND(revenue_net - cogs_total, 2);

  -- Top selling product (by quantity sold, only financial sales)
  SELECT p.name
    INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to
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
      AND ia.timestamp BETWEEN date_from AND date_to
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
      AND ia.sale_total_ils IS NOT NULL  -- Only include financial sales
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
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