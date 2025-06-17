
-- Add admin role for the user oshritzafriri@gmail.com
INSERT INTO public.user_roles (user_id, role) 
SELECT id, 'admin'::user_role 
FROM auth.users 
WHERE email = 'oshritzafriri@gmail.com'
ON CONFLICT (user_id) 
DO UPDATE SET role = 'admin', updated_at = now();
