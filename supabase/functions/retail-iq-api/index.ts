// Mlaiko Retail IQ Export API — READ-ONLY
// Authentication: x-mlaiko-api-key header (scope='retail_iq')
// All endpoints strictly scoped by business_id derived from the key.
// Timezone: Asia/Jerusalem. Currency: ILS. VAT: 18%.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-mlaiko-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------- helpers ----------
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

function parseDateRange(url: URL): { from: string | null; to: string | null } {
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  return { from, to };
}

function updatedSince(url: URL): string | null {
  return url.searchParams.get("updated_since");
}

// per-key rate limit — DB-backed so it survives across edge isolates
async function checkRate(apiKeyId: string, perMinute: number): Promise<boolean> {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await admin
    .from("api_key_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("api_key_id", apiKeyId)
    .gte("created_at", since);
  if (error) return true; // fail-open on logging errors
  return (count ?? 0) < perMinute;
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

const err = (msg: string, code: string, status: number) =>
  json({ error: msg, code }, status);

// ---------- main ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return err("Method not allowed", "method_not_allowed", 405);

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/retail-iq-api/, "") || "/";

  const apiKey = req.headers.get("x-mlaiko-api-key");
  if (!apiKey) return err("Missing x-mlaiko-api-key header", "unauthorized", 401);

  const keyHash = await sha256Hex(apiKey);
  const { data: keyRow, error: keyErr } = await admin
    .from("api_keys")
    .select("id, business_id, revoked_at, expires_at, scope, rate_limit_per_min")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (keyErr || !keyRow) return err("Invalid API key", "unauthorized", 401);
  if (keyRow.revoked_at) return err("API key has been revoked", "unauthorized", 401);
  if (keyRow.expires_at && new Date(keyRow.expires_at) < new Date()) {
    return err("API key has expired", "unauthorized", 401);
  }
  if (keyRow.scope !== "retail_iq") {
    return err("API key scope mismatch (retail_iq required)", "scope_mismatch", 401);
  }

  const perMin = keyRow.rate_limit_per_min ?? 60;
  if (!checkRate(keyRow.id, perMin)) {
    await logUsage(keyRow.id, keyRow.business_id, path, 429,
      req.headers.get("x-forwarded-for"), req.headers.get("user-agent"));
    return err(`Rate limit exceeded: ${perMin} requests per minute`, "rate_limited", 429);
  }

  const bid = keyRow.business_id;
  let status = 200;
  let body: unknown = null;
  let extraHeaders: Record<string, string> = {};

  try {
    if (path === "/" || path === "") {
      body = {
        name: "Mlaiko Retail IQ Export API",
        version: "1.0.0",
        consumer: "Retail IQ",
        read_only: true,
        currency: "ILS",
        vat_percent: 18,
        timezone: "Asia/Jerusalem",
        auth: "Header: x-mlaiko-api-key (scope=retail_iq)",
        endpoints: [
          "GET /branches",
          "GET /products?updated_since&page&limit",
          "GET /inventory?updated_since&page&limit",
          "GET /customers",
          "GET /employees?page&limit",
          "GET /sales?updated_since&from&to&page&limit",
          "GET /sale_items?updated_since&from&to&page&limit",
        ],
      };
    } else if (path === "/branches") {
      const { data, error } = await admin
        .from("businesses")
        .select("id, name, phone, address, created_at, updated_at")
        .eq("id", bid);
      if (error) throw error;
      body = {
        data: (data ?? []).map((b: any) => ({
          id: b.id,
          name: b.name,
          phone: b.phone ?? null,
          address: b.address ?? null,
          timezone: "Asia/Jerusalem",
          currency: "ILS",
          created_at: b.created_at,
          updated_at: b.updated_at,
        })),
        total: data?.length ?? 0,
      };
    } else if (path === "/products") {
      const { page, limit, from, to } = parsePagination(url);
      const since = updatedSince(url);
      let q = admin
        .from("products")
        .select(
          "id, name, barcode, cost, price, quantity, created_at, updated_at, product_category_id, brand_id, supplier_id, product_categories:product_category_id(id,name), brands:brand_id(id,name), suppliers:supplier_id(id,name)",
          { count: "exact" },
        )
        .eq("business_id", bid)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (since) q = q.gte("updated_at", since);
      const { data, count, error } = await q;
      if (error) throw error;
      body = {
        data: (data ?? []).map((p: any) => ({
          id: p.id,
          sku: p.barcode ?? null,
          barcode: p.barcode ?? null,
          name: p.name,
          category: p.product_categories
            ? { id: p.product_categories.id, name: p.product_categories.name }
            : null,
          brand: p.brands ? { id: p.brands.id, name: p.brands.name } : null,
          supplier: p.suppliers ? { id: p.suppliers.id, name: p.suppliers.name } : null,
          cost_ils: Number(p.cost ?? 0),
          price_ils: Number(p.price ?? 0),
          currency: "ILS",
          vat_percent: 18,
          created_at: p.created_at,
          updated_at: p.updated_at,
        })),
        page, limit, total: count ?? 0,
      };
      extraHeaders = { "X-Total-Count": String(count ?? 0), "X-Page": String(page), "X-Limit": String(limit) };
    } else if (path === "/inventory") {
      const { page, limit, from, to } = parsePagination(url);
      const since = updatedSince(url);
      let q = admin
        .from("products")
        .select("id, name, quantity, updated_at, business_id", { count: "exact" })
        .eq("business_id", bid)
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (since) q = q.gte("updated_at", since);
      const { data, count, error } = await q;
      if (error) throw error;

      const productIds = (data ?? []).map((p: any) => p.id);
      const thresholds = new Map<string, number>();
      if (productIds.length) {
        // Batch in chunks of 40 (URL length safety).
        for (let i = 0; i < productIds.length; i += 40) {
          const chunk = productIds.slice(i, i + 40);
          const { data: t } = await admin
            .from("product_thresholds")
            .select("product_id, low_stock_threshold")
            .eq("business_id", bid)
            .in("product_id", chunk);
          (t ?? []).forEach((r: any) => thresholds.set(r.product_id, r.low_stock_threshold));
        }
      }
      const { data: ns } = await admin
        .from("notification_settings")
        .select("low_stock_threshold")
        .eq("business_id", bid)
        .maybeSingle();
      const defaultThreshold = ns?.low_stock_threshold ?? 5;

      body = {
        data: (data ?? []).map((p: any) => ({
          product_id: p.id,
          product_name: p.name,
          branch_id: bid,
          quantity: p.quantity,
          low_stock_threshold: thresholds.get(p.id) ?? defaultThreshold,
          as_of: p.updated_at,
        })),
        page, limit, total: count ?? 0,
      };
      extraHeaders = { "X-Total-Count": String(count ?? 0), "X-Page": String(page), "X-Limit": String(limit) };
    } else if (path === "/customers") {
      body = {
        data: [],
        total: 0,
        supported: false,
        note: "Mlaiko does not currently model end customers. Endpoint reserved for future use.",
      };
    } else if (path === "/employees") {
      const { page, limit, from, to } = parsePagination(url);
      const { data: ubs, error: ubErr, count } = await admin
        .from("user_businesses")
        .select("user_id, role, business_id", { count: "exact" })
        .eq("business_id", bid)
        .range(from, to);
      if (ubErr) throw ubErr;

      const userIds = (ubs ?? []).map((u: any) => u.user_id);
      const profiles = new Map<string, any>();
      const emails = new Map<string, string>();
      if (userIds.length) {
        for (let i = 0; i < userIds.length; i += 40) {
          const chunk = userIds.slice(i, i + 40);
          const { data: pr } = await admin
            .from("profiles")
            .select("id, first_name, last_name, is_active, created_at")
            .in("id", chunk);
          (pr ?? []).forEach((p: any) => profiles.set(p.id, p));
          const { data: em } = await admin
            .from("emails")
            .select("user_id, email")
            .in("user_id", chunk);
          (em ?? []).forEach((e: any) => emails.set(e.user_id, e.email));
        }
      }

      body = {
        data: (ubs ?? []).map((u: any) => {
          const p = profiles.get(u.user_id);
          return {
            id: u.user_id,
            branch_id: bid,
            email: emails.get(u.user_id) ?? null,
            first_name: p?.first_name ?? null,
            last_name: p?.last_name ?? null,
            role: u.role,
            is_active: p?.is_active ?? null,
            created_at: p?.created_at ?? null,
          };
        }),
        page, limit, total: count ?? 0,
      };
      extraHeaders = { "X-Total-Count": String(count ?? 0), "X-Page": String(page), "X-Limit": String(limit) };
    } else if (path === "/sales" || path === "/sale_items") {
      const { page, limit, from, to } = parsePagination(url);
      const since = updatedSince(url);
      const range = parseDateRange(url);

      let q = admin
        .from("inventory_actions")
        .select(
          "id, business_id, product_id, user_id, quantity_changed, sale_total_ils, sale_unit_ils, list_unit_ils, discount_ils, discount_percent, cost_snapshot_ils, currency, timestamp, notes",
          { count: "exact" },
        )
        .eq("business_id", bid)
        .in("action_type", ["remove", "sale"])
        .order("timestamp", { ascending: false })
        .range(from, to);

      if (since) q = q.gte("timestamp", since);
      if (range.from) q = q.gte("timestamp", range.from);
      if (range.to) q = q.lte("timestamp", range.to);

      const { data, count, error } = await q;
      if (error) throw error;

      const rows = (data ?? []).map((r: any) => {
        const qty = Math.abs(Number(r.quantity_changed ?? 0));
        const unit = r.sale_unit_ils != null
          ? Number(r.sale_unit_ils)
          : (qty > 0 && r.sale_total_ils != null ? Number(r.sale_total_ils) / qty : null);
        return {
          id: r.id,
          branch_id: r.business_id,
          product_id: r.product_id,
          employee_id: r.user_id,
          quantity: qty,
          unit_price_ils: unit,
          total_ils: r.sale_total_ils != null ? Number(r.sale_total_ils) : null,
          cost_snapshot_ils: r.cost_snapshot_ils != null ? Number(r.cost_snapshot_ils) : null,
          discount_ils: r.discount_ils != null ? Number(r.discount_ils) : 0,
          discount_percent: r.discount_percent != null ? Number(r.discount_percent) : 0,
          currency: r.currency ?? "ILS",
          vat_percent: 18,
          sold_at: r.timestamp,
          notes: r.notes ?? null,
        };
      });

      body = {
        data: rows,
        page, limit, total: count ?? 0,
        from: range.from, to: range.to,
        currency: "ILS", vat_percent: 18,
      };
      extraHeaders = { "X-Total-Count": String(count ?? 0), "X-Page": String(page), "X-Limit": String(limit) };
    } else {
      status = 404;
      body = { error: "Unknown endpoint", code: "not_found", path };
    }
  } catch (e: any) {
    console.error("retail-iq-api error", e);
    status = 500;
    body = { error: "Internal error", code: "internal_error", details: String(e?.message ?? e) };
  }

  // Fire-and-forget last_used_at + audit log
  admin.from("api_keys").update({ last_used_at: new Date().toISOString() })
    .eq("id", keyRow.id).then(() => {});
  await logUsage(keyRow.id, bid, path, status,
    req.headers.get("x-forwarded-for"), req.headers.get("user-agent"));

  return json(body, status, extraHeaders);
});
