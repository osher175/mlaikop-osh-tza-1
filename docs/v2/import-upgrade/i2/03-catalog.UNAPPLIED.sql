-- UNAPPLIED. Do not execute until a separate approval.
-- Additive catalog. No product merge, no name parsing, no price or image copy.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

CREATE TABLE public.product_tire_specs (
  product_id uuid PRIMARY KEY,
  business_id uuid NOT NULL,
  model_name text,
  width_mm integer,
  aspect_ratio integer,
  rim_inch numeric(4,1),
  load_index integer,
  speed_rating text,
  extra_marks text[],
  manufacturer_marking text,
  internal_sku text,
  manufacturer_sku text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_product_tire_specs_product_fkey
    FOREIGN KEY (business_id, product_id)
    REFERENCES public.products (business_id, id),
  CONSTRAINT i2_product_tire_specs_width_check
    CHECK (width_mm IS NULL OR width_mm > 0),
  CONSTRAINT i2_product_tire_specs_aspect_check
    CHECK (aspect_ratio IS NULL OR aspect_ratio > 0),
  CONSTRAINT i2_product_tire_specs_rim_check
    CHECK (rim_inch IS NULL OR rim_inch > 0),
  CONSTRAINT i2_product_tire_specs_load_check
    CHECK (load_index IS NULL OR load_index >= 0),
  CONSTRAINT i2_product_tire_specs_speed_check
    CHECK (speed_rating IS NULL OR speed_rating ~ '^[A-Z]{1,2}$'),
  CONSTRAINT i2_product_tire_specs_marks_check
    CHECK (extra_marks IS NULL OR extra_marks <@ ARRAY['xl', 'run_flat', 'foam', 'oem']::text[])
);

CREATE UNIQUE INDEX i2_product_tire_specs_internal_sku_key
  ON public.product_tire_specs (business_id, internal_sku)
  WHERE internal_sku IS NOT NULL;
CREATE UNIQUE INDEX i2_product_tire_specs_manufacturer_sku_key
  ON public.product_tire_specs (business_id, manufacturer_sku)
  WHERE manufacturer_sku IS NOT NULL;

COMMENT ON TABLE public.product_tire_specs IS
  'One optional structured identity per existing product. Empty until a user enters known values. Brand remains products.brand_id. Image remains products.image. Nothing is parsed from product names or size_label.';

CREATE TABLE public.product_price_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  channel text NOT NULL,
  amount_ils numeric(14,2) NOT NULL,
  effective_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_product_price_lists_product_fkey
    FOREIGN KEY (business_id, product_id)
    REFERENCES public.products (business_id, id),
  CONSTRAINT i2_product_price_lists_channel_check
    CHECK (channel IN ('retail', 'wholesale')),
  CONSTRAINT i2_product_price_lists_amount_check
    CHECK (amount_ils >= 0),
  UNIQUE (business_id, product_id, channel, effective_from)
);

COMMENT ON TABLE public.product_price_lists IS
  'Retail and wholesale list prices. Not purchase cost. Wholesale does not create a sale. No rows are copied from products.price.';

CREATE TABLE public.product_supplier_skus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  supplier_id uuid NOT NULL,
  supplier_sku text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_product_supplier_skus_product_fkey
    FOREIGN KEY (business_id, product_id)
    REFERENCES public.products (business_id, id),
  CONSTRAINT i2_product_supplier_skus_supplier_fkey
    FOREIGN KEY (business_id, supplier_id)
    REFERENCES public.suppliers (business_id, id),
  CONSTRAINT i2_product_supplier_skus_sku_check
    CHECK (length(btrim(supplier_sku)) > 0),
  UNIQUE (business_id, supplier_id, supplier_sku),
  UNIQUE (business_id, product_id, supplier_id)
);

COMMENT ON TABLE public.product_supplier_skus IS
  'Supplier SKU map. Not backfilled from import or purchase lines. The same supplier SKU cannot point at two products in one business.';

CREATE TABLE public.product_media_references (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  product_id uuid NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT i2_product_media_references_product_fkey
    FOREIGN KEY (business_id, product_id)
    REFERENCES public.products (business_id, id),
  CONSTRAINT i2_product_media_references_path_check
    CHECK (storage_path LIKE business_id::text || '/%')
);

COMMENT ON TABLE public.product_media_references IS
  'Additional image path for a product. The path must start with the business id. products.image is not copied and remains the existing reference.';

REVOKE ALL ON TABLE
  public.product_tire_specs,
  public.product_price_lists,
  public.product_supplier_skus,
  public.product_media_references
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE
  public.product_tire_specs,
  public.product_price_lists,
  public.product_supplier_skus,
  public.product_media_references
  TO authenticated;

ALTER TABLE public.product_tire_specs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_tire_specs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_price_lists FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_supplier_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_supplier_skus FORCE ROW LEVEL SECURITY;
ALTER TABLE public.product_media_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media_references FORCE ROW LEVEL SECURITY;

CREATE POLICY i2_product_tire_specs_select ON public.product_tire_specs
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_product_price_lists_select ON public.product_price_lists
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_product_supplier_skus_select ON public.product_supplier_skus
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));
CREATE POLICY i2_product_media_references_select ON public.product_media_references
  FOR SELECT TO authenticated
  USING (public.import_upgrade_is_member(business_id));

COMMIT;
