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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const metaAccessToken = Deno.env.get('META_WHATSAPP_ACCESS_TOKEN')

    if (!metaAccessToken) {
      console.error('[meta-send-message] META_WHATSAPP_ACCESS_TOKEN not configured')
      return new Response(JSON.stringify({ error: 'WhatsApp not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    const { business_id, to, message_text, conversation_id } = await req.json()

    if (!business_id || !to || !message_text) {
      return new Response(JSON.stringify({ error: 'Missing required fields: business_id, to, message_text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!UUID_REGEX.test(business_id)) {
      return new Response(JSON.stringify({ error: 'Invalid business_id format' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Premium gate
    const { error: premiumError } = await userClient.rpc('require_premium', { p_business_id: business_id })
    if (premiumError) {
      return new Response(JSON.stringify({ error: 'Premium subscription required' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get connected channel for this business
    const { data: channel, error: channelError } = await serviceClient
      .from('business_channels')
      .select('phone_number_id')
      .eq('business_id', business_id)
      .eq('status', 'connected')
      .limit(1)
      .single()

    if (channelError || !channel) {
      return new Response(JSON.stringify({ error: 'No connected WhatsApp channel found for this business' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Send via Meta Graph API
    const graphUrl = `https://graph.facebook.com/v18.0/${channel.phone_number_id}/messages`
    const graphResponse = await fetch(graphUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message_text },
      }),
    })

    const graphData = await graphResponse.json()

    if (!graphResponse.ok) {
      console.error('[meta-send-message] Meta API error:', graphData)
      // Update channel status to error
      await serviceClient
        .from('business_channels')
        .update({ status: 'error', last_error: JSON.stringify(graphData), updated_at: new Date().toISOString() })
        .eq('business_id', business_id)
        .eq('phone_number_id', channel.phone_number_id)

      return new Response(JSON.stringify({ error: 'Failed to send message', details: graphData }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const providerMessageId = graphData?.messages?.[0]?.id || null

    // Save to procurement_messages if conversation_id provided
    if (conversation_id && UUID_REGEX.test(conversation_id)) {
      const { error: msgError } = await serviceClient
        .from('procurement_messages')
        .insert({
          conversation_id,
          direction: 'outgoing',
          message_text,
          status: 'sent',
          provider_message_id: providerMessageId,
        })

      if (msgError) {
        console.error('[meta-send-message] Error saving message:', msgError)
      }

      // Update conversation last_outgoing_at
      await serviceClient
        .from('procurement_conversations')
        .update({ last_outgoing_at: new Date().toISOString() })
        .eq('id', conversation_id)
    }

    console.log('[meta-send-message] Message sent:', { business_id, to, providerMessageId })

    return new Response(JSON.stringify({
      ok: true,
      provider_message_id: providerMessageId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[meta-send-message] Error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
