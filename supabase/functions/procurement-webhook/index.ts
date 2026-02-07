import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-automation-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

console.log("Procurement Webhook Edge Function started");

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'receive_quote';

    if (action === 'receive_quote') {
      // Validate automation key for external webhooks
      const automationKey = req.headers.get('x-automation-key');
      const expectedKey = Deno.env.get('AUTOMATION_KEY');
      
      if (expectedKey && automationKey !== expectedKey) {
        console.error("Invalid automation key");
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const body = await req.json();
      console.log("Received quote:", JSON.stringify(body));

      const { procurement_request_id, supplier_id, price_per_unit, available, delivery_time_days, raw_message, quote_source } = body;

      if (!procurement_request_id || !supplier_id || price_per_unit === undefined) {
        return new Response(JSON.stringify({ error: 'Missing required fields: procurement_request_id, supplier_id, price_per_unit' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify request exists
      const { data: request, error: reqError } = await supabase
        .from('procurement_requests')
        .select('id, business_id, product_id, status')
        .eq('id', procurement_request_id)
        .single();

      if (reqError || !request) {
        console.error("Request not found:", reqError);
        return new Response(JSON.stringify({ error: 'Procurement request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Insert the quote
      const { data: quote, error: quoteError } = await supabase
        .from('supplier_quotes')
        .insert({
          procurement_request_id,
          supplier_id,
          price_per_unit,
          available: available ?? true,
          delivery_time_days: delivery_time_days ?? null,
          raw_message: raw_message ?? null,
          quote_source: quote_source ?? 'api',
        })
        .select()
        .single();

      if (quoteError) {
        console.error("Error inserting quote:", quoteError);
        return new Response(JSON.stringify({ error: 'Failed to insert quote', details: quoteError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log("Quote inserted:", quote.id);

      // Update request status to quotes_received if currently waiting
      if (request.status === 'waiting_for_quotes') {
        await supabase
          .from('procurement_requests')
          .update({ status: 'quotes_received', updated_at: new Date().toISOString() })
          .eq('id', procurement_request_id);
      }

      // Run scoring
      const { error: scoreError } = await supabase.rpc('score_procurement_quotes', { p_request_id: procurement_request_id });
      if (scoreError) {
        console.error("Scoring error:", scoreError);
      } else {
        console.log("Scoring completed for request:", procurement_request_id);
      }

      // Create notification
      const { data: supplier } = await supabase.from('suppliers').select('name').eq('id', supplier_id).single();
      const { data: business } = await supabase.from('businesses').select('owner_id').eq('id', request.business_id).single();
      
      if (business?.owner_id) {
        await supabase.from('notifications').insert({
          business_id: request.business_id,
          user_id: business.owner_id,
          type: 'procurement_quote',
          title: 'הצעת מחיר חדשה התקבלה',
          message: `הצעת מחיר חדשה התקבלה מ${supplier?.name || 'ספק'} - ₪${price_per_unit} ליחידה`,
          product_id: request.product_id,
        });
      }

      return new Response(JSON.stringify({ success: true, quote_id: quote.id }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'send_quote_requests') {
      // Authenticated endpoint - for sending outbound webhooks to suppliers
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: claims, error: authError } = await userClient.auth.getClaims(token);
      if (authError || !claims?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const body = await req.json();
      const { procurement_request_id } = body;

      if (!procurement_request_id) {
        return new Response(JSON.stringify({ error: 'Missing procurement_request_id' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get the request with product and supplier info
      const { data: request, error: reqError } = await supabase
        .from('procurement_requests')
        .select('*, products(name, barcode, supplier_id, business_id)')
        .eq('id', procurement_request_id)
        .single();

      if (reqError || !request) {
        return new Response(JSON.stringify({ error: 'Request not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Get suppliers to contact
      const supplierIds: string[] = [];
      if (request.products?.supplier_id) {
        supplierIds.push(request.products.supplier_id);
      }

      // Also get all business suppliers if product has no specific supplier
      if (supplierIds.length === 0) {
        const { data: businessSuppliers } = await supabase
          .from('suppliers')
          .select('id')
          .eq('business_id', request.business_id);
        
        if (businessSuppliers) {
          supplierIds.push(...businessSuppliers.map(s => s.id));
        }
      }

      // Get supplier details
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name, contact_email, phone')
        .in('id', supplierIds);

      // Send webhook to n8n/Make for each supplier
      const webhookUrl = "https://primary-production-b8cb.up.railway.app/webhook/procurement-quote-request";
      const results: Array<{ supplier_id: string; success: boolean }> = [];

      for (const supplier of (suppliers || [])) {
        try {
          const payload = {
            procurement_request_id: request.id,
            business_id: request.business_id,
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            supplier_email: supplier.contact_email,
            supplier_phone: supplier.phone,
            product_name: request.products?.name,
            product_barcode: request.products?.barcode,
            requested_quantity: request.requested_quantity,
            urgency: request.urgency,
            source: 'mlaiko_procurement',
          };

          console.log(`Sending quote request to supplier ${supplier.name}:`, JSON.stringify(payload));

          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          results.push({ supplier_id: supplier.id, success: response.ok });
          console.log(`Webhook to ${supplier.name}: ${response.status}`);
        } catch (err) {
          console.error(`Failed to send webhook to ${supplier.name}:`, err);
          results.push({ supplier_id: supplier.id, success: false });
        }
      }

      // Create notification
      const { data: business } = await supabase.from('businesses').select('owner_id').eq('id', request.business_id).single();
      if (business?.owner_id) {
        await supabase.from('notifications').insert({
          business_id: request.business_id,
          user_id: business.owner_id,
          type: 'procurement_request',
          title: 'בקשת רכש נשלחה',
          message: `בקשות הצעת מחיר נשלחו ל-${results.length} ספקים עבור ${request.products?.name}`,
          product_id: request.product_id,
        });
      }

      return new Response(JSON.stringify({ success: true, results }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'approve_order') {
      // Authenticated endpoint for approving an order
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } }
      });

      const token = authHeader.replace('Bearer ', '');
      const { data: claims, error: authError } = await userClient.auth.getClaims(token);
      if (authError || !claims?.claims) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }

      const body = await req.json();
      const { procurement_request_id, quote_id } = body;

      // Get request + quote + supplier details
      const { data: request } = await supabase
        .from('procurement_requests')
        .select('*, products(name, barcode)')
        .eq('id', procurement_request_id)
        .single();

      const { data: quote } = await supabase
        .from('supplier_quotes')
        .select('*, suppliers(name, contact_email, phone)')
        .eq('id', quote_id)
        .single();

      if (!request || !quote) {
        return new Response(JSON.stringify({ error: 'Request or quote not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Update status to approved
      await supabase
        .from('procurement_requests')
        .update({ status: 'approved', recommended_quote_id: quote_id, updated_at: new Date().toISOString() })
        .eq('id', procurement_request_id);

      // Send order webhook to n8n/Make
      const webhookUrl = "https://primary-production-b8cb.up.railway.app/webhook/procurement-order-approved";
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            procurement_request_id: request.id,
            business_id: request.business_id,
            quote_id: quote.id,
            supplier_id: quote.supplier_id,
            supplier_name: quote.suppliers?.name,
            supplier_email: quote.suppliers?.contact_email,
            supplier_phone: quote.suppliers?.phone,
            product_name: request.products?.name,
            product_barcode: request.products?.barcode,
            quantity: request.requested_quantity,
            price_per_unit: quote.price_per_unit,
            total_price: quote.price_per_unit * request.requested_quantity,
            delivery_time_days: quote.delivery_time_days,
            source: 'mlaiko_procurement',
          }),
        });

        // Update to ordered
        await supabase
          .from('procurement_requests')
          .update({ status: 'ordered', updated_at: new Date().toISOString() })
          .eq('id', procurement_request_id);

        console.log("Order webhook sent successfully");
      } catch (err) {
        console.error("Failed to send order webhook:", err);
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in procurement-webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error', details: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
