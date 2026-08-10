-- Private import documents bucket: tenant-scoped access.
-- Path convention: <business_id>/<import_order_id>/<document_id>/<filename>

CREATE POLICY "import_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'import-documents'
    AND public.can_manage_business_imports(NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "import_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'import-documents'
    AND public.can_manage_business_imports(NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "import_docs_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'import-documents'
    AND public.can_manage_business_imports(NULLIF(split_part(name, '/', 1), '')::uuid)
  )
  WITH CHECK (
    bucket_id = 'import-documents'
    AND public.can_manage_business_imports(NULLIF(split_part(name, '/', 1), '')::uuid)
  );

CREATE POLICY "import_docs_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'import-documents'
    AND public.can_manage_business_imports(NULLIF(split_part(name, '/', 1), '')::uuid)
  );