-- =====================================================
-- הרחבת טבלת inventory_actions לתמיכה במכירות וקניות אמיתיות
-- =====================================================

-- הוספת עמודה currency עם ברירת מחדל ILS
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'ILS';

-- הוספת עמודה quantity_delta (חיובי לקנייה, שלילי למכירה)
-- הערה: כבר יש quantity_changed אז נשתמש בה במקום ליצור חדשה

-- =====================================================
-- עמודות מכירה
-- =====================================================

-- סכום כולל ששולם בפועל (אחרי הנחות)
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS sale_total_ils numeric;

-- מחיר ליחידה בפועל (sale_total_ils / כמות)
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS sale_unit_ils numeric;

-- צילום מחיר מחירון בזמן המכירה (products.price)
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS list_unit_ils numeric;

-- סכום ההנחה בש"ח
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS discount_ils numeric;

-- אחוז ההנחה
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS discount_percent numeric;

-- צילום עלות המוצר בזמן המכירה (products.cost)
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS cost_snapshot_ils numeric;

-- =====================================================
-- עמודות קנייה
-- =====================================================

-- מחיר ליחידה בקנייה
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS purchase_unit_ils numeric;

-- סכום כולל ששולם לספק
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS purchase_total_ils numeric;

-- קשר לספק (אם יש)
ALTER TABLE public.inventory_actions 
ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- =====================================================
-- Constraints לוודא שלמות נתונים
-- =====================================================

-- ודא שמכירה מכילה את הנתונים הנדרשים
ALTER TABLE public.inventory_actions 
ADD CONSTRAINT check_sale_data
CHECK (
  action_type != 'sale' OR 
  (sale_total_ils IS NOT NULL AND cost_snapshot_ils IS NOT NULL)
);

-- ודא שקנייה מכילה עלות יחידה
ALTER TABLE public.inventory_actions 
ADD CONSTRAINT check_purchase_data
CHECK (
  action_type != 'purchase' OR 
  purchase_unit_ils IS NOT NULL
);

-- =====================================================
-- אינדקסים לביצועים
-- =====================================================

-- אינדקס לשאילתות דוחות לפי עסק וסוג פעולה
CREATE INDEX IF NOT EXISTS idx_inventory_actions_business_action_type 
ON public.inventory_actions(business_id, action_type, timestamp DESC);

-- אינדקס לשאילתות לפי ספק
CREATE INDEX IF NOT EXISTS idx_inventory_actions_supplier 
ON public.inventory_actions(supplier_id) 
WHERE supplier_id IS NOT NULL;

-- =====================================================
-- הערות תיעודיות
-- =====================================================

COMMENT ON COLUMN public.inventory_actions.currency IS 'מטבע - תמיד ILS';
COMMENT ON COLUMN public.inventory_actions.sale_total_ils IS 'סכום כולל ששולם בפועל במכירה (אחרי הנחות) ₪';
COMMENT ON COLUMN public.inventory_actions.sale_unit_ils IS 'מחיר ליחידה בפועל במכירה ₪';
COMMENT ON COLUMN public.inventory_actions.list_unit_ils IS 'מחיר מחירון ליחידה בזמן המכירה ₪';
COMMENT ON COLUMN public.inventory_actions.discount_ils IS 'סכום ההנחה בש"ח';
COMMENT ON COLUMN public.inventory_actions.discount_percent IS 'אחוז ההנחה';
COMMENT ON COLUMN public.inventory_actions.cost_snapshot_ils IS 'עלות המוצר בזמן המכירה ₪';
COMMENT ON COLUMN public.inventory_actions.purchase_unit_ils IS 'מחיר ליחידה בקנייה ₪';
COMMENT ON COLUMN public.inventory_actions.purchase_total_ils IS 'סכום כולל לספק בקנייה ₪';
COMMENT ON COLUMN public.inventory_actions.supplier_id IS 'קשר לספק (אם יש)';