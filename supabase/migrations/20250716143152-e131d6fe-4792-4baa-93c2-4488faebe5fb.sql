
-- שלב 1: מחיקת טבלה ישנה ולא בשימוש
DROP TABLE IF EXISTS public.subscription_plans_new CASCADE;
DROP TABLE IF EXISTS public.user_subscriptions_new CASCADE;

-- שלב 2: עדכון טבלת subscription_plans עם המסלולים החדשים
-- מחיקת מסלולים קיימים
DELETE FROM public.subscription_plans;

-- הוספת שני המסלולים החדשים
INSERT INTO public.subscription_plans (id, name, monthly_price, duration_months, features, ai_access, storage_gb, max_users, setup_fee, role)
VALUES
  (
    gen_random_uuid(),
    'Basic',
    299,
    1,
    '["inventory_management", "reports", "charts"]'::jsonb,
    false,
    10,
    3,
    0,
    'pro_starter_user'
  ),
  (
    gen_random_uuid(),
    'Pro',
    599,
    1,
    '["inventory_management", "reports", "charts", "ai_automations", "accountant_export"]'::jsonb,
    true,
    50,
    -1,
    0,
    'smart_master_user'
  );

-- שלב 3: עדכון טבלת user_subscriptions עם השדות הנדרשים
ALTER TABLE public.user_subscriptions
ADD COLUMN IF NOT EXISTS status text DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS trial_started_at timestamptz,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_started_at timestamptz,
ADD COLUMN IF NOT EXISTS next_billing_date timestamptz,
ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
ADD COLUMN IF NOT EXISTS payment_link_id text,
ADD COLUMN IF NOT EXISTS receipt_url text;

-- עדכון RLS policies עבור user_subscriptions
DROP POLICY IF EXISTS "Users can view their own subscription" ON public.user_subscriptions;
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.user_subscriptions;

-- RLS policies חדשות
CREATE POLICY "Users can view their own subscription" 
ON public.user_subscriptions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscription" 
ON public.user_subscriptions 
FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription" 
ON public.user_subscriptions 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all subscriptions" 
ON public.user_subscriptions 
FOR ALL 
USING (get_user_role() = 'admin');

-- שלב 7: הוספת RLS policies לטבלאות קריטיות
-- Policy עבור products
CREATE POLICY "Only active or valid trial users can access products"
ON public.products
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_subscriptions.user_id = auth.uid()
      AND (
        user_subscriptions.status = 'active'
        OR (user_subscriptions.status = 'trial' AND user_subscriptions.trial_ends_at > now())
      )
  )
);

-- Policy עבור inventory_actions
CREATE POLICY "Only active or valid trial users can access inventory"
ON public.inventory_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_subscriptions.user_id = auth.uid()
      AND (
        user_subscriptions.status = 'active'
        OR (user_subscriptions.status = 'trial' AND user_subscriptions.trial_ends_at > now())
      )
  )
);

-- Policy עבור recent_activity
CREATE POLICY "Only active or valid trial users can access activity"
ON public.recent_activity
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_subscriptions
    WHERE user_subscriptions.user_id = auth.uid()
      AND (
        user_subscriptions.status = 'active'
        OR (user_subscriptions.status = 'trial' AND user_subscriptions.trial_ends_at > now())
      )
  )
);
