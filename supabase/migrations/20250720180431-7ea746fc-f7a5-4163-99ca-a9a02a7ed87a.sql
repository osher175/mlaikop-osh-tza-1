
-- Ensure oshritzafriri@gmail.com is properly set as admin
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Get the user ID for oshritzafriri@gmail.com
    SELECT id INTO user_uuid 
    FROM auth.users 
    WHERE email = 'oshritzafriri@gmail.com';
    
    -- If user exists, ensure admin role is set
    IF user_uuid IS NOT NULL THEN
        -- Insert or update the admin role
        INSERT INTO public.user_roles (user_id, role, updated_at) 
        VALUES (user_uuid, 'admin'::user_role, now())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
            role = 'admin'::user_role, 
            updated_at = now();
            
        -- Ensure profile exists and is active
        INSERT INTO public.profiles (id, is_active, updated_at)
        VALUES (user_uuid, true, now())
        ON CONFLICT (id)
        DO UPDATE SET 
            is_active = true,
            updated_at = now();
            
        RAISE NOTICE 'Admin role successfully assigned to oshritzafriri@gmail.com (ID: %)', user_uuid;
    ELSE
        RAISE NOTICE 'User oshritzafriri@gmail.com not found in auth.users table. User must sign up first.';
    END IF;
END $$;

-- Verify the admin setup
SELECT 
    u.email,
    ur.role,
    p.is_active,
    ur.updated_at as role_updated
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'oshritzafriri@gmail.com';
