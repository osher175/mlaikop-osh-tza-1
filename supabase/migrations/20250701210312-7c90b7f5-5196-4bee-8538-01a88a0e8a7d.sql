
CREATE OR REPLACE FUNCTION public.reports_aggregate(
  business_id uuid,
  date_from timestamptz,
  date_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  total_added integer;
  total_removed integer;
  total_value numeric;
  gross_profit numeric;
  net_profit numeric;
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- סך הכל הוספות
  SELECT COALESCE(SUM(ia.quantity_changed), 0)
    INTO total_added
  FROM inventory_actions ia
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- סך הכל הוצאות
  SELECT COALESCE(SUM(ABS(ia.quantity_changed)), 0)
    INTO total_removed
  FROM inventory_actions ia
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- ערך סחורה שנכנסה (cost)
  SELECT COALESCE(SUM(ia.quantity_changed * p.cost), 0)
    INTO total_value
  FROM inventory_actions ia
  JOIN products p ON p.id = ia.product_id
  WHERE ia.action_type = 'add'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- רווח גולמי (price - cost)
  SELECT COALESCE(SUM((p.price - p.cost) * ABS(ia.quantity_changed)), 0)
    INTO gross_profit
  FROM inventory_actions ia
  JOIN products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to;

  -- רווח נקי (נניח 17% הוצאות)
  net_profit := ROUND(gross_profit * 0.83, 2);

  -- המוצר הכי נמכר
  SELECT p.name
    INTO top_product
  FROM inventory_actions ia
  JOIN products p ON p.id = ia.product_id
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate.business_id
    AND ia.timestamp BETWEEN date_from AND date_to
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  -- פילוח לפי ספקים (אם יש supplier_id)
  BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'supplier_id', p.supplier_id,
        'total_purchased', SUM(ia.quantity_changed)
      ))
      INTO suppliers_breakdown
    FROM inventory_actions ia
    JOIN products p ON p.id = ia.product_id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY p.supplier_id;
  EXCEPTION WHEN OTHERS THEN
    suppliers_breakdown := '[]'::jsonb;
  END;

  -- פילוח לפי ימים (מתוקן - ללא nesting)
  SELECT jsonb_agg(row_to_json(t))
    INTO timeline_breakdown
  FROM (
    SELECT
      to_char(ia.timestamp, 'YYYY-MM-DD') as date,
      SUM(ABS(ia.quantity_changed)) as sales
    FROM inventory_actions ia
    WHERE ia.action_type = 'remove'
      AND ia.business_id = reports_aggregate.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY to_char(ia.timestamp, 'YYYY-MM-DD')
    ORDER BY to_char(ia.timestamp, 'YYYY-MM-DD')
  ) t;

  RETURN jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', gross_profit,
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', suppliers_breakdown,
    'timeline_breakdown', timeline_breakdown
  );
END;
$$;
