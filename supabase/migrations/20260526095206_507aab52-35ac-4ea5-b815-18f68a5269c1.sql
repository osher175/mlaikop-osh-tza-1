ALTER TABLE public.payment_sessions DROP CONSTRAINT IF EXISTS payment_sessions_status_check;
ALTER TABLE public.payment_sessions ADD CONSTRAINT payment_sessions_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text,'completed'::text,'failed'::text,'expired'::text,'cancelled'::text,
    'pending_payment'::text,'payment_link_created'::text,'paid'::text
  ]));

INSERT INTO public.payment_sessions (id, business_id, user_id, plan_id, payment_provider, status, metadata)
VALUES (
  '11111111-2222-3333-4444-555555555555',
  '17fe2795-9b5a-4cf3-806b-6801dae7b600',
  'db40d81c-8576-431a-9e43-8c2554346838',
  '2deb68cc-ab61-4e31-9447-a1a82d277fe1',
  'grow',
  'pending_payment',
  jsonb_build_object(
    'billing_cycle','monthly','currency','ILS','is_test', true,
    'payload', jsonb_build_object(
      'sum', 500, 'description','מנוי חודשי — Regular',
      'paymentType','Payments','maxOrCustom','Max Payments','paymentsMaxNumber',1,
      'currency','ILS','billing_cycle','monthly',
      'customer', jsonb_build_object('business_id','17fe2795-9b5a-4cf3-806b-6801dae7b600','business_name','Test Business','name','E2E Test Customer','email','e2e-test@mlaiko.local','phone','+972500000000'),
      'products', jsonb_build_array(jsonb_build_object('catalogNumber','2deb68cc-ab61-4e31-9447-a1a82d277fe1','productName','Regular','price',500,'quantity',1))
    )
  )
)
ON CONFLICT (id) DO UPDATE SET status='pending_payment', checkout_url=NULL, provider_session_id=NULL, completed_at=NULL, metadata=EXCLUDED.metadata;

INSERT INTO public.billing_events (business_id, user_id, event_type, new_status, source, metadata)
VALUES (
  '17fe2795-9b5a-4cf3-806b-6801dae7b600',
  'db40d81c-8576-431a-9e43-8c2554346838',
  'grow_session_created','pending_payment','e2e-test',
  jsonb_build_object('session_id','11111111-2222-3333-4444-555555555555','plan_id','2deb68cc-ab61-4e31-9447-a1a82d277fe1','is_test',true)
);