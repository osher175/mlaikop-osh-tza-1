
-- Step 1: Drop the duplicate trigger
DROP TRIGGER IF EXISTS trigger_log_product_activity ON public.products;

-- Step 2: Clean up existing duplicate entries (cast uuid to text for MIN)
DELETE FROM public.recent_activity
WHERE id NOT IN (
  SELECT (MIN(id::text))::uuid
  FROM public.recent_activity
  GROUP BY business_id, action_type, title, timestamp, product_id, quantity_changed
);
