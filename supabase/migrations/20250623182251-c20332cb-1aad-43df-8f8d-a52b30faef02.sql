
-- Ensure oshritzafriri@gmail.com is properly set as admin
UPDATE public.user_roles 
SET role = 'admin'::user_role, updated_at = now()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'oshritzafriri@gmail.com'
);

-- If the user doesn't have a role entry, insert one
INSERT INTO public.user_roles (user_id, role, updated_at)
SELECT id, 'admin'::user_role, now()
FROM auth.users 
WHERE email = 'oshritzafriri@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.users.id
);

-- Verify the admin role is set correctly
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'oshritzafriri@gmail.com';
