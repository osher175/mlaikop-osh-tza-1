import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      'https://gtakgctmtayalcbpnryg.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWtnY3RtdGF5YWxjYnBucnlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTAxMDQzMjUsImV4cCI6MjA2NTY4MDMyNX0.CEosZQphWf4FG4mtJZ7Hlmz_c4EYoivyQru1VvGuPdU',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { business_id, created_by, default_requested_quantity = 1 } = await req.json()

    if (!business_id || !created_by) {
      return new Response(JSON.stringify({ error: 'business_id and created_by are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get products with thresholds where quantity <= threshold
    const { data: lowStockProducts, error: productsError } = await supabase
      .from('product_thresholds')
      .select('product_id, low_stock_threshold, products(id, name, quantity)')
      .eq('business_id', business_id)

    if (productsError) throw productsError

    const belowThreshold = (lowStockProducts || []).filter((pt: any) => {
      const product = pt.products
      return product && product.quantity <= pt.low_stock_threshold
    })

    if (belowThreshold.length === 0) {
      return new Response(JSON.stringify({ ok: true, created: 0, skipped: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing open requests for these products
    const productIds = belowThreshold.map((pt: any) => pt.product_id)
    const { data: existingRequests, error: reqError } = await supabase
      .from('procurement_requests')
      .select('product_id')
      .eq('business_id', business_id)
      .in('status', ['draft', 'in_progress', 'waiting_for_quotes', 'quotes_received', 'waiting_for_approval'])
      .in('product_id', productIds)

    if (reqError) throw reqError

    const existingProductIds = new Set((existingRequests || []).map((r: any) => r.product_id))

    const toCreate = belowThreshold.filter((pt: any) => !existingProductIds.has(pt.product_id))
    const skipped = belowThreshold.length - toCreate.length

    if (toCreate.length > 0) {
      const rows = toCreate.map((pt: any) => ({
        business_id,
        product_id: pt.product_id,
        requested_quantity: default_requested_quantity,
        trigger_type: pt.products.quantity === 0 ? 'out_of_stock' : 'below_threshold',
        urgency: pt.products.quantity === 0 ? 'high' : 'normal',
        status: 'draft',
        created_by,
      }))

      const { error: insertError } = await supabase
        .from('procurement_requests')
        .insert(rows)

      if (insertError) throw insertError
    }

    return new Response(JSON.stringify({ ok: true, created: toCreate.length, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
