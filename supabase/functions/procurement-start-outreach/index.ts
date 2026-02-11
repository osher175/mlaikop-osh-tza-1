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

    const { business_id, procurement_request_id } = await req.json()
    if (!business_id || !procurement_request_id) {
      return new Response(JSON.stringify({ error: 'Missing business_id or procurement_request_id' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load procurement request with product & business info
    const { data: procReq, error: prErr } = await supabase
      .from('procurement_requests')
      .select('id, product_id, requested_quantity, products(name), businesses(name)')
      .eq('id', procurement_request_id)
      .single()

    if (prErr || !procReq) {
      return new Response(JSON.stringify({ error: 'Procurement request not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Load business details
    const { data: business, error: busErr } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', business_id)
      .single()

    if (busErr || !business) {
      return new Response(JSON.stringify({ error: 'Business not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Call select-suppliers logic inline
    const selectRes = await fetch(
      `${supabaseUrl}/functions/v1/procurement-select-suppliers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({ business_id, product_id: procReq.product_id }),
      }
    )
    const supplierSelection = await selectRes.json()

    const supplierIds: string[] = []
    if (supplierSelection.primary_supplier_id) supplierIds.push(supplierSelection.primary_supplier_id)
    if (supplierSelection.compare_supplier_id) supplierIds.push(supplierSelection.compare_supplier_id)

    let conversationsCreated = 0
    let messagesQueued = 0
    let alreadyActive = 0

    const productName = (procReq as any).products?.name || 'מוצר'
    const quantity = procReq.requested_quantity
    const businessName = business.name

    // Load supplier details for message personalization
    const { data: suppliers, error: suppErr } = await supabase
      .from('suppliers')
      .select('id, name, agent_name')
      .in('id', supplierIds)

    if (suppErr) {
      console.error('Error fetching suppliers:', suppErr)
    }

    const supplierMap = new Map((suppliers || []).map(s => [s.id, s]))

    for (const supplierId of supplierIds) {
      // Try to insert conversation (unique constraint will prevent duplicates)
      const { data: conv, error: convErr } = await supabase
        .from('procurement_conversations')
        .insert({
          business_id,
          procurement_request_id,
          product_id: procReq.product_id,
          supplier_id: supplierId,
          status: 'active',
          mode: 'bot',
        })
        .select('id, mode')
        .single()

      if (convErr) {
        // Unique constraint violation = already active
        if (convErr.code === '23505') {
          alreadyActive++
          continue
        }
        console.error('Error creating conversation:', convErr)
        continue
      }

      conversationsCreated++

      // If mode is bot, create queued message
      if (conv.mode === 'bot') {
        const supplier = supplierMap.get(supplierId)
        const supplierName = supplier?.agent_name || supplier?.name || 'בן שיח ספק'

        const messageText = `שלום ${supplierName},
מדבר ${businessName}.
אשמח לקבל הצעת מחיר ל:
${productName}
כמות: ${quantity}

נא לציין:
• מחיר ליחידה
• זמינות במלאי
• זמן אספקה

תודה 🙏`

        const { error: msgErr } = await supabase
          .from('procurement_messages')
          .insert({
            conversation_id: conv.id,
            direction: 'outgoing',
            message_text: messageText,
            status: 'queued',
          })

        if (!msgErr) {
          messagesQueued++
          // Update last_outgoing_at
          await supabase
            .from('procurement_conversations')
            .update({ last_outgoing_at: new Date().toISOString() })
            .eq('id', conv.id)
        }
      }
    }

    // Update procurement request status
    await supabase
      .from('procurement_requests')
      .update({ status: 'waiting_for_quotes', updated_at: new Date().toISOString() })
      .eq('id', procurement_request_id)

    return new Response(
      JSON.stringify({
        conversations_created: conversationsCreated,
        messages_queued: messagesQueued,
        already_active: alreadyActive,
        supplier_selection: supplierSelection,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
