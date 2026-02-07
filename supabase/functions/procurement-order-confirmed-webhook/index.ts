import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mlaiko-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = ['ordered', 'confirmed'];

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Resolve all admin/owner user IDs for a business */
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

console.log("procurement-order-confirmed-webhook started");

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

    const { procurement_request_id, business_id, supplier_id, status, supplier_confirmation } = body;

    // Validate
    if (!procurement_request_id || typeof procurement_request_id !== 'string' || !UUID_REGEX.test(procurement_request_id))
      return errorResponse(400, 'procurement_request_id must be a valid UUID');
    if (!business_id || typeof business_id !== 'string' || !UUID_REGEX.test(business_id))
      return errorResponse(400, 'business_id must be a valid UUID');
    if (!supplier_id || typeof supplier_id !== 'string' || !UUID_REGEX.test(supplier_id))
      return errorResponse(400, 'supplier_id must be a valid UUID');
    
    const statusVal = (typeof status === 'string' && VALID_STATUSES.includes(status)) ? status : 'ordered';
    const confirmationText = (typeof supplier_confirmation === 'string' && supplier_confirmation.length > 0)
      ? supplier_confirmation : null;

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Fetch request
    const { data: request, error: reqError } = await supabase
      .from('procurement_requests')
      .select('id, business_id, product_id, status, notes')
      .eq('id', procurement_request_id)
      .single();

    if (reqError || !request) return errorResponse(404, 'Procurement request not found');
    if (request.business_id !== business_id) return errorResponse(403, 'business_id mismatch');
    if (request.status === 'cancelled') return errorResponse(409, 'Procurement request is cancelled');

    // Build updated notes (append, do not overwrite)
    const timestamp = new Date().toISOString();
    const newNote = confirmationText
      ? `[${timestamp}] אישור מספק: ${confirmationText}`
      : `[${timestamp}] הזמנה אושרה על ידי הספק`;
    const updatedNotes = request.notes ? `${request.notes}\n${newNote}` : newNote;

    // Update request
    const { error: updateError } = await supabase
      .from('procurement_requests')
      .update({
        status: statusVal,
        notes: updatedNotes,
        updated_at: timestamp,
      })
      .eq('id', procurement_request_id);

    if (updateError) {
      console.error("Failed to update request:", updateError);
      return errorResponse(500, 'Failed to update procurement request');
    }

    // Notifications (non-fatal)
    try {
      const recipients = await resolveBusinessRecipients(supabase, business_id as string);
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', supplier_id)
        .single();
      const supplierName = supplierData?.name || 'ספק';

      if (recipients.length > 0) {
        // Activity log
        await supabase.from('recent_activity').insert({
          business_id: business_id as string,
          user_id: recipients[0],
          action_type: 'order_confirmed',
          title: `הזמנה אושרה מ${supplierName}`,
          description: confirmationText || 'הספק אישר את ההזמנה',
          is_system_generated: true,
          status_color: 'success',
          priority_level: 'high',
          metadata: { procurement_request_id, supplier_id, status: statusVal },
        });

        // Notifications to all recipients
        const notifRows = recipients.map(uid => ({
          business_id: business_id as string,
          user_id: uid,
          type: 'procurement_order',
          title: 'הזמנה אושרה',
          message: `${supplierName} אישר את ההזמנה – סטטוס: ${statusVal === 'ordered' ? 'הוזמן' : 'אושר'}`,
        }));
        await supabase.from('notifications').insert(notifRows);
      }
    } catch (logErr) {
      console.error("Notification error (non-fatal):", logErr);
    }

    return new Response(JSON.stringify({
      ok: true,
      procurement_request_id,
      status: statusVal,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse(500, 'Internal server error');
  }
});
