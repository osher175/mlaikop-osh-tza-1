import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Validate Meta webhook signature using X-Hub-Signature-256
 */
async function validateSignature(body: string, signature: string | null, appSecret: string): Promise<boolean> {
  if (!signature) return false

  const expectedPrefix = 'sha256='
  if (!signature.startsWith(expectedPrefix)) return false

  const expectedHash = signature.slice(expectedPrefix.length)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  const hashArray = Array.from(new Uint8Array(signed))
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return computedHash === expectedHash
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 60 // per minute per phone_number_id
const RATE_WINDOW_MS = 60_000

function checkRateLimit(phoneNumberId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(phoneNumberId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(phoneNumberId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return true
  }

  if (entry.count >= RATE_LIMIT) return false
  entry.count++
  return true
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // ===== GET: Webhook Verification Handshake =====
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode')
    const token = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge')

    if (mode !== 'subscribe' || !token || !challenge) {
      return new Response('Bad request', { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Look up channel by verify token
    const { data: channel, error } = await serviceClient
      .from('business_channels')
      .select('id')
      .eq('webhook_verify_token', token)
      .limit(1)
      .single()

    if (error || !channel) {
      console.error('[meta-whatsapp-webhook] Invalid verify token')
      return new Response('Forbidden', { status: 403 })
    }

    console.log('[meta-whatsapp-webhook] Verification successful for channel:', channel.id)
    return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // ===== POST: Incoming Events =====
  if (req.method === 'POST') {
    const rawBody = await req.text()

    // Validate signature
    const appSecret = Deno.env.get('META_APP_SECRET')
    if (appSecret) {
      const signature = req.headers.get('X-Hub-Signature-256')
      const valid = await validateSignature(rawBody, signature, appSecret)
      if (!valid) {
        console.error('[meta-whatsapp-webhook] Invalid signature')
        return new Response('Invalid signature', { status: 403 })
      }
    }

    let payload: any
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return new Response('Invalid JSON', { status: 400 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Process entries
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value
        if (!value) continue

        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        // Rate limit check
        if (!checkRateLimit(phoneNumberId)) {
          console.warn('[meta-whatsapp-webhook] Rate limited:', phoneNumberId)
          continue
        }

        // Look up business channel
        const { data: channel, error: channelErr } = await serviceClient
          .from('business_channels')
          .select('id, business_id')
          .eq('phone_number_id', phoneNumberId)
          .limit(1)
          .single()

        if (channelErr || !channel) {
          console.warn('[meta-whatsapp-webhook] Unknown phone_number_id:', phoneNumberId)
          continue
        }

        // Handle incoming messages
        if (value.messages) {
          for (const msg of value.messages) {
            const senderPhone = msg.from
            const messageText = msg.text?.body || msg.caption || '[non-text message]'

            // Find active conversation for this sender + business
            const { data: conv } = await serviceClient
              .from('procurement_conversations')
              .select('id')
              .eq('business_id', channel.business_id)
              .eq('status', 'active')
              .limit(1)
              .maybeSingle()

            if (conv) {
              const { error: insertErr } = await serviceClient
                .from('procurement_messages')
                .insert({
                  conversation_id: conv.id,
                  direction: 'incoming',
                  message_text: messageText,
                  status: 'received',
                  provider_message_id: msg.id || null,
                })

              if (insertErr) {
                console.error('[meta-whatsapp-webhook] Error inserting message:', insertErr)
              } else {
                // Update last_incoming_at
                await serviceClient
                  .from('procurement_conversations')
                  .update({ last_incoming_at: new Date().toISOString() })
                  .eq('id', conv.id)
              }
            } else {
              console.log('[meta-whatsapp-webhook] No active conversation for incoming message from:', senderPhone, 'business:', channel.business_id)
            }
          }
        }

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            if (status.id) {
              const newStatus = status.status // sent, delivered, read, failed
              await serviceClient
                .from('procurement_messages')
                .update({ status: newStatus })
                .eq('provider_message_id', status.id)
            }
          }
        }
      }
    }

    // Always return 200 to Meta
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response('Method not allowed', { status: 405 })
})
