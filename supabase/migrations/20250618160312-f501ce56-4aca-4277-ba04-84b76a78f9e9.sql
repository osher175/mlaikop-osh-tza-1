
-- Manual insert of existing emails into emails table
-- First, insert email for אושרי צפרירי
INSERT INTO public.emails (email, user_id, created_at)
SELECT 
  'oshritzafriri@gmail.com',
  p.id,
  now()
FROM public.profiles p
WHERE p.first_name = 'אושרי' AND p.last_name = 'צפרירי'
LIMIT 1;

-- Second, insert email for לידור צפרירי
INSERT INTO public.emails (email, user_id, created_at)
SELECT 
  'lidortzafriri@gmail.com',
  p.id,
  now()
FROM public.profiles p
WHERE p.first_name = 'לידור' AND p.last_name = 'צפרירי'
LIMIT 1;

-- Optional: Check if the inserts were successful
-- You can run this query to verify the data was inserted correctly
-- SELECT e.email, e.user_id, p.first_name, p.last_name, e.created_at
-- FROM public.emails e
-- LEFT JOIN public.profiles p ON e.user_id = p.id
-- WHERE e.email IN ('oshritzafriri@gmail.com', 'lidortzafriri@gmail.com');
