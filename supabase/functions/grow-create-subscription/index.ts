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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const authUserId = userData.user.id;

    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const { business_id, plan_id } = parsed.data;

    // Load business (must belong to caller)
    const { data: business, error: bizErr } = await admin
      .from('businesses')
      .select('id, name, owner_id, official_email, business_email, phone')
      .eq('id', business_id)
      .maybeSingle();
    if (bizErr || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (business.owner_id !== authUserId) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load plan (server-side price — never trust client)
    const { data: plan, error: planErr } = await admin
      .from('subscription_plans')
      .select('id, name, price_monthly, price, monthly_price')
      .eq('id', plan_id)
      .maybeSingle();
    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const monthlyPrice = Number(
      // try common column names
      (plan as Record<string, unknown>).price_monthly ??
        (plan as Record<string, unknown>).monthly_price ??
        (plan as Record<string, unknown>).price ??
        0,
    );

    // Load profile for owner contact info
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

    // Build & validate
    let payload: GrowPayload;
    try {
      payload = buildPayload({
        business: { id: business.id, name: business.name },
        user: {
          full_name: fullName || (userData.user.email ?? 'Customer'),
          email:
            emailRow?.email ??
            userData.user.email ??
            business.official_email ??
            business.business_email ??
            '',
          phone: profile?.phone ?? business.phone ?? '',
        },
        plan: { id: String(plan.id), name: plan.name, monthly_price: monthlyPrice },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Validation failed';
      return new Response(JSON.stringify({ error: 'Validation failed', detail: msg }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Persist session
    const { data: session, error: insErr } = await admin
      .from('payment_sessions')
      .insert({
        business_id: business.id,
        user_id: authUserId,
        plan_id: plan.id,
        payment_provider: 'grow',
        status: 'pending_payment',
        metadata: {
          payload,
          billing_cycle: 'monthly',
          currency: 'ILS',
        },
      })
      .select('id')
      .single();

    if (insErr || !session) {
      console.error('payment_sessions insert failed:', insErr);
      return new Response(
        JSON.stringify({ error: 'Failed to create session', detail: insErr?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await admin.from('billing_events').insert({
      business_id: business.id,
      user_id: authUserId,
      event_type: 'grow_session_created',
      new_status: 'pending_payment',
      source: 'grow-create-subscription',
      metadata: { session_id: session.id, plan_id: plan.id },
    });

    return new Response(
      JSON.stringify({ session_id: session.id, payload }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('grow-create-subscription error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});