// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RequestSchema = z.object({
  business_id: z.string().uuid(),
  plan_id: z.string().min(1),
});

interface GrowProduct {
  catalogNumber: string;
  productName: string;
  price: number;
  quantity: number;
}

interface GrowPayload {
  paymentType: 'Payments';
  maxOrCustom: 'Max Payments';
  paymentsMaxNumber: number;
  products: GrowProduct[];
  customer: {
    businessId: string;
    businessName: string;
    name: string;
    email: string;
    phone: string;
  };
}

function buildPayload(input: {
  business: { id: string; name: string };
  user: { full_name: string; email: string; phone: string };
  plan: { id: string; name: string; monthly_price: number };
}): GrowPayload {
  if (!input.business.id || !input.business.name) throw new Error('MISSING_BUSINESS');
  if (!input.user.email) throw new Error('MISSING_EMAIL');
  if (!input.user.phone) throw new Error('MISSING_PHONE');
  if (!input.plan.id || !input.plan.name) throw new Error('MISSING_PLAN');
  if (!Number.isFinite(input.plan.monthly_price) || input.plan.monthly_price <= 0) {
    throw new Error('MISSING_PRICE');
  }
  return {
    paymentType: 'Payments',
    maxOrCustom: 'Max Payments',
    paymentsMaxNumber: 1,
    products: [
      {
        catalogNumber: input.plan.id,
        productName: `${input.plan.name} - מנוי חודשי`,
        price: Number(input.plan.monthly_price.toFixed(2)),
        quantity: 1,
      },
    ],
    customer: {
      businessId: input.business.id,
      businessName: input.business.name,
      name: input.user.full_name,
      email: input.user.email,
      phone: input.user.phone,
    },
  };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const MAKE_URL = Deno.env.get('MAKE_GROW_WEBHOOK_URL');
    const GROW_WEBHOOK_SECRET = Deno.env.get('GROW_WEBHOOK_SECRET') ?? '';

    if (!MAKE_URL) {
      console.error('MAKE_GROW_WEBHOOK_URL not configured');
      return json(500, { error: 'Server misconfigured: MAKE_GROW_WEBHOOK_URL missing' });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing Authorization' });

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json(401, { error: 'Unauthenticated' });
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(400, { error: 'Invalid input', issues: parsed.error.flatten() });
    }
    const { business_id, plan_id } = parsed.data;

    // Business + ownership
    const { data: business, error: bizErr } = await admin
      .from('businesses')
      .select('id, name, owner_id, official_email, business_email, phone')
      .eq('id', business_id)
      .maybeSingle();
    if (bizErr || !business) return json(404, { error: 'Business not found' });
    if (business.owner_id !== authUserId) return json(403, { error: 'Forbidden' });

    // Plan (server-side price)
    const { data: plan, error: planErr } = await admin
      .from('subscription_plans')
      .select('*')
      .eq('id', plan_id)
      .maybeSingle();
    if (planErr || !plan) return json(404, { error: 'Plan not found' });
    const planRec = plan as Record<string, unknown>;
    const monthlyPrice = Number(
      planRec.price_monthly ?? planRec.monthly_price ?? planRec.price ?? 0,
    );

    // Profile + email
    const { data: profile } = await admin
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', authUserId)
      .maybeSingle();
    const { data: emailRow } = await admin
      .from('emails')
      .select('email')
      .eq('user_id', authUserId)
      .maybeSingle();

    const fullName = [profile?.first_name, profile?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();

    let payload: GrowPayload;
    try {
      payload = buildPayload({
        business: { id: business.id, name: business.name },
        user: {
          full_name: fullName || (userData.user.email ?? 'Customer'),
          email:
            emailRow?.email ??
            userData.user.email ??
            (business as any).official_email ??
            (business as any).business_email ??
            '',
          phone: profile?.phone ?? (business as any).phone ?? '',
        },
        plan: { id: String(plan.id), name: (plan as any).name, monthly_price: monthlyPrice },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return json(400, { error: 'Validation failed', detail: msg });
    }

    // Create payment session
    const { data: session, error: insErr } = await admin
      .from('payment_sessions')
      .insert({
        business_id: business.id,
        user_id: authUserId,
        plan_id: plan.id,
        payment_provider: 'grow',
        status: 'pending_payment',
        metadata: { payload, billing_cycle: 'monthly', currency: 'ILS' },
      })
      .select('id')
      .single();

    if (insErr || !session) {
      console.error('payment_sessions insert failed:', insErr);
      return json(500, { error: 'Failed to create session', detail: insErr?.message });
    }

    await admin.from('billing_events').insert({
      business_id: business.id,
      user_id: authUserId,
      event_type: 'grow_session_created',
      new_status: 'pending_payment',
      source: 'grow-start-checkout',
      metadata: { session_id: session.id, plan_id: plan.id },
    });

    const callbackStatusUrl = `${SUPABASE_URL}/functions/v1/grow-update-session-status`;

    // Call Make with timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    let makeStatus = 0;
    let makeBodyText = '';
    let checkoutUrl: string | null = null;
    let providerSessionId: string | null = null;
    let failureReason: string | null = null;

    try {
      const resp = await fetch(MAKE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-mlaiko-secret': GROW_WEBHOOK_SECRET,
        },
        body: JSON.stringify({
          session_id: session.id,
          payload,
          callback_status_url: callbackStatusUrl,
        }),
        signal: controller.signal,
      });
      makeStatus = resp.status;
      makeBodyText = await resp.text();

      if (!resp.ok) {
        failureReason = `make_http_${resp.status}`;
      } else {
        let parsedBody: any = null;
        try {
          parsedBody = makeBodyText ? JSON.parse(makeBodyText) : null;
        } catch {
          failureReason = 'invalid_json_response';
        }
        if (parsedBody) {
          checkoutUrl =
            parsedBody.checkout_url ?? parsedBody.checkoutUrl ?? parsedBody.url ?? null;
          providerSessionId =
            parsedBody.provider_session_id ??
            parsedBody.providerSessionId ??
            parsedBody.session_id ??
            null;
          if (!checkoutUrl || typeof checkoutUrl !== 'string' || !/^https?:\/\//.test(checkoutUrl)) {
            failureReason = failureReason ?? 'missing_checkout_url';
            checkoutUrl = null;
          }
        }
      }
    } catch (e) {
      const isAbort = (e as Error)?.name === 'AbortError';
      failureReason = isAbort ? 'timeout' : 'network_error';
      console.error('Make webhook call failed:', e);
    } finally {
      clearTimeout(timer);
    }

    if (checkoutUrl) {
      await admin
        .from('payment_sessions')
        .update({
          status: 'payment_link_created',
          checkout_url: checkoutUrl,
          provider_session_id: providerSessionId,
        })
        .eq('id', session.id);

      await admin.from('billing_events').insert({
        business_id: business.id,
        user_id: authUserId,
        event_type: 'grow_payment_link_created',
        previous_status: 'pending_payment',
        new_status: 'payment_link_created',
        source: 'grow-start-checkout',
        metadata: { session_id: session.id, provider_session_id: providerSessionId },
      });

      return json(200, { session_id: session.id, checkout_url: checkoutUrl });
    }

    // Failure path
    await admin
      .from('payment_sessions')
      .update({ status: 'failed' })
      .eq('id', session.id);

    await admin.from('billing_events').insert({
      business_id: business.id,
      user_id: authUserId,
      event_type: 'grow_checkout_failed',
      previous_status: 'pending_payment',
      new_status: 'failed',
      source: 'grow-start-checkout',
      metadata: {
        session_id: session.id,
        reason: failureReason ?? 'unknown',
        http_status: makeStatus,
        response_preview: makeBodyText.slice(0, 500),
      },
    });

    return json(502, {
      error: 'checkout_link_failed',
      detail: failureReason ?? 'unknown',
      session_id: session.id,
    });
  } catch (e) {
    console.error('grow-start-checkout error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return json(500, { error: msg });
  }
});