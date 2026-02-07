import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-mlaiko-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_QUOTE_SOURCES = ['whatsapp', 'email', 'manual', 'api'];

const DEFAULT_SCORING_WEIGHTS = { price: 0.4, delivery: 0.3, supplier_priority: 0.2, reliability: 0.1 };

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ ok: false, error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

console.log("procurement-quote-webhook started");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    // --- 1. Auth: validate x-mlaiko-secret ---
    const secret = req.headers.get('x-mlaiko-secret');
    const expectedSecret = Deno.env.get('MLAIKO_WEBHOOK_SECRET');

    if (!expectedSecret || !secret || secret !== expectedSecret) {
      console.error("Unauthorized: invalid or missing x-mlaiko-secret");
      return errorResponse(401, 'Unauthorized');
    }

    // --- 2. Parse & validate body ---
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Invalid JSON body');
    }

    const {
      procurement_request_id,
      business_id,
      supplier_id,
      price_per_unit,
      available,
      delivery_time_days,
      currency,
      raw_message,
      quote_source,
    } = body as Record<string, unknown>;

    // UUID validations
    if (!procurement_request_id || typeof procurement_request_id !== 'string' || !UUID_REGEX.test(procurement_request_id)) {
      return errorResponse(400, 'procurement_request_id must be a valid UUID');
    }
    if (!business_id || typeof business_id !== 'string' || !UUID_REGEX.test(business_id)) {
      return errorResponse(400, 'business_id must be a valid UUID');
    }
    if (!supplier_id || typeof supplier_id !== 'string' || !UUID_REGEX.test(supplier_id)) {
      return errorResponse(400, 'supplier_id must be a valid UUID');
    }

    // price_per_unit
    if (price_per_unit === undefined || price_per_unit === null || typeof price_per_unit !== 'number' || price_per_unit <= 0) {
      return errorResponse(400, 'price_per_unit must be a number greater than 0');
    }

    // available
    if (available !== undefined && typeof available !== 'boolean') {
      return errorResponse(400, 'available must be a boolean');
    }
    const availableVal = available ?? true;

    // delivery_time_days
    if (delivery_time_days !== undefined && delivery_time_days !== null) {
      if (typeof delivery_time_days !== 'number' || !Number.isInteger(delivery_time_days) || delivery_time_days < 0) {
        return errorResponse(400, 'delivery_time_days must be null or an integer >= 0');
      }
    }
    const deliveryVal = delivery_time_days ?? null;

    // currency
    const currencyVal = (typeof currency === 'string' && currency.length > 0) ? currency : 'ILS';

    // quote_source
    let quoteSourceVal = 'api';
    if (typeof quote_source === 'string' && quote_source.length > 0) {
      if (!VALID_QUOTE_SOURCES.includes(quote_source)) {
        return errorResponse(400, `quote_source must be one of: ${VALID_QUOTE_SOURCES.join(', ')}`);
      }
      quoteSourceVal = quote_source;
    }

    // raw_message
    const rawMessageVal = (typeof raw_message === 'string') ? raw_message : null;

    // --- 3. Supabase client (service role) ---
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // --- 4. Fetch procurement_request ---
    const { data: request, error: reqError } = await supabase
      .from('procurement_requests')
      .select('id, business_id, product_id, status')
      .eq('id', procurement_request_id)
      .single();

    if (reqError || !request) {
      console.error("Procurement request not found:", reqError);
      return errorResponse(404, 'Procurement request not found');
    }

    // Business ID mismatch check
    if (request.business_id !== business_id) {
      console.error("Business ID mismatch:", request.business_id, "vs", business_id);
      return errorResponse(403, 'business_id does not match the procurement request');
    }

    // Cancelled check
    if (request.status === 'cancelled') {
      return errorResponse(409, 'Procurement request is cancelled; cannot add quotes');
    }

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
      const { count } = await supabase
        .from('supplier_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('procurement_request_id', procurement_request_id);

      if (count && count >= 1) {
        await supabase
          .from('procurement_requests')
          .update({ status: 'quotes_received', updated_at: new Date().toISOString() })
          .eq('id', procurement_request_id);
        finalStatus = 'quotes_received';
      }
    }

    // --- 7. Ranking ---
    try {
      // Load scoring weights
      const { data: settings } = await supabase
        .from('procurement_settings')
        .select('scoring_weights')
        .eq('business_id', business_id)
        .single();

      const weights = (settings?.scoring_weights as Record<string, number>) || DEFAULT_SCORING_WEIGHTS;
      const wPrice = weights.price ?? 0.4;
      const wDelivery = weights.delivery ?? 0.3;
      const wPriority = weights.supplier_priority ?? 0.2;

      // Load all quotes for this request
      const { data: allQuotes } = await supabase
        .from('supplier_quotes')
        .select('id, supplier_id, price_per_unit, delivery_time_days, available')
        .eq('procurement_request_id', procurement_request_id);

      if (allQuotes && allQuotes.length > 0) {
        const availableQuotes = allQuotes.filter(q => q.available);

        if (availableQuotes.length > 0) {
          // Load supplier preferences
          const supplierIds = [...new Set(availableQuotes.map(q => q.supplier_id))];
          const { data: prefs } = await supabase
            .from('supplier_preferences')
            .select('supplier_id, priority_score')
            .eq('business_id', business_id)
            .in('supplier_id', supplierIds);

          const prefMap: Record<string, number> = {};
          (prefs || []).forEach(p => { prefMap[p.supplier_id] = p.priority_score; });

          // Normalize
          const prices = availableQuotes.map(q => q.price_per_unit);
          const minPrice = Math.min(...prices);
          const maxPrice = Math.max(...prices);
          const priceRange = maxPrice - minPrice || 1;

          const deliveries = availableQuotes.map(q => q.delivery_time_days ?? 30);
          const minDel = Math.min(...deliveries);
          const maxDel = Math.max(...deliveries);
          const delRange = maxDel - minDel || 1;

          const priorities = supplierIds.map(id => prefMap[id] ?? 0);
          const maxPrio = Math.max(...priorities, 1);

          // Score each quote
          let bestQuote = availableQuotes[0];
          let bestScore = -Infinity;

          for (const q of availableQuotes) {
            const priceScore = 1 - (q.price_per_unit - minPrice) / priceRange;
            const delScore = 1 - ((q.delivery_time_days ?? 30) - minDel) / delRange;
            const prioScore = (prefMap[q.supplier_id] ?? 0) / maxPrio;

            const totalScore = wPrice * priceScore + wDelivery * delScore + wPriority * prioScore;

            // Update score on the quote row
            await supabase.from('supplier_quotes').update({ score: Math.round(totalScore * 100) }).eq('id', q.id);

            if (totalScore > bestScore) {
              bestScore = totalScore;
              bestQuote = q;
            }
          }

          // Update recommended quote and status
          const explanation = `המלצה: מחיר ₪${bestQuote.price_per_unit}, משלוח ${bestQuote.delivery_time_days ?? '?'} ימים (ציון ${Math.round(bestScore * 100)}/100)`;

          await supabase
            .from('procurement_requests')
            .update({
              recommended_quote_id: bestQuote.id,
              status: 'waiting_for_approval',
              notes: explanation,
              updated_at: new Date().toISOString(),
            })
            .eq('id', procurement_request_id);

          finalStatus = 'waiting_for_approval';
          console.log("Ranking done. Best quote:", bestQuote.id, "score:", Math.round(bestScore * 100));
        }
      }
    } catch (rankErr) {
      console.error("Ranking error (non-fatal):", rankErr);
    }

    // --- 8. Activity log & notification ---
    try {
      // Get supplier name and product info for notification
      const [supplierRes, productRes, businessRes] = await Promise.all([
        supabase.from('suppliers').select('name').eq('id', supplier_id).single(),
        supabase.from('products').select('name').eq('id', request.product_id).single(),
        supabase.from('businesses').select('owner_id').eq('id', business_id).single(),
      ]);

      const supplierName = supplierRes.data?.name || 'ספק';
      const productName = productRes.data?.name || 'מוצר';
      const ownerId = businessRes.data?.owner_id;

      // Activity log
      if (ownerId) {
        await supabase.from('recent_activity').insert({
          business_id: business_id as string,
          user_id: ownerId,
          action_type: 'quote_received',
          title: `הצעת מחיר חדשה מ${supplierName}`,
          description: `₪${price_per_unit} ליחידה עבור ${productName}`,
          product_id: request.product_id,
          is_system_generated: true,
          icon_name: 'ShoppingCart',
          status_color: 'info',
          priority_level: 'medium',
          metadata: { supplier_id, price_per_unit, delivery_time_days: deliveryVal },
        });

        // Notification
        await supabase.from('notifications').insert({
          business_id: business_id as string,
          user_id: ownerId,
          type: 'procurement_quote',
          title: 'הצעת מחיר חדשה התקבלה',
          message: `הצעת מחיר חדשה מ${supplierName} עבור ${productName} – ₪${price_per_unit} ליחידה`,
          product_id: request.product_id,
        });
      }
    } catch (logErr) {
      console.error("Activity/notification error (non-fatal):", logErr);
    }

    // --- 9. Response ---
    return new Response(JSON.stringify({
      ok: true,
      quote_id: quote.id,
      procurement_request_id,
      status: finalStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unhandled error in procurement-quote-webhook:', error);
    return errorResponse(500, 'Internal server error');
  }
});
