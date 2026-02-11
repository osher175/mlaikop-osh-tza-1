
-- ============================================
-- Part A: Add low_stock_enabled_at column + trigger
-- ============================================

ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS low_stock_enabled_at timestamptz;

-- Trigger function: auto-set low_stock_enabled_at on first enable
CREATE OR REPLACE FUNCTION public.set_low_stock_enabled_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.low_stock_enabled = true
     AND (OLD.low_stock_enabled IS DISTINCT FROM true)
     AND NEW.low_stock_enabled_at IS NULL
  THEN
    NEW.low_stock_enabled_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_low_stock_enabled_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_low_stock_enabled_at();

-- ============================================
-- Part B: Automation outbox table
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS automation_outbox_unprocessed_idx
  ON public.automation_outbox (processed_at, created_at);

ALTER TABLE public.automation_outbox ENABLE ROW LEVEL SECURITY;

-- SELECT: business owners + approved members
CREATE POLICY "Business members can read outbox events"
  ON public.automation_outbox FOR SELECT
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
    OR business_id IN (
      SELECT bu.business_id FROM public.business_users bu
      WHERE bu.user_id = auth.uid() AND bu.status = 'approved'
    )
  );

-- INSERT: trigger-based (SECURITY DEFINER context)
CREATE POLICY "System can insert outbox events"
  ON public.automation_outbox FOR INSERT
  WITH CHECK (true);

-- UPDATE: owners can mark processed
CREATE POLICY "Business owners can update outbox events"
  ON public.automation_outbox FOR UPDATE
  USING (
    business_id IN (
      SELECT id FROM public.businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- Part C: Crossing-only trigger on products
-- ============================================

CREATE OR REPLACE FUNCTION public.enqueue_low_stock_crossing()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enabled boolean;
  v_enabled_at timestamptz;
  v_global_threshold integer;
  v_product_threshold integer;
  v_threshold integer;
BEGIN
  -- 1. No quantity change -> skip
  IF NEW.quantity = OLD.quantity THEN
    RETURN NEW;
  END IF;

  -- 2. Look up notification_settings
  SELECT low_stock_enabled, low_stock_enabled_at, low_stock_threshold
    INTO v_enabled, v_enabled_at, v_global_threshold
    FROM public.notification_settings
   WHERE business_id = NEW.business_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- 3. Check enabled + cutover timestamp exists
  IF v_enabled IS NOT TRUE OR v_enabled_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- 4. Check cutover: now must be >= enabled_at
  IF now() < v_enabled_at THEN
    RETURN NEW;
  END IF;

  -- 5. Resolve threshold (per-product override > global > default 5)
  SELECT pt.low_stock_threshold
    INTO v_product_threshold
    FROM public.product_thresholds pt
   WHERE pt.product_id = NEW.id;

  v_threshold := COALESCE(v_product_threshold, v_global_threshold, 5);

  -- 6. Check crossing-down: was above, now at or below
  IF NOT (OLD.quantity > v_threshold AND NEW.quantity <= v_threshold) THEN
    RETURN NEW;
  END IF;

  -- 7. Enqueue event
  INSERT INTO public.automation_outbox (event_type, business_id, product_id, payload)
  VALUES (
    'low_stock_crossed',
    NEW.business_id,
    NEW.id,
    jsonb_build_object(
      'event_type', 'low_stock_crossed',
      'business_id', NEW.business_id,
      'product_id', NEW.id,
      'old_quantity', OLD.quantity,
      'new_quantity', NEW.quantity,
      'threshold', v_threshold,
      'occurred_at', now()
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enqueue_low_stock_crossing
  AFTER UPDATE OF quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_low_stock_crossing();
