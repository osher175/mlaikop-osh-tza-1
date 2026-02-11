import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // 1. Validate shared secret
  const secret = req.headers.get("x-n8n-secret");
  const expected = Deno.env.get("N8N_SHARED_SECRET");
  if (!expected || secret !== expected) {
    console.error("[n8n-outbox-pull] Invalid or missing x-n8n-secret", {
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Parse limit
  const url = new URL(req.url);
  let limit = parseInt(url.searchParams.get("limit") || "10", 10);
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 50) limit = 50;

  // 3. Query unprocessed events
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("automation_outbox")
    .select("id, event_type, business_id, product_id, payload, created_at")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("[n8n-outbox-pull] DB error:", error.message, {
      timestamp: new Date().toISOString(),
    });
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ events: data || [] }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
