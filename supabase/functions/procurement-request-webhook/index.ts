import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mlaiko-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

console.log("procurement-request-webhook started");

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  try {
    // Auth
    const secret = req.headers.get('x-mlaiko-secret');
    const expectedSecret = Deno.env.get('MLAIKO_WEBHOOK_SECRET');
    if (!expectedSecret || !secret || secret !== expectedSecret) {
      return errorResponse(401, 'Unauthorized');
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return errorResponse(400, 'Invalid JSON body'); }

    const { procurement_request_id, business_id, message } = body;

    if (!procurement_request_id || typeof procurement_request_id !== 'string' || !UUID_REGEX.test(procurement_request_id))
      return errorResponse(400, 'procurement_request_id must be a valid UUID');
    if (!business_id || typeof business_id !== 'string' || !UUID_REGEX.test(business_id))
      return errorResponse(400, 'business_id must be a valid UUID');

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Verify request exists and belongs to business
    const { data: request } = await supabase
      .from('procurement_requests')
      .select('id, business_id')
      .eq('id', procurement_request_id)
      .single();

    if (!request) return errorResponse(404, 'Procurement request not found');
    if (request.business_id !== business_id) return errorResponse(403, 'business_id mismatch');

    // Log activity (non-fatal)
    try {
      const { data: biz } = await supabase
        .from('businesses')
        .select('owner_id')
        .eq('id', business_id)
        .single();

      if (biz?.owner_id) {
        await supabase.from('recent_activity').insert({
          business_id: business_id as string,
          user_id: biz.owner_id,
          action_type: 'procurement_request_sent',
          title: 'בקשת רכש נשלחה לספקים',
          description: (typeof message === 'string' ? message : null),
          is_system_generated: true,
          status_color: 'info',
          priority_level: 'medium',
          metadata: { procurement_request_id },
        });
      }
    } catch (logErr) {
      console.error("Activity log error (non-fatal):", logErr);
    }

    return new Response(JSON.stringify({
      ok: true,
      procurement_request_id,
      logged: true,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse(500, 'Internal server error');
  }
});
