// Mlaiko club read API. GET only. Business id comes from the club API key.
// Does not alter the RetailIQ contract. No costs, prices, suppliers, or notes.

import { createClient } from "npm:@supabase/supabase-js@2";
import { ClubSourceError, handleClubRequest, type ClubKey } from "./handler.ts";
import type { IncomingSourceRow, StockSourceRow } from "./catalog.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mlaiko-api-key",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function brandOf(value: { id?: string; name?: string } | { id?: string; name?: string }[] | null): { id: string; name: string } | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row?.id || !row.name) return null;
  return { id: row.id, name: row.name };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/club-api/, "") || "/";
  const result = await handleClubRequest({
    method: req.method,
    path,
    apiKey: req.headers.get("x-mlaiko-api-key"),
    searchParams: url.searchParams,
    now: new Date(),
    deps: {
      findKey: async (apiKey): Promise<ClubKey | null> => {
        const { data, error } = await admin
          .from("api_keys")
          .select("id, business_id, revoked_at, expires_at, scope, rate_limit_per_min")
          .eq("key_hash", await sha256Hex(apiKey))
          .maybeSingle();
        if (error || !data) return null;
        return {
          id: data.id,
          businessId: data.business_id,
          revokedAt: data.revoked_at,
          expiresAt: data.expires_at,
          scope: data.scope,
          rateLimitPerMin: data.rate_limit_per_min,
        };
      },
      recentUseCount: async (apiKeyId, sinceIso) => {
        const { count, error } = await admin
          .from("api_key_usage_log")
          .select("id", { count: "exact", head: true })
          .eq("api_key_id", apiKeyId)
          .gte("created_at", sinceIso);
        if (error) return 0;
        return count ?? 0;
      },
      logUse: async (apiKeyId, businessId, endpoint, status) => {
        await admin.from("api_key_usage_log").insert({
          api_key_id: apiKeyId,
          business_id: businessId,
          endpoint,
          method: "GET",
          status_code: status,
        });
        await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKeyId);
      },
      loadStock: async (businessId): Promise<StockSourceRow[]> => {
        const { data, error } = await admin
          .from("products")
          .select("id, name, image, quantity, updated_at, brand_id, brands:brand_id(id,name)")
          .eq("business_id", businessId);
        if (error) throw new ClubSourceError("stock_unavailable");
        return (data ?? []).map((row) => {
          const brand = brandOf(row.brands as { id?: string; name?: string } | { id?: string; name?: string }[] | null);
          return {
            id: row.id,
            name: row.name,
            brandId: brand?.id ?? null,
            brandName: brand?.name ?? null,
            image: row.image,
            quantity: row.quantity,
            updatedAt: row.updated_at,
          };
        });
      },
      loadIncoming: async (businessId): Promise<IncomingSourceRow[]> => {
        const purchase = await admin
          .from("purchase_order_lines")
          .select("id, purchase_order_id, product_id, brand, model, size_label, load_index, speed_rating, ordered_qty, received_qty, purchase_orders!inner(status, expected_on)")
          .eq("business_id", businessId);
        if (purchase.error) throw new ClubSourceError("incoming_unavailable");
        const imported = await admin
          .from("import_order_items")
          .select("id, import_order_id, product_id, product_description, model_name, size_label, manufacturer_name, brand_id, ordered_quantity, received_quantity, not_arriving_quantity, item_status, brands:brand_id(id,name), import_orders!inner(status, estimated_arrival_date)")
          .eq("business_id", businessId);
        if (imported.error) throw new ClubSourceError("incoming_unavailable");
        const purchaseRows: IncomingSourceRow[] = (purchase.data ?? []).map((row) => {
          const order = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders;
          return {
            sourceType: "purchase_order",
            sourceId: row.purchase_order_id,
            lineId: row.id,
            productId: row.product_id,
            documentStatus: order?.status ?? "",
            lineStatus: null,
            orderedQuantity: row.ordered_qty,
            receivedQuantity: row.received_qty,
            notArrivingQuantity: 0,
            name: row.model,
            brandId: null,
            brandName: null,
            storedBrand: row.brand,
            storedModel: row.model,
            storedSizeLabel: row.size_label,
            storedLoadIndex: row.load_index,
            storedSpeedRating: row.speed_rating,
            expectedOn: order?.expected_on ?? null,
            explicitLinkKey: null,
          };
        });
        const importRows: IncomingSourceRow[] = (imported.data ?? []).map((row) => {
          const order = Array.isArray(row.import_orders) ? row.import_orders[0] : row.import_orders;
          const brand = brandOf(row.brands as { id?: string; name?: string } | { id?: string; name?: string }[] | null);
          return {
            sourceType: "import_order",
            sourceId: row.import_order_id,
            lineId: row.id,
            productId: row.product_id,
            documentStatus: order?.status ?? "",
            lineStatus: row.item_status,
            orderedQuantity: row.ordered_quantity,
            receivedQuantity: row.received_quantity,
            notArrivingQuantity: row.not_arriving_quantity,
            name: row.product_description,
            brandId: brand?.id ?? null,
            brandName: brand?.name ?? null,
            storedBrand: row.manufacturer_name,
            storedModel: row.model_name,
            storedSizeLabel: row.size_label,
            storedLoadIndex: null,
            storedSpeedRating: null,
            expectedOn: order?.estimated_arrival_date ?? null,
            explicitLinkKey: null,
          };
        });
        return [...purchaseRows, ...importRows];
      },
    },
  });
  if (result.status === 204) return new Response(null, { status: 204, headers: corsHeaders });
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
