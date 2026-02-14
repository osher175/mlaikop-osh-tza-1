import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    // User-context client for auth + premium check
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    // Service client for upsert
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { business_id, waba_id, phone_number_id, phone_number } = await req.json()

    if (!business_id || !waba_id || !phone_number_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: business_id, waba_id, phone_number_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!UUID_REGEX.test(business_id)) {
      return new Response(JSON.stringify({ error: 'Invalid business_id format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify user owns this business
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: biz, error: bizError } = await serviceClient
      .from('businesses')
      .select('owner_id')
      .eq('id', business_id)
      .single()

    if (bizError || !biz || biz.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Not authorized for this business' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Premium gate
    const { error: premiumError } = await userClient.rpc('require_premium', { p_business_id: business_id })
    if (premiumError) {
      return new Response(JSON.stringify({ error: 'Premium subscription required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Upsert business channel
    const { data: channel, error: channelError } = await serviceClient
      .from('business_channels')
      .upsert(
        {
          business_id,
          provider: 'meta',
          waba_id,
          phone_number_id,
          phone_number: phone_number || null,
          status: 'connected',
          last_error: null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'phone_number_id' }
      )
      .select('id, status')
      .single()

    if (channelError) {
      console.error('[meta-embedded-signup-complete] Upsert error:', channelError)
      return new Response(JSON.stringify({ error: channelError.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('[meta-embedded-signup-complete] Channel connected:', { business_id, phone_number_id })

    return new Response(JSON.stringify({ ok: true, channel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[meta-embedded-signup-complete] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
