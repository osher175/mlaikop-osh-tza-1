
-- Create supplier_invoices table
CREATE TABLE public.supplier_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  invoice_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view invoices for their business
CREATE POLICY "Users can view invoices for their business" 
  ON public.supplier_invoices
  FOR SELECT 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    ) OR 
    business_id IN (
      SELECT business_id FROM public.business_users 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );

-- RLS Policy: Users can create invoices for their business
CREATE POLICY "Users can create invoices for their business" 
  ON public.supplier_invoices
  FOR INSERT 
  WITH CHECK (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    ) OR 
    business_id IN (
      SELECT business_id FROM public.business_users 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );

-- RLS Policy: Users can update invoices for their business
CREATE POLICY "Users can update invoices for their business" 
  ON public.supplier_invoices
  FOR UPDATE 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    ) OR 
    business_id IN (
      SELECT business_id FROM public.business_users 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );

-- RLS Policy: Users can delete invoices for their business
CREATE POLICY "Users can delete invoices for their business" 
  ON public.supplier_invoices
  FOR DELETE 
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    ) OR 
    business_id IN (
      SELECT business_id FROM public.business_users 
      WHERE user_id = auth.uid() AND status = 'approved'
    )
  );

-- Create storage bucket for supplier invoices if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('supplier-invoices', 'supplier-invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: Users can upload files for their business
CREATE POLICY "Users can upload invoice files for their business"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'supplier-invoices' AND
    auth.uid() IS NOT NULL
  );

-- Storage policy: Users can view files for their business
CREATE POLICY "Users can view invoice files for their business"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'supplier-invoices' AND
    auth.uid() IS NOT NULL
  );

-- Storage policy: Users can delete files for their business
CREATE POLICY "Users can delete invoice files for their business"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'supplier-invoices' AND
    auth.uid() IS NOT NULL
  );
