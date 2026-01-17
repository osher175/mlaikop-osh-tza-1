-- ===============================================
-- שלב 2: מחיקת Views עם SECURITY DEFINER
-- ===============================================

-- מחיקת ה-Views הבעייתיים
DROP VIEW IF EXISTS public.products_automation_view;
DROP VIEW IF EXISTS public.suppliers_automation_view;
DROP VIEW IF EXISTS public.stale_products;