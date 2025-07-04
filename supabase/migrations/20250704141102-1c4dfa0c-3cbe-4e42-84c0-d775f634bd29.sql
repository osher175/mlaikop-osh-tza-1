
-- בדיקת אינדקסים קיימים ויצירת אינדקסים חדשים לאופטימיזציה

-- אינדקסים לטבלת products (הטבלה הכבדה ביותר)
CREATE INDEX IF NOT EXISTS idx_products_business_id ON products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_quantity ON products(quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_expiration_date ON products(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin(name gin_trgm_ops);

-- אינדקסים לטבלת inventory_actions (לדוחות)
CREATE INDEX IF NOT EXISTS idx_inventory_actions_business_timestamp ON inventory_actions(business_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_actions_product_timestamp ON inventory_actions(product_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_actions_action_type ON inventory_actions(action_type, business_id, timestamp DESC);

-- אינדקסים לטבלת recent_activity
CREATE INDEX IF NOT EXISTS idx_recent_activity_business_timestamp ON recent_activity(business_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_recent_activity_user_timestamp ON recent_activity(user_id, timestamp DESC);

-- אינדקסים לטבלת notifications
CREATE INDEX IF NOT EXISTS idx_notifications_business_unread ON notifications(business_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- אינדקסים לחיפושים מהירים
CREATE INDEX IF NOT EXISTS idx_business_users_business_status ON business_users(business_id, status);
CREATE INDEX IF NOT EXISTS idx_products_composite_search ON products(business_id, name, quantity);

-- אינדקס מורכב לשאילתות דוחות מורכבות
CREATE INDEX IF NOT EXISTS idx_inventory_reports_composite ON inventory_actions(business_id, action_type, timestamp DESC, product_id);

-- הוספת הרחבת pg_trgm לחיפוש מהיר יותר
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- אופטימיזציה של פונקציית reports_aggregate
CREATE OR REPLACE FUNCTION public.reports_aggregate_optimized(
  business_id uuid, 
  date_from timestamptz, 
  date_to timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
  total_added integer := 0;
  total_removed integer := 0;
  total_value numeric := 0;
  gross_profit numeric := 0;
  net_profit numeric := 0;
  top_product text;
  suppliers_breakdown jsonb := '[]'::jsonb;
  timeline_breakdown jsonb := '[]'::jsonb;
BEGIN
  -- שאילתה מאוחדת לכל הנתונים הבסיסיים
  WITH aggregated_data AS (
    SELECT 
      ia.action_type,
      SUM(CASE WHEN ia.action_type = 'add' THEN ia.quantity_changed ELSE 0 END) as added_qty,
      SUM(CASE WHEN ia.action_type = 'remove' THEN ABS(ia.quantity_changed) ELSE 0 END) as removed_qty,
      SUM(CASE WHEN ia.action_type = 'add' THEN ia.quantity_changed * COALESCE(p.cost, 0) ELSE 0 END) as total_cost_value,
      SUM(CASE WHEN ia.action_type = 'remove' THEN ABS(ia.quantity_changed) * (COALESCE(p.price, 0) - COALESCE(p.cost, 0)) ELSE 0 END) as profit_value
    FROM inventory_actions ia
    JOIN products p ON ia.product_id = p.id
    WHERE ia.business_id = reports_aggregate_optimized.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY ia.action_type
  )
  SELECT 
    COALESCE(SUM(added_qty), 0),
    COALESCE(SUM(removed_qty), 0),
    COALESCE(SUM(total_cost_value), 0),
    COALESCE(SUM(profit_value), 0)
  INTO total_added, total_removed, total_value, gross_profit
  FROM aggregated_data;

  -- חישוב רווח נטו
  net_profit := ROUND(gross_profit * 0.83, 2);

  -- המוצר הנמכר ביותר (שאילתה נפרדת ומהירה)
  SELECT p.name INTO top_product
  FROM inventory_actions ia
  JOIN products p ON ia.product_id = p.id
  WHERE ia.action_type = 'remove'
    AND ia.business_id = reports_aggregate_optimized.business_id
    AND ia.timestamp BETWEEN date_from AND date_to
  GROUP BY p.name
  ORDER BY SUM(ABS(ia.quantity_changed)) DESC
  LIMIT 1;

  -- פילוח ספקים (רק אם יש נתונים)
  IF total_added > 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
      'supplier_id', COALESCE(p.supplier_id::text, 'unknown'),
      'total_purchased', SUM(ia.quantity_changed)
    ))
    INTO suppliers_breakdown
    FROM inventory_actions ia
    JOIN products p ON ia.product_id = p.id
    WHERE ia.action_type = 'add'
      AND ia.business_id = reports_aggregate_optimized.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY p.supplier_id;
  END IF;

  -- פילוח זמן (מקובץ לפי יום)
  SELECT jsonb_agg(jsonb_build_object(
    'date', day_date,
    'sales', COALESCE(daily_sales, 0)
  ))
  INTO timeline_breakdown
  FROM (
    SELECT 
      ia.timestamp::date as day_date,
      SUM(ABS(ia.quantity_changed)) as daily_sales
    FROM inventory_actions ia
    WHERE ia.action_type = 'remove'
      AND ia.business_id = reports_aggregate_optimized.business_id
      AND ia.timestamp BETWEEN date_from AND date_to
    GROUP BY ia.timestamp::date
    ORDER BY ia.timestamp::date
  ) daily_data;

  -- בניית התוצאה
  result := jsonb_build_object(
    'total_added', total_added,
    'total_removed', total_removed,
    'total_value', total_value,
    'gross_profit', gross_profit,
    'net_profit', net_profit,
    'top_product', top_product,
    'suppliers_breakdown', COALESCE(suppliers_breakdown, '[]'::jsonb),
    'timeline_breakdown', COALESCE(timeline_breakdown, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- יצירת view לנתונים נפוצים (מטמון)
CREATE OR REPLACE VIEW products_with_status AS
SELECT 
  p.*,
  pc.name as category_name,
  s.name as supplier_name,
  pt.low_stock_threshold,
  CASE 
    WHEN p.quantity = 0 THEN 'out_of_stock'
    WHEN p.quantity <= COALESCE(pt.low_stock_threshold, 5) THEN 'low_stock'
    ELSE 'in_stock'
  END as stock_status
FROM products p
LEFT JOIN product_categories pc ON p.product_category_id = pc.id
LEFT JOIN suppliers s ON p.supplier_id = s.id
LEFT JOIN product_thresholds pt ON p.id = pt.product_id;

-- פונקציה מהירה לחיפוש מוצרים
CREATE OR REPLACE FUNCTION search_products_fast(
  search_term text DEFAULT '',
  business_uuid uuid DEFAULT NULL,
  limit_count integer DEFAULT 10
)
RETURNS TABLE(
  id uuid, name text, barcode text, quantity integer, 
  location text, expiration_date date, price numeric, 
  cost numeric, category_name text, supplier_name text,
  stock_status text, search_rank real
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF search_term = '' OR search_term IS NULL THEN
    RETURN QUERY
    SELECT 
      p.id, p.name, p.barcode, p.quantity, p.location,
      p.expiration_date, p.price, p.cost, p.category_name,
      p.supplier_name, p.stock_status, 1.0::real as search_rank
    FROM products_with_status p
    WHERE (business_uuid IS NULL OR p.business_id = business_uuid)
    ORDER BY p.created_at DESC
    LIMIT limit_count;
  ELSE
    RETURN QUERY
    SELECT 
      p.id, p.name, p.barcode, p.quantity, p.location,
      p.expiration_date, p.price, p.cost, p.category_name,
      p.supplier_name, p.stock_status,
      (
        CASE WHEN p.name ILIKE search_term || '%' THEN 4
             WHEN p.name ILIKE '%' || search_term || '%' THEN 2
             ELSE 0 END +
        CASE WHEN p.barcode ILIKE search_term || '%' THEN 3
             WHEN p.barcode ILIKE '%' || search_term || '%' THEN 1
             ELSE 0 END +
        similarity(p.name, search_term) * 2
      )::real as search_rank
    FROM products_with_status p
    WHERE (business_uuid IS NULL OR p.business_id = business_uuid)
      AND (
        p.name ILIKE '%' || search_term || '%' OR
        p.barcode ILIKE '%' || search_term || '%' OR
        similarity(p.name, search_term) > 0.1
      )
    ORDER BY search_rank DESC, p.name
    LIMIT limit_count;
  END IF;
END;
$$;
