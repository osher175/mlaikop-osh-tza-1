
DROP POLICY IF EXISTS "Users can view activities for their business" ON public.recent_activity;
DROP POLICY IF EXISTS "Users can view recent activity for their business" ON public.recent_activity;
DROP POLICY IF EXISTS "Users can create inventory actions" ON public.inventory_actions;
DROP POLICY IF EXISTS "Users can view inventory actions in their business" ON public.inventory_actions;
DROP POLICY IF EXISTS "Users can manage products in their business" ON public.products;
DROP POLICY IF EXISTS "Users can view products in their business" ON public.products;
DROP POLICY IF EXISTS "Users can search products in their business" ON public.products;
