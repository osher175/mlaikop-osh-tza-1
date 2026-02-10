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
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { business_id, product_id } = await req.json()
    if (!business_id || !product_id) {
      return new Response(JSON.stringify({ error: 'Missing business_id or product_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load product
    const { data: product, error: prodErr } = await supabase
      .from('products')
      .select('id, name, brand_id, preferred_supplier_id, product_category_id')
      .eq('id', product_id)
      .single()

    if (prodErr || !product) {
      return new Response(JSON.stringify({ error: 'Product not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let primarySupplierId: string | null = null
    const rationale: string[] = []

    // Step 1: preferred_supplier_id
    if (product.preferred_supplier_id) {
      primarySupplierId = product.preferred_supplier_id
      rationale.push('ספק ראשי נבחר מהעדפת מוצר (preferred_supplier_id)')
    }

    // Step 2: category_supplier_preferences
    if (!primarySupplierId && product.product_category_id) {
      const { data: catPref } = await supabase
        .from('category_supplier_preferences')
        .select('supplier_id')
        .eq('business_id', business_id)
        .eq('category_id', product.product_category_id)
        .order('priority', { ascending: true })
        .limit(1)

      if (catPref && catPref.length > 0) {
        primarySupplierId = catPref[0].supplier_id
        rationale.push('ספק ראשי נבחר מהעדפת קטגוריה')
      }
    }

    // Step 3: supplier_brands
    if (!primarySupplierId && product.brand_id) {
      const { data: sbPref } = await supabase
        .from('supplier_brands')
        .select('supplier_id')
        .eq('business_id', business_id)
        .eq('brand_id', product.brand_id)
        .eq('is_active', true)
        .order('priority', { ascending: true })
        .limit(1)

      if (sbPref && sbPref.length > 0) {
        primarySupplierId = sbPref[0].supplier_id
        rationale.push('ספק ראשי נבחר מספקי מותג')
      }
    }

    if (!primarySupplierId) {
      rationale.push('לא נמצא ספק ראשי')
    }

    // Compare supplier: different from primary, sells a brand in same category, prefer tier A > B > C
    let compareSupplierId: string | null = null

    if (product.product_category_id) {
      // Find brands in same category via products that share the category
      // Then find suppliers for those brands, ordered by tier
      for (const tier of ['A', 'B', 'C']) {
        const { data: compareCandidates } = await supabase
          .from('supplier_brands')
          .select('supplier_id, brands!inner(tier)')
          .eq('business_id', business_id)
          .eq('is_active', true)
          .eq('brands.tier', tier)
          .order('priority', { ascending: true })
          .limit(10)

        if (compareCandidates && compareCandidates.length > 0) {
          const candidate = compareCandidates.find(
            (c: any) => c.supplier_id !== primarySupplierId
          )
          if (candidate) {
            compareSupplierId = candidate.supplier_id
            rationale.push(`ספק השוואה נבחר (tier ${tier})`)
            break
          }
        }
      }
    }

    if (!compareSupplierId) {
      rationale.push('לא נמצא ספק להשוואה')
    }

    return new Response(
      JSON.stringify({
        primary_supplier_id: primarySupplierId,
        compare_supplier_id: compareSupplierId,
        rationale: rationale.join('; '),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
