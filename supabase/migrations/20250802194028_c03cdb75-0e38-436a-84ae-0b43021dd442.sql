
-- Create a secure view for N8N automation access
-- This view exposes only the minimal required fields: id, name, supplier_id
CREATE VIEW public.products_automation_view AS
SELECT 
  id,
  name,
  supplier_id
FROM public.products;

-- Grant SELECT access to the anon role (used by N8N with anon key)
GRANT SELECT ON public.products_automation_view TO anon;

-- Grant SELECT access to authenticated users as well
GRANT SELECT ON public.products_automation_view TO authenticated;

-- Add a comment to document the purpose of this view
COMMENT ON VIEW public.products_automation_view IS 'Limited view for N8N automation - exposes only id, name, and supplier_id fields';
