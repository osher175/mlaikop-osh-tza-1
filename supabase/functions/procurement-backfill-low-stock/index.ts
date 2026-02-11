import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OPEN_STATUSES = ['draft', 'in_progress', 'waiting_for_quotes', 'quotes_received', 'waiting_for_approval', 'recommended']

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { business_id, created_by, default_requested_quantity = 1 } = await req.json()

    if (!business_id || !created_by) {
      return new Response(JSON.stringify({ error: 'business_id and created_by are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Validate business_id is a proper UUID
    if (!UUID_REGEX.test(business_id)) {
      console.error('[procurement-backfill-low-stock] Invalid business_id UUID format:', {
        received: business_id,
        timestamp: new Date().toISOString(),
      })
      return new Response(JSON.stringify({ error: 'Invalid business_id format - must be a valid UUID' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const qty = Math.max(1, default_requested_quantity)

    // Get products with thresholds where quantity <= threshold
    const { data: lowStockProducts, error: productsError } = await supabase
      .from('product_thresholds')
      .select('product_id, low_stock_threshold, products:products!product_thresholds_product_id_fkey(id, name, quantity)')
      .eq('business_id', business_id)

    if (productsError) throw productsError

    const belowThreshold = (lowStockProducts || []).filter((pt: any) => {
      const product = pt.products
      return product && product.quantity <= pt.low_stock_threshold
    })

    if (belowThreshold.length === 0) {
      console.log('No products below threshold')
      return new Response(JSON.stringify({ ok: true, created: 0, skipped: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get existing open requests for these products (batch to avoid URL length limits)
    const productIds = belowThreshold.map((pt: any) => pt.product_id)
    const BATCH_SIZE = 40
    const existingProductIds = new Set<string>()

    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      const batch = productIds.slice(i, i + BATCH_SIZE)
      const { data: batchRequests, error: reqError } = await supabase
        .from('procurement_requests')
        .select('product_id')
        .eq('business_id', business_id)
        .in('status', OPEN_STATUSES)
        .in('product_id', batch)

      if (reqError) throw reqError
      ;(batchRequests || []).forEach((r: any) => existingProductIds.add(r.product_id))
    }

    const toCreate = belowThreshold.filter((pt: any) => !existingProductIds.has(pt.product_id))
    const skipped = belowThreshold.length - toCreate.length

    if (toCreate.length > 0) {
      const rows = toCreate.map((pt: any) => ({
        business_id,
        product_id: pt.product_id,
        requested_quantity: qty,
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

    console.log(`Backfill complete: created=${toCreate.length}, skipped=${skipped}`)

    return new Response(JSON.stringify({ ok: true, created: toCreate.length, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Backfill error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
