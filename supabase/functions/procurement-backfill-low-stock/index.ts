import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const OPEN_STATUSES = ['draft', 'in_progress', 'waiting_for_quotes', 'quotes_received', 'waiting_for_approval', 'recommended']

interface SupplierPairResult {
  supplier_a_id: string | null;
  supplier_b_id: string | null;
  pair_source: 'product' | 'category' | 'none';
}

function resolveSupplierPair(
  productId: string,
  categoryId: string | null,
  productPairs: Map<string, any>,
  categoryPairs: Map<string, any>,
): SupplierPairResult {
  // 1. Check product-level pair
  const productPair = productPairs.get(productId);
  if (productPair) {
    return {
      supplier_a_id: productPair.supplier_a_id,
      supplier_b_id: productPair.supplier_b_id,
      pair_source: 'product',
    };
  }

  // 2. Fallback to category-level pair
  if (categoryId) {
    const catPair = categoryPairs.get(categoryId);
    if (catPair) {
      return {
        supplier_a_id: catPair.supplier_a_id,
        supplier_b_id: catPair.supplier_b_id,
        pair_source: 'category',
      };
    }
  }

  // 3. No pair found
  return { supplier_a_id: null, supplier_b_id: null, pair_source: 'none' };
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

    // Premium gate check
    const { error: premiumError } = await supabase.rpc('require_premium', { p_business_id: business_id })
    if (premiumError) {
      console.error('[procurement-backfill-low-stock] Premium check failed:', premiumError.message)
      return new Response(JSON.stringify({ error: 'Premium subscription required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const qty = Math.max(1, default_requested_quantity)

    // Get products with thresholds where quantity <= threshold
    // Extended to include product_category_id for category-level pair resolution
    const { data: lowStockProducts, error: productsError } = await supabase
      .from('product_thresholds')
      .select('product_id, low_stock_threshold, products:products!product_thresholds_product_id_fkey(id, name, quantity, product_category_id, category_id)')
      .eq('business_id', business_id)

    if (productsError) throw productsError

    const belowThreshold = (lowStockProducts || []).filter((pt: any) => {
      const product = pt.products
      return product && product.quantity <= pt.low_stock_threshold
    })

    if (belowThreshold.length === 0) {
      console.log('No products below threshold')
      return new Response(JSON.stringify({ ok: true, created: 0, skipped: 0, paired: 0, unpaired: 0 }), {
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

    if (toCreate.length === 0) {
      console.log(`No new requests to create, skipped=${skipped}`)
      return new Response(JSON.stringify({ ok: true, created: 0, skipped, paired: 0, unpaired: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Batch-fetch all active supplier pairs for this business
    const { data: allPairs, error: pairsError } = await supabase
      .from('procurement_supplier_pairs')
      .select('scope, product_id, category_id, supplier_a_id, supplier_b_id')
      .eq('business_id', business_id)
      .eq('is_active', true)

    if (pairsError) {
      console.error('[procurement-backfill-low-stock] Error fetching supplier pairs:', pairsError.message)
      // Non-fatal: continue without pairs
    }

    const productPairs = new Map<string, any>()
    const categoryPairs = new Map<string, any>()
    ;(allPairs || []).forEach((p: any) => {
      if (p.scope === 'product' && p.product_id) {
        productPairs.set(p.product_id, p)
      } else if (p.scope === 'category' && p.category_id) {
        categoryPairs.set(p.category_id, p)
      }
    })

    let paired = 0
    let unpaired = 0

    const rows = toCreate.map((pt: any) => {
      const categoryId = pt.products?.product_category_id ?? pt.products?.category_id ?? null
      const pair = resolveSupplierPair(
        pt.product_id,
        categoryId,
        productPairs,
        categoryPairs,
      )

      if (pair.pair_source !== 'none') {
        paired++
      } else {
        unpaired++
      }

      return {
        business_id,
        product_id: pt.product_id,
        requested_quantity: qty,
        trigger_type: pt.products.quantity === 0 ? 'out_of_stock' : 'below_threshold',
        urgency: pt.products.quantity === 0 ? 'high' : 'normal',
        status: 'draft',
        created_by,
        supplier_a_id: pair.supplier_a_id,
        supplier_b_id: pair.supplier_b_id,
        pair_source: pair.pair_source,
        approval_status: 'pending',
      }
    })

    const { error: insertError } = await supabase
      .from('procurement_requests')
      .insert(rows)

    if (insertError) throw insertError

    console.log(`Backfill complete: created=${toCreate.length}, skipped=${skipped}, paired=${paired}, unpaired=${unpaired}`)

    return new Response(JSON.stringify({ ok: true, created: toCreate.length, skipped, paired, unpaired }), {
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
