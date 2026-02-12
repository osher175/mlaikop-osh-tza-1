import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-n8n-secret",
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SupplierCandidate {
  supplier_id: string;
  source: "preferred" | "category" | "brand";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 1. Validate shared secret
    const secret = req.headers.get("x-n8n-secret");
    const expected = Deno.env.get("N8N_SHARED_SECRET");
    if (!expected || secret !== expected) {
      console.error("[n8n-select-suppliers] Invalid or missing x-n8n-secret", {
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse body
    let body: { business_id?: string; product_id?: string; limit?: number };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { business_id, product_id } = body;

    // 3. Validate required fields
    if (!business_id || !product_id) {
      return new Response(
        JSON.stringify({ error: "Missing business_id or product_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. UUID validation
    if (!UUID_REGEX.test(business_id) || !UUID_REGEX.test(product_id)) {
      console.error("[n8n-select-suppliers] Invalid UUID format:", {
        business_id_valid: UUID_REGEX.test(business_id),
        product_id_valid: UUID_REGEX.test(product_id),
        timestamp: new Date().toISOString(),
      });
      return new Response(
        JSON.stringify({ error: "Invalid business_id or product_id format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Clamp limit
    let limit = body.limit ?? 3;
    if (typeof limit !== "number" || isNaN(limit) || limit < 1) limit = 3;
    if (limit > 5) limit = 5;

    // 6. Init Supabase (service role)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 7. Load product
    const { data: product, error: prodErr } = await supabase
      .from("products")
      .select("id, name, preferred_supplier_id, product_category_id, brand_id")
      .eq("id", product_id)
      .single();

    if (prodErr || !product) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Collect supplier candidates (deduplicated, ordered)
    const seen = new Set<string>();
    const candidates: SupplierCandidate[] = [];

    const addCandidate = (id: string, source: SupplierCandidate["source"]) => {
      if (candidates.length >= limit) return;
      if (seen.has(id)) return;
      seen.add(id);
      candidates.push({ supplier_id: id, source });
    };

    // Source 1: preferred
    if (product.preferred_supplier_id) {
      addCandidate(product.preferred_supplier_id, "preferred");
    }

    // Source 2: category
    if (candidates.length < limit && product.product_category_id) {
      const { data: catRows } = await supabase
        .from("category_supplier_preferences")
        .select("supplier_id")
        .eq("business_id", business_id)
        .eq("category_id", product.product_category_id)
        .order("priority", { ascending: true })
        .limit(limit);

      if (catRows) {
        for (const row of catRows) {
          addCandidate(row.supplier_id, "category");
        }
      }
    }

    // Source 3: brand (tier A > B > C, then priority)
    if (candidates.length < limit && product.brand_id) {
      for (const tier of ["A", "B", "C"]) {
        if (candidates.length >= limit) break;

        const { data: brandRows } = await supabase
          .from("supplier_brands")
          .select("supplier_id, brands!inner(tier)")
          .eq("business_id", business_id)
          .eq("brand_id", product.brand_id)
          .eq("is_active", true)
          .eq("brands.tier", tier)
          .order("priority", { ascending: true })
          .limit(limit);

        if (brandRows) {
          for (const row of brandRows) {
            addCandidate(row.supplier_id, "brand");
          }
        }
      }
    }

    // 9. Batch-fetch supplier details
    if (candidates.length === 0) {
      return new Response(
        JSON.stringify({ suppliers: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supplierIds = candidates.map((c) => c.supplier_id);
    const { data: supplierRows, error: supErr } = await supabase
      .from("suppliers")
      .select("id, name, phone")
      .in("id", supplierIds);

    if (supErr) {
      console.error("[n8n-select-suppliers] Failed to fetch suppliers:", supErr.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch supplier details" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supplierMap = new Map(
      (supplierRows || []).map((s: { id: string; name: string; phone: string | null }) => [s.id, s])
    );

    // 10. Build response
    const suppliers = candidates.map((c, idx) => {
      const info = supplierMap.get(c.supplier_id);
      return {
        supplier_id: c.supplier_id,
        supplier_name: info?.name ?? null,
        phone: info?.phone ?? null,
        source: c.source,
        priority: idx + 1,
      };
    });

    return new Response(
      JSON.stringify({ suppliers }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[n8n-select-suppliers] Unexpected error:", String(err));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
