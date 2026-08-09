
CREATE OR REPLACE FUNCTION public.bi_analytics_yearly(
  p_business_id uuid,
  p_year integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tz            text := 'Asia/Jerusalem';
  v_vat           numeric := 1.18;
  v_start         timestamptz;
  v_end           timestamptz;
  v_sales_data    jsonb;
  v_top_products  jsonb;
  v_supplier_data jsonb;
  v_monthly_pur   jsonb;
  v_metrics       jsonb;
  v_has_sale      boolean;
  v_has_purchase  boolean;
BEGIN
  -- === Phase A2.S1 authorization guard (tenant isolation) ===
  IF NOT public.can_access_business_analytics(p_business_id, auth.uid()) THEN
    RAISE EXCEPTION 'access denied for this business' USING ERRCODE = '42501';
  END IF;
  -- === end guard ===

  IF p_year IS NULL OR p_year < 2000 OR p_year > 2200 THEN
    RAISE EXCEPTION 'invalid year' USING ERRCODE = '22023';
  END IF;

  v_start := (make_timestamp(p_year, 1, 1, 0, 0, 0) AT TIME ZONE v_tz);
  v_end   := ((make_timestamp(p_year, 12, 31, 23, 59, 59) + interval '0.999 second') AT TIME ZONE v_tz);

  CREATE TEMP TABLE IF NOT EXISTS _bi_noop (x int);

  RETURN NULL;
END;
$function$;
