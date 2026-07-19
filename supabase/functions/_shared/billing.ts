// CODE FREEZE: Subscription lock and payment flow are stable.
// Do not modify without explicit approval. See CODE_FREEZE_SUBSCRIPTION.md
// Shared billing gate helper for Edge Functions.
// Calls public.require_active_business(business_id). On failure, logs a
// billing_events row and returns a 402-style Response.
//
// Usage:
//   const gate = await requireActiveBusinessOrRespond(supabase, business_id, {
//     source: 'procurement-start-outreach', action: 'start_outreach', corsHeaders,
//   });
//   if (gate) return gate;

export interface BillingGateOptions {
  source: string;
  action: string;
  corsHeaders: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export async function requireActiveBusinessOrRespond(
  supabase: any,
  businessId: string | null | undefined,
  opts: BillingGateOptions,
): Promise<Response | null> {
  // Kill-switch: when BILLING_LOCK_ENABLED is not explicitly 'true', the gate
  // is neutralized. Safe default = disabled (matches frontend featureFlag.ts).
  if (Deno.env.get('BILLING_LOCK_ENABLED') !== 'true') {
    return null;
  }

  if (!businessId) {
    return new Response(
      JSON.stringify({ error: 'Missing business_id for billing gate' }),
      { status: 400, headers: { ...opts.corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { error } = await supabase.rpc('require_active_business', {
    p_business_id: businessId,
  });

  if (!error) return null;

  // Best-effort billing event log
  try {
    await supabase.from('billing_events').insert({
      business_id: businessId,
      event_type: 'billing_gate_blocked_action',
      source: opts.source,
      metadata: {
        action: opts.action,
        error_message: error.message,
        ...(opts.metadata ?? {}),
      },
    });
  } catch (logErr) {
    console.error(`[${opts.source}] failed to log billing_events:`, logErr);
  }

  console.warn(`[${opts.source}] billing gate blocked`, {
    business_id: businessId,
    action: opts.action,
    error: error.message,
  });

  return new Response(
    JSON.stringify({
      error: 'Subscription required for this business.',
      code: 'billing_inactive',
    }),
    { status: 402, headers: { ...opts.corsHeaders, 'Content-Type': 'application/json' } },
  );
}