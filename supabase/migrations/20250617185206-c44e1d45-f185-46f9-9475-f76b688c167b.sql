
-- Create categories table
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_email TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create businesses table (for multi-business support)
CREATE TABLE public.businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES public.categories(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  quantity INTEGER NOT NULL DEFAULT 0,
  expiration_date DATE,
  location TEXT,
  cost DECIMAL(10,2),
  price DECIMAL(10,2),
  image TEXT,
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create inventory_actions table
CREATE TABLE public.inventory_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL CHECK (action_type IN ('add', 'remove', 'adjust', 'sale', 'return')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  quantity_changed INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  notes TEXT,
  business_id UUID REFERENCES public.businesses(id) NOT NULL
);

-- Create sales_cycles table
CREATE TABLE public.sales_cycles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  profit DECIMAL(12,2) DEFAULT 0,
  business_id UUID REFERENCES public.businesses(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CHECK (period_end >= period_start)
);

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL,
  access_scope TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add business_id to user_roles for multi-business support
ALTER TABLE public.user_roles ADD COLUMN business_id UUID REFERENCES public.businesses(id);

-- Enable RLS on all new tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for businesses
CREATE POLICY "Users can view businesses they belong to"
  ON public.businesses
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND business_id = businesses.id)
  );

CREATE POLICY "Business owners can manage their businesses"
  ON public.businesses
  FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- RLS Policies for categories
CREATE POLICY "Users can view categories in their business"
  ON public.categories
  FOR SELECT
  TO authenticated
  USING (true); -- Categories can be global or business-specific

CREATE POLICY "Users can manage categories"
  ON public.categories
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for suppliers
CREATE POLICY "Users can view suppliers"
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage suppliers"
  ON public.suppliers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for products
CREATE POLICY "Users can view products in their business"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = products.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = products.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage products in their business"
  ON public.products
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = products.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = products.business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = products.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = products.business_id AND owner_id = auth.uid()
    )
  );

-- RLS Policies for inventory_actions
CREATE POLICY "Users can view inventory actions in their business"
  ON public.inventory_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = inventory_actions.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = inventory_actions.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can create inventory actions"
  ON public.inventory_actions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = inventory_actions.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = inventory_actions.business_id AND owner_id = auth.uid()
    ))
  );

-- RLS Policies for sales_cycles
CREATE POLICY "Users can view sales cycles in their business"
  ON public.sales_cycles
  FOR SELECT
  TO authenticated
  USING (
    public.has_role_or_higher('pro_starter_user') AND
    (EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND business_id = sales_cycles.business_id
    ) OR 
    EXISTS (
      SELECT 1 FROM public.businesses 
      WHERE id = sales_cycles.business_id AND owner_id = auth.uid()
    ))
  );

-- RLS Policies for permissions (admin only)
CREATE POLICY "Only admins can view permissions"
  ON public.permissions
  FOR SELECT
  TO authenticated
  USING (public.get_user_role() = 'admin');

-- Insert default permission scopes
INSERT INTO public.permissions (role, access_scope, description) VALUES
('free_user', 'basic_inventory', 'Basic inventory management - up to 50 products'),
('free_user', 'view_products', 'View and search products'),
('pro_starter_user', 'unlimited_inventory', 'Unlimited inventory management'),
('pro_starter_user', 'basic_reports', 'Basic sales and inventory reports'),
('pro_starter_user', 'export_data', 'Export data to CSV/Excel'),
('smart_master_user', 'advanced_reports', 'Advanced analytics and reports'),
('smart_master_user', 'ai_recommendations', 'AI-powered purchase recommendations'),
('smart_master_user', 'trend_analysis', 'Sales trend analysis'),
('elite_pilot_user', 'full_ai_access', 'Complete AI features including predictions'),
('elite_pilot_user', 'multi_branch', 'Multi-branch inventory management'),
('elite_pilot_user', 'priority_support', '24/7 priority customer support'),
('admin', 'system_management', 'Full system administration access');

-- Insert default categories
INSERT INTO public.categories (name, description) VALUES
('מחשבים', 'מחשבים ניידים ושולחניים'),
('אביזרים', 'אביזרי מחשב וטכנולוgia'),
('רכיבים', 'רכיבי מחשב פנימיים'),
('תוכנה', 'תוכנות ורישיונות'),
('ציוד משרדי', 'ציוד משרדי וכלי עבודה'),
('כבלים', 'כבלים וחיבורים'),
('אחסון', 'התקני אחסון'),
('רשת', 'ציוד רשתות ותקשורת');

-- Create indexes for better performance
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_business_id ON public.products(business_id);
CREATE INDEX idx_products_category_id ON public.products(category_id);
CREATE INDEX idx_inventory_actions_product_id ON public.inventory_actions(product_id);
CREATE INDEX idx_inventory_actions_business_id ON public.inventory_actions(business_id);
CREATE INDEX idx_inventory_actions_timestamp ON public.inventory_actions(timestamp);
CREATE INDEX idx_sales_cycles_business_id ON public.sales_cycles(business_id);
CREATE INDEX idx_sales_cycles_period ON public.sales_cycles(period_start, period_end);
