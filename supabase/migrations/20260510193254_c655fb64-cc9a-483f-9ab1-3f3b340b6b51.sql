-- M4: Harden supplier-invoices storage bucket
-- 1. Make bucket private
UPDATE storage.buckets SET public = false WHERE id = 'supplier-invoices';

-- 2. Drop old over-permissive policies
DROP POLICY IF EXISTS "Users can view invoice files for their business" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload invoice files for their business" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete invoice files for their business" ON storage.objects;

-- 3. New per-business policies. Path is <business_id>/<filename>.
CREATE POLICY "Members can read own business invoices"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_businesses ub
      WHERE ub.business_id::text = (storage.foldername(name))[1]
        AND ub.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can upload own business invoices"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'supplier-invoices'
  AND (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_businesses ub
      WHERE ub.business_id::text = (storage.foldername(name))[1]
        AND ub.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Members can delete own business invoices"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'supplier-invoices'
  AND (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id::text = (storage.foldername(name))[1]
        AND b.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_businesses ub
      WHERE ub.business_id::text = (storage.foldername(name))[1]
        AND ub.user_id = auth.uid()
    )
  )
);