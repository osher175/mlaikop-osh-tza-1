
-- Update the user role for lidortzafriri@gmail.com to OWNER
UPDATE public.user_roles 
SET role = 'OWNER', updated_at = now()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'lidortzafriri@gmail.com'
);

-- If the user doesn't have a role entry, insert one
INSERT INTO public.user_roles (user_id, role, updated_at)
SELECT id, 'OWNER'::user_role, now()
FROM auth.users 
WHERE email = 'lidortzafriri@gmail.com'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles WHERE user_id = auth.users.id
);

-- Verify the role update
SELECT u.email, ur.role 
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE u.email = 'lidortzafriri@gmail.com';
