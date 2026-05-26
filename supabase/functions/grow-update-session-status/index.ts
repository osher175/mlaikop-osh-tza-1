import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-mlaiko-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_STATUSES = [
  'pending_payment',
  'payment_link_created',
  'paid',
  'failed',
] as const;

const BodySchema = z.object({
  session_id: z.string().uuid(),
  status: z.enum(ALLOWED_STATUSES),
  provider_session_id: z.string().max(255).optional(),
  checkout_url: z.string().url().optional(),
  detail: z.record(z.unknown()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const expectedSecret = Deno.env.get('GROW_WEBHOOK_SECRET');
    const got = req.headers.get('x-mlaiko-secret');
    if (!expectedSecret || got !== expectedSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', issues: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { session_id, status, provider_session_id, checkout_url, detail } =
      parsed.data;

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: existing, error: loadErr } = await admin
      .from('payment_sessions')
      .select('id, business_id, user_id, status, metadata')
      .eq('id', session_id)
      .maybeSingle();
    if (loadErr || !existing) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const update: Record<string, unknown> = {
      status,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(detail ? { last_webhook: detail } : {}),
      },
    };
    if (provider_session_id) update.provider_session_id = provider_session_id;
    if (checkout_url) update.checkout_url = checkout_url;
    if (status === 'paid') update.completed_at = new Date().toISOString();

    const { error: updErr } = await admin
      .from('payment_sessions')
      .update(update)
      .eq('id', session_id);

    if (updErr) {
      console.error('payment_sessions update failed:', updErr);
      return new Response(
        JSON.stringify({ error: 'Update failed', detail: updErr.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    await admin.from('billing_events').insert({
      business_id: existing.business_id,
      user_id: existing.user_id,
      event_type: 'grow_status_change',
      old_status: existing.status,
      new_status: status,
      source: 'grow-update-session-status',
      metadata: { session_id, provider_session_id, checkout_url, detail },
    });

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('grow-update-session-status error:', e);
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
