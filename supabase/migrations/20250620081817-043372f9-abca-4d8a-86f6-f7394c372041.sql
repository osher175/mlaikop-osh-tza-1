
-- שלב 1: הוספת OWNER כתפקיד חדש באנום
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'OWNER';
