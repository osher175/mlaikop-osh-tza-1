import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mlaiko-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_QUOTE_SOURCES = ['whatsapp', 'email', 'manual', 'api'];
const DEFAULT_SCORING_WEIGHTS = { price: 0.4, delivery: 0.3, supplier_priority: 0.2, reliability: 0.1 };
const NULL_DELIVERY_FALLBACK = 30;

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
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

  // 1. Get business owner
  const { data: biz } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .single();
  if (biz?.owner_id) recipients.add(biz.owner_id);

  // 2. Get users with admin/owner/super-user roles linked to this business
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

  // 3. Fallback: if still empty, get all user_businesses members
  if (recipients.size === 0) {
    const { data: buUsers } = await supabase
      .from('user_businesses')
      .select('user_id')
      .eq('business_id', businessId);
    if (buUsers) buUsers.forEach(u => recipients.add(u.user_id));
  }

  return Array.from(recipients);
}

console.log("procurement-quote-webhook v2 started");

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  try {
    // --- 1. Auth ---
    const secret = req.headers.get('x-mlaiko-secret');
    const expectedSecret = Deno.env.get('MLAIKO_WEBHOOK_SECRET');
    if (!expectedSecret || !secret || secret !== expectedSecret) {
      console.error("Unauthorized: invalid x-mlaiko-secret");
      return errorResponse(401, 'Unauthorized');
    }

    // --- 2. Parse & validate ---
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return errorResponse(400, 'Invalid JSON body'); }

    const { procurement_request_id, business_id, supplier_id, price_per_unit, available, delivery_time_days, currency, raw_message, quote_source } = body;

    if (!procurement_request_id || typeof procurement_request_id !== 'string' || !UUID_REGEX.test(procurement_request_id))
      return errorResponse(400, 'procurement_request_id must be a valid UUID');
    if (!business_id || typeof business_id !== 'string' || !UUID_REGEX.test(business_id))
      return errorResponse(400, 'business_id must be a valid UUID');
    if (!supplier_id || typeof supplier_id !== 'string' || !UUID_REGEX.test(supplier_id))
      return errorResponse(400, 'supplier_id must be a valid UUID');
    if (price_per_unit === undefined || price_per_unit === null || typeof price_per_unit !== 'number' || price_per_unit <= 0)
      return errorResponse(400, 'price_per_unit must be > 0');
    if (available !== undefined && typeof available !== 'boolean')
      return errorResponse(400, 'available must be a boolean');
    if (delivery_time_days !== undefined && delivery_time_days !== null) {
      if (typeof delivery_time_days !== 'number' || !Number.isInteger(delivery_time_days) || delivery_time_days < 0)
        return errorResponse(400, 'delivery_time_days must be null or integer >= 0');
    }
    if (typeof quote_source === 'string' && quote_source.length > 0 && !VALID_QUOTE_SOURCES.includes(quote_source))
      return errorResponse(400, `quote_source must be one of: ${VALID_QUOTE_SOURCES.join(', ')}`);

    const availableVal = (available as boolean) ?? true;
    const deliveryVal = (delivery_time_days as number | null) ?? null;
    const currencyVal = (typeof currency === 'string' && currency.length > 0) ? currency : 'ILS';
    const quoteSourceVal = (typeof quote_source === 'string' && VALID_QUOTE_SOURCES.includes(quote_source)) ? quote_source : 'api';
    const rawMessageVal = (typeof raw_message === 'string') ? raw_message : null;

    // --- 3. Supabase client ---
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // --- 4. Fetch procurement_request ---
    const { data: request, error: reqError } = await supabase
      .from('procurement_requests')
      .select('id, business_id, product_id, status')
      .eq('id', procurement_request_id)
      .single();

    if (reqError || !request) return errorResponse(404, 'Procurement request not found');
    if (request.business_id !== business_id) return errorResponse(403, 'business_id mismatch');
    if (request.status === 'cancelled') return errorResponse(409, 'Procurement request is cancelled');

    // --- 5. Insert quote ---
    const { data: quote, error: quoteError } = await supabase
      .from('supplier_quotes')
      .insert({
        procurement_request_id: procurement_request_id as string,
        supplier_id: supplier_id as string,
        price_per_unit: price_per_unit as number,
        available: availableVal,
        delivery_time_days: deliveryVal,
        currency: currencyVal,
        raw_message: rawMessageVal,
        quote_source: quoteSourceVal,
      })
      .select('id')
      .single();

    if (quoteError || !quote) {
      console.error("Failed to insert quote:", quoteError);
      return errorResponse(500, 'Failed to insert quote');
    }
    console.log("Quote inserted:", quote.id);

    // --- 6. Update status if waiting_for_quotes ---
    let finalStatus = request.status;
    if (request.status === 'waiting_for_quotes') {
      await supabase.from('procurement_requests')
        .update({ status: 'quotes_received', updated_at: new Date().toISOString() })
        .eq('id', procurement_request_id);
      finalStatus = 'quotes_received';
    }

    // --- 7. Ranking (deterministic, hardened) ---
    try {
      const { data: settings } = await supabase
        .from('procurement_settings')
        .select('scoring_weights')
        .eq('business_id', business_id)
        .single();

      const weights = (settings?.scoring_weights as Record<string, number>) || DEFAULT_SCORING_WEIGHTS;
      const wPrice = weights.price ?? 0.4;
      const wDelivery = weights.delivery ?? 0.3;
      const wPriority = weights.supplier_priority ?? 0.2;

      const { data: allQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, supplier_id, price_per_unit, delivery_time_days, available')
        .eq('procurement_request_id', procurement_request_id);

      if (allQuotes && allQuotes.length > 0) {
        const availableQuotes = allQuotes.filter(q => q.available);

        if (availableQuotes.length === 0) {
          // All quotes unavailable — stay at quotes_received, no recommendation
          console.log("All quotes unavailable — skipping ranking");
        } else {
          // Load supplier preferences in one call
          const supplierIds = [...new Set(availableQuotes.map(q => q.supplier_id))];
          const { data: prefs } = await supabase
            .from('supplier_preferences')
            .select('supplier_id, priority_score')
            .eq('business_id', business_id)
            .in('supplier_id', supplierIds);

          const prefMap: Record<string, number> = {};
          (prefs || []).forEach(p => { prefMap[p.supplier_id] = p.priority_score; });

          // Compute normalization ranges
          const prices = availableQuotes.map(q => q.price_per_unit);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceRange = maxPrice - minPrice || 1;

          const deliveries = availableQuotes.map(q => q.delivery_time_days ?? NULL_DELIVERY_FALLBACK);
          const minDel = Math.min(...deliveries);
          const maxDel = Math.max(...deliveries);
          const delRange = maxDel - minDel || 1;

          const priorities = supplierIds.map(id => prefMap[id] ?? 0);
          const maxPrio = Math.max(...priorities, 1);

          // Score all quotes in memory
          interface ScoredQuote { id: string; score: number; price: number; delivery: number | null }
          const scoredQuotes: ScoredQuote[] = [];

          for (const q of availableQuotes) {
            const priceScore = 1 - (q.price_per_unit - minPrice) / priceRange;
            const delScore = 1 - ((q.delivery_time_days ?? NULL_DELIVERY_FALLBACK) - minDel) / delRange;
            const prioScore = (prefMap[q.supplier_id] ?? 0) / maxPrio;
            const totalScore = Math.round((wPrice * priceScore + wDelivery * delScore + wPriority * prioScore) * 100);
            scoredQuotes.push({ id: q.id, score: totalScore, price: q.price_per_unit, delivery: q.delivery_time_days });
          }

          // Mark unavailable quotes as score=0
          const unavailableIds = allQuotes.filter(q => !q.available).map(q => q.id);

          // Batch update scores — one call per unique score value to minimize DB calls
          const scoreGroups: Record<number, string[]> = {};
          for (const sq of scoredQuotes) {
            if (!scoreGroups[sq.score]) scoreGroups[sq.score] = [];
            scoreGroups[sq.score].push(sq.id);
          }
          if (unavailableIds.length > 0) {
            scoreGroups[0] = [...(scoreGroups[0] || []), ...unavailableIds];
          }

          const updatePromises = Object.entries(scoreGroups).map(([score, ids]) =>
            supabase.from('supplier_quotes').update({ score: Number(score) }).in('id', ids)
          );
          await Promise.all(updatePromises);

          // Find best quote
          scoredQuotes.sort((a, b) => b.score - a.score);
          const best = scoredQuotes[0];

          const explanation = `המלצה: מחיר ₪${best.price}, משלוח ${best.delivery ?? '?'} ימים (ציון ${best.score}/100)`;

          await supabase.from('procurement_requests').update({
            recommended_quote_id: best.id,
            status: 'waiting_for_approval',
            notes: explanation,
            updated_at: new Date().toISOString(),
          }).eq('id', procurement_request_id);

          finalStatus = 'waiting_for_approval';
          console.log("Ranking done. Best:", best.id, "score:", best.score);
        }
      }
    } catch (rankErr) {
      console.error("Ranking error (non-fatal):", rankErr);
    }

    // --- 8. Activity & notifications (non-fatal) ---
    try {
      const recipients = await resolveBusinessRecipients(supabase, business_id as string);

      const [supplierRes, productRes] = await Promise.all([
        supabase.from('suppliers').select('name').eq('id', supplier_id).single(),
        supabase.from('products').select('name').eq('id', request.product_id).single(),
      ]);
      const supplierName = supplierRes.data?.name || 'ספק';
      const productName = productRes.data?.name || 'מוצר';

      if (recipients.length > 0) {
        // Activity log (one entry, using first recipient as user_id)
        await supabase.from('recent_activity').insert({
          business_id: business_id as string,
          user_id: recipients[0],
          action_type: 'quote_received',
          title: `הצעת מחיר חדשה מ${supplierName}`,
          description: `₪${price_per_unit} ליחידה עבור ${productName}`,
          product_id: request.product_id,
          is_system_generated: true,
          status_color: 'info',
          priority_level: 'medium',
          metadata: { supplier_id, price_per_unit, delivery_time_days: deliveryVal },
        });

        // Notifications to ALL recipients
        const notifRows = recipients.map(uid => ({
          business_id: business_id as string,
          user_id: uid,
          type: 'procurement_quote',
          title: 'הצעת מחיר חדשה התקבלה',
          message: `הצעת מחיר מ${supplierName} עבור ${productName} – ₪${price_per_unit} ליחידה`,
        }));
        await supabase.from('notifications').insert(notifRows);
      }
    } catch (logErr) {
      console.error("Activity/notification error (non-fatal):", logErr);
    }

    // --- 9. Response ---
    return jsonResponse({
      ok: true,
      quote_id: quote.id,
      procurement_request_id,
      status: finalStatus,
    });

  } catch (error) {
    console.error('Unhandled error:', error);
    return errorResponse(500, 'Internal server error');
  }
});
