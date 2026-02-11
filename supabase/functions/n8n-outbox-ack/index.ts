import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Validate shared secret
  const secret = req.headers.get("x-n8n-secret");
  const expected = Deno.env.get("N8N_SHARED_SECRET");
  if (!expected || secret !== expected) {
    console.error("[n8n-outbox-ack] Invalid or missing x-n8n-secret", {
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Parse body
  let body: { event_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const eventId = body.event_id;

  // 3. Validate UUID
  if (!eventId || !UUID_REGEX.test(eventId)) {
    console.error("[n8n-outbox-ack] Invalid event_id UUID format:", {
      received: eventId,
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Invalid event_id format" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 4. Mark as processed
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("automation_outbox")
    .update({ processed_at: now })
    .eq("id", eventId)
    .is("processed_at", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[n8n-outbox-ack] DB error:", error.message, {
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!data) {
    return new Response(
      JSON.stringify({ error: "Event not found or already processed" }),
      { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ ok: true, event_id: eventId, processed_at: now }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
