-- Fix reports_aggregate function to:
-- 1. Fix suppliers_breakdown nested aggregate error
-- 2. Add top_products_list for ranking top 20 products
-- 3. Add purchases_breakdown for monthly purchases chart

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
  -- Total items added to inventory in the period
  SELECT COALESCE(SUM(ia.quantity_changed), 0)
    INTO total_added
  FROM public.inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Total items removed from inventory (sales - support both 'remove' and 'sale')
  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0)
    INTO total_removed
  FROM public.inventory_actions ia
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Total inventory value (cost-based)
  SELECT COALESCE(SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0)), 0)
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
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
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
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.sale_total_ils IS NOT NULL
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second';

  -- Gross profit (mixed - revenue with VAT minus COGS without VAT)
  gross_profit := revenue_gross - cogs_total;

  -- Net profit = revenue_net - COGS (both without VAT)
  net_profit := ROUND(revenue_net - cogs_total, 2);

  -- Top selling product (by quantity sold, support both action types)
  SELECT p.name
    INTO top_product
  FROM public.inventory_actions ia
  JOIN public.products p ON p.id = ia.product_id
  WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp >= date_from 
    AND ia.timestamp < date_to + interval '1 second'
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  -- FIXED: Suppliers breakdown using subquery to avoid nested aggregate error
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO suppliers_breakdown
  FROM (
    SELECT 
      s.id as supplier_id,
      COALESCE(s.name, 'ללא ספק') as supplier_name,
      SUM(ia.quantity_changed) as total_purchased
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    LEFT JOIN public.suppliers s ON s.id = p.supplier_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
    GROUP BY s.id, s.name
    ORDER BY SUM(ia.quantity_changed) DESC
  ) t;

  -- Timeline breakdown (daily sales with both units and amount)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO timeline_breakdown
  FROM (
    SELECT
      to_char(ia.timestamp, 'YYYY-MM-DD') as date,
      SUM(ABS(ia.quantity_changed)) as sales,
      COALESCE(SUM(ia.sale_total_ils), 0) as sales_amount
    FROM public.inventory_actions ia
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  -- NEW: Top 20 products list for ranking
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO top_products_list
  FROM (
    SELECT 
      p.id as product_id,
      p.name as product_name,
      SUM(ABS(ia.quantity_changed)) as quantity_sold,
      COALESCE(SUM(ia.sale_total_ils), 0) as revenue
    FROM public.inventory_actions ia
    JOIN public.products p ON p.id = ia.product_id
    WHERE (ia.action_type = 'remove' OR ia.action_type = 'sale')
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
    GROUP BY p.id, p.name
    ORDER BY SUM(ABS(ia.quantity_changed)) DESC
    LIMIT 20
  ) t;

  -- NEW: Purchases breakdown by month (for monthly purchases chart)
  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO purchases_breakdown
  FROM (
    SELECT
      to_char(ia.timestamp, 'YYYY-MM') as month,
      SUM(ia.quantity_changed) as quantity,
      COALESCE(SUM(ia.purchase_total_ils), SUM(ia.quantity_changed * COALESCE(ia.purchase_unit_ils, p.cost, 0))) as amount
    FROM public.inventory_actions ia
    LEFT JOIN public.products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp >= date_from 
      AND ia.timestamp < date_to + interval '1 second'
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