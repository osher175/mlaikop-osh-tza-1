
-- ============================================
-- STEP 1: Financial Data Hardening (businesses)
-- ============================================
-- This migration creates a safe view that hides financial data
-- The original table structure remains UNCHANGED

-- Create a safe view that hides sensitive financial columns
-- Only owner/admin see full data, members see filtered view
CREATE OR REPLACE VIEW public.businesses_safe
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  owner_id,
  business_type,
  industry,
  phone,
  address,
  official_email,
  employee_count,
  plan_id,
  business_category_id,
  created_at,
  updated_at
  -- avg_monthly_revenue is EXCLUDED for regular members
FROM public.businesses;

-- Grant access to the view
GRANT SELECT ON public.businesses_safe TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.businesses_safe IS 
  'Safe view of businesses table - excludes sensitive financial data (avg_monthly_revenue). Use this for non-owner/non-admin access.';

-- Create a function to check if user can see financial data
CREATE OR REPLACE FUNCTION public.can_view_business_financials(business_uuid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- User is the business owner
    SELECT 1 FROM public.businesses 
    WHERE id = business_uuid AND owner_id = auth.uid()
  ) OR (
    -- User is an admin
    SELECT public.has_role_or_higher('admin'::user_role)
  );
$$;

COMMENT ON FUNCTION public.can_view_business_financials IS 
  'Returns true if current user can view financial data for a specific business (owner or admin only)';
