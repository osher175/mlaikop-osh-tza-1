// Mlaiko Public Data API — READ-ONLY
// Authentication: x-mlaiko-api-key header
// All endpoints scoped strictly by business_id.
// Timezone: Asia/Jerusalem. Currency: ILS. VAT: 18%.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-mlaiko-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// In-memory rate limit: 60 req/min per api_key_id.
const rateBuckets = new Map<string, { count: number; reset: number }>();
function checkRate(keyId: string): boolean {
  const now = Date.now();
  const b = rateBuckets.get(keyId);
  if (!b || b.reset < now) {
    rateBuckets.set(keyId, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (b.count >= 60) return false;
  b.count++;
  return true;
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "100", 10) || 100;
  const limit = Math.min(500, Math.max(1, limitRaw));
  return { page, limit, from: (page - 1) * limit, to: page * limit - 1 };
}

function parseDateRange(url: URL): { from: string; to: string } {
  const to = url.searchParams.get("to") ?? new Date().toISOString();
  const fromParam = url.searchParams.get("from");
  const from = fromParam ??
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return { from, to };
}

async function logUsage(
  apiKeyId: string,
  businessId: string,
  endpoint: string,
  status: number,
  ip: string | null,
  ua: string | null,
) {
  try {
    await admin.from("api_key_usage_log").insert({
      api_key_id: apiKeyId,
      business_id: businessId,
      endpoint,
      method: "GET",
      status_code: status,
      ip,
      user_agent: ua,
    });
  } catch (_) { /* swallow */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  // Strip function prefix
  const path = url.pathname.replace(/^.*\/public-api/, "") || "/";

  const apiKey = req.headers.get("x-mlaiko-api-key");
  if (!apiKey) return json({ error: "Missing x-mlaiko-api-key header" }, 401);

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyErr } = await admin
    .from("api_keys")
    .select("id, business_id, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !keyRow) return json({ error: "Invalid API key" }, 401);
  if (keyRow.revoked_at) return json({ error: "API key has been revoked" }, 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return json({ error: "API key has expired" }, 401);
  }

  if (!checkRate(keyRow.id)) {
    await logUsage(keyRow.id, keyRow.business_id, path, 429,
      req.headers.get("x-forwarded-for"), req.headers.get("user-agent"));
    return json({ error: "Rate limit exceeded: 60 requests per minute" }, 429);
  }

  const bid = keyRow.business_id;
  let status = 200;
  let body: unknown = null;

  try {
    // ---------- ROUTING ----------
    const m = path.match(/^\/products\/([0-9a-f-]{36})\/?$/i);
    if (m) {
      const { data, error } = await admin
        .from("products")
        .select("*")
        .eq("business_id", bid)
        .eq("id", m[1])
        .maybeSingle();
      if (error) throw error;
      if (!data) { status = 404; body = { error: "Not found" }; }
      else body = { data };
    } else if (path === "/products" || path === "/products/") {
      const { page, limit, from, to } = parsePagination(url);
      const { data, count, error } = await admin
        .from("products")
        .select("*", { count: "exact" })
        .eq("business_id", bid)
        .order("name", { ascending: true })
        .range(from, to);
      if (error) throw error;
      body = { data, page, limit, total: count };
    } else if (path === "/inventory-actions") {
      const { page, limit, from, to } = parsePagination(url);
      const range = parseDateRange(url);
      const { data, count, error } = await admin
        .from("inventory_actions")
        .select("*", { count: "exact" })
        .eq("business_id", bid)
        .gte("timestamp", range.from)
        .lte("timestamp", range.to)
        .order("timestamp", { ascending: false })
        .range(from, to);
      if (error) throw error;
      body = { data, page, limit, total: count, from: range.from, to: range.to };
    } else if (path === "/suppliers") {
      const { page, limit, from, to } = parsePagination(url);
      const { data, count, error } = await admin
        .from("suppliers")
        .select("*", { count: "exact" })
        .eq("business_id", bid)
        .order("name")
        .range(from, to);
      if (error) throw error;
      body = { data, page, limit, total: count };
    } else if (path === "/categories") {
      const { page, limit, from, to } = parsePagination(url);
      // product_categories has no business_id. Each business is mapped to a
      // global industry type via businesses.business_category_id, and
      // product_categories are scoped through that:
      //   businesses.business_category_id -> product_categories.business_category_id
      const { data: biz, error: bizErr } = await admin
        .from("businesses")
        .select("business_category_id")
        .eq("id", bid)
        .maybeSingle();
      if (bizErr) throw bizErr;
      const bcid = biz?.business_category_id ?? null;
      if (!bcid) {
        body = { data: [], page, limit, total: 0 };
      } else {
        const { data, count, error } = await admin
          .from("product_categories")
          .select("*", { count: "exact" })
          .eq("business_category_id", bcid)
          .order("name")
          .range(from, to);
        if (error) throw error;
        body = { data, page, limit, total: count };
      }
    } else if (path === "/sales") {
      const { page, limit, from, to } = parsePagination(url);
      const range = parseDateRange(url);
      const { data, count, error } = await admin
        .from("inventory_actions")
        .select("*", { count: "exact" })
        .eq("business_id", bid)
        .in("action_type", ["remove", "sale"])
        .gte("timestamp", range.from)
        .lte("timestamp", range.to)
        .order("timestamp", { ascending: false })
        .range(from, to);
      if (error) throw error;
      body = {
        data, page, limit, total: count, from: range.from, to: range.to,
        currency: "ILS", vat_percent: 18,
      };
    } else if (path === "/reports/summary") {
      const range = parseDateRange(url);
      const { data, error } = await admin.rpc("reports_aggregate", {
        business_id: bid,
        date_from: range.from,
        date_to: range.to,
      });
      if (error) throw error;
      body = {
        data, from: range.from, to: range.to,
        currency: "ILS", vat_percent: 18, timezone: "Asia/Jerusalem",
      };
    } else if (path === "/stock-alerts") {
      const { page, limit, from, to } = parsePagination(url);
      const { data, count, error } = await admin
        .from("stock_alerts")
        .select("*", { count: "exact" })
        .eq("business_id", bid)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      body = { data, page, limit, total: count };
    } else if (path === "/low-stock") {
      const { page, limit, from, to } = parsePagination(url);
      // Products with quantity <= threshold (per-product override or default 5)
      const { data: products, error: pErr } = await admin
        .from("products")
        .select("id, name, quantity, cost, price, supplier_id, product_category_id, business_id")
        .eq("business_id", bid)
        .order("quantity", { ascending: true })
        .range(from, to);
      if (pErr) throw pErr;

      const { data: thresholds } = await admin
        .from("product_thresholds")
        .select("product_id, low_stock_threshold")
        .eq("business_id", bid);

      const { data: settings } = await admin
        .from("notification_settings")
        .select("low_stock_threshold")
        .eq("business_id", bid)
        .maybeSingle();

      const defaultThreshold = settings?.low_stock_threshold ?? 5;
      const tMap = new Map((thresholds ?? []).map((t: any) => [t.product_id, t.low_stock_threshold]));
      const lowStock = (products ?? []).filter((p: any) => {
        const t = tMap.get(p.id) ?? defaultThreshold;
        return p.quantity <= t;
      }).map((p: any) => ({
        ...p,
        threshold: tMap.get(p.id) ?? defaultThreshold,
      }));

      body = { data: lowStock, page, limit };
    } else if (path === "/" || path === "") {
      body = {
        name: "Mlaiko Public Data API",
        version: "1.0.0",
        read_only: true,
        currency: "ILS",
        vat_percent: 18,
        timezone: "Asia/Jerusalem",
        endpoints: [
          "GET /products?page&limit",
          "GET /products/:id",
          "GET /inventory-actions?from&to&page&limit",
          "GET /suppliers?page&limit",
          "GET /categories?page&limit",
          "GET /sales?from&to&page&limit",
          "GET /reports/summary?from&to",
          "GET /stock-alerts?page&limit",
          "GET /low-stock?page&limit",
        ],
      };
    } else {
      status = 404;
      body = { error: "Unknown endpoint", path };
    }
  } catch (e) {
    console.error("public-api error", e);
    status = 500;
    body = { error: "Internal error", details: String(e?.message ?? e) };
  }

  // Update last_used_at (fire-and-forget) + log
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id).then(() => {});
  await logUsage(keyRow.id, bid, path, status,
    req.headers.get("x-forwarded-for"), req.headers.get("user-agent"));

  return json(body, status);
});
