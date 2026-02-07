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

/** Resolve all admin/owner user IDs for a business, fallback to owner_id */
async function resolveBusinessRecipients(
  supabase: ReturnType<typeof createClient>,
  businessId: string,
): Promise<string[]> {
  const recipients = new Set<string>();

  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .single();
  if (biz?.owner_id) recipients.add(biz.owner_id);

  const { data: roleUsers } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('business_id', businessId);

  if (roleUsers) {
    for (const ru of roleUsers) {
      if (['admin', 'OWNER', 'elite_pilot_user', 'smart_master_user'].includes(ru.role)) {
        recipients.add(ru.user_id);
      }
    }
  }

  if (recipients.size === 0) {
    const { data: buUsers } = await supabase
      .from('user_businesses')
      .select('user_id')
      .eq('business_id', businessId);
    if (buUsers) buUsers.forEach(u => recipients.add(u.user_id));
  }

  return Array.from(recipients);
}

console.log("procurement-request-webhook v1 started");

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
      .select('id, business_id, status')
      .eq('id', procurement_request_id)
      .single();

    if (!request) return errorResponse(404, 'Procurement request not found');
    if (request.business_id !== business_id) return errorResponse(403, 'business_id mismatch');
    if (request.status === 'cancelled') return errorResponse(409, 'Procurement request is cancelled');

    // Activity & notifications (non-fatal, uses same recipients logic as other functions)
    try {
      const recipients = await resolveBusinessRecipients(supabase, business_id as string);

      if (recipients.length > 0) {
        // Activity log
        await supabase.from('recent_activity').insert({
          business_id: business_id as string,
          user_id: recipients[0],
          action_type: 'procurement_request_sent',
          title: 'בקשת רכש נשלחה לספקים',
          description: (typeof message === 'string' ? message : null),
          is_system_generated: true,
          status_color: 'info',
          priority_level: 'medium',
          metadata: { procurement_request_id },
        });

        // Notifications to ALL recipients
        const notifRows = recipients.map(uid => ({
          business_id: business_id as string,
          user_id: uid,
          type: 'procurement_quote' as const,
          title: 'בקשת רכש נשלחה',
          message: 'בקשת רכש חדשה נשלחה לספקים לקבלת הצעות מחיר',
        }));
        await supabase.from('notifications').insert(notifRows);
      }
    } catch (logErr) {
      console.error("Activity/notification error (non-fatal):", logErr);
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
