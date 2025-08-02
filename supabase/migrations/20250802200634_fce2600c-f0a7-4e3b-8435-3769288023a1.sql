
-- Create a secure view for suppliers automation access
CREATE VIEW suppliers_automation_view AS
SELECT 
  id,
  name,
  phone
FROM suppliers;

-- Grant SELECT permissions to anon and authenticated roles
GRANT SELECT ON suppliers_automation_view TO anon;
GRANT SELECT ON suppliers_automation_view TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW suppliers_automation_view IS 'Secure view for N8N automation - exposes only basic supplier info (id, name, phone)';
