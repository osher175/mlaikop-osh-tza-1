// Manage API keys for the authenticated user's business.
// Actions: list, create, revoke, delete, usage.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "")
    .replace(/\//g, "")
    .replace(/=+$/, "");
  return `mlk_${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claims, error: cErr } = await userClient.auth.getClaims(token);
  if (cErr || !claims?.claims) return json({ error: "Unauthorized" }, 401);
  const userId = claims.claims.sub as string;

  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const action = body.action as string;
  const businessId = body.business_id as string | undefined;

  // Verify the user owns this business (or is admin)
  async function assertOwnerOrAdmin(bid: string): Promise<boolean> {
    const { data: biz } = await admin
      .from("businesses")
      .select("owner_id")
      .eq("id", bid)
      .maybeSingle();
    if (biz?.owner_id === userId) return true;
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    return roleRow?.role === "admin";
  }

  try {
    if (action === "list") {
      if (!businessId) return json({ error: "business_id required" }, 400);
      if (!(await assertOwnerOrAdmin(businessId))) return json({ error: "Forbidden" }, 403);
      const { data, error } = await admin
        .from("api_keys")
        .select("id, name, key_prefix, scope, rate_limit_per_min, last_used_at, expires_at, revoked_at, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ data });
    }

    if (action === "create") {
      if (!businessId) return json({ error: "business_id required" }, 400);
      if (!(await assertOwnerOrAdmin(businessId))) return json({ error: "Forbidden" }, 403);

      const name = (body.name as string | undefined)?.trim();
      if (!name || name.length > 100) {
        return json({ error: "Invalid name (1-100 chars)" }, 400);
      }
      const expires_at = body.expires_at ? new Date(body.expires_at).toISOString() : null;

      const rawKey = generateKey();
      const key_hash = await sha256Hex(rawKey);
      const key_prefix = rawKey.slice(0, 12);

      const { data, error } = await admin
        .from("api_keys")
        .insert({
          business_id: businessId,
          created_by: userId,
          name,
          key_hash,
          key_prefix,
          expires_at,
        })
        .select("id, name, key_prefix, expires_at, created_at")
        .single();
      if (error) throw error;
      // Return raw key ONCE — never stored.
      return json({ data: { ...data, api_key: rawKey } });
    }

    if (action === "revoke") {
      const id = body.id as string;
      if (!id) return json({ error: "id required" }, 400);
      const { data: row } = await admin
        .from("api_keys").select("business_id").eq("id", id).maybeSingle();
      if (!row) return json({ error: "Not found" }, 404);
      if (!(await assertOwnerOrAdmin(row.business_id))) return json({ error: "Forbidden" }, 403);
      const { error } = await admin
        .from("api_keys")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      const id = body.id as string;
      if (!id) return json({ error: "id required" }, 400);
      const { data: row } = await admin
        .from("api_keys").select("business_id").eq("id", id).maybeSingle();
      if (!row) return json({ error: "Not found" }, 404);
      if (!(await assertOwnerOrAdmin(row.business_id))) return json({ error: "Forbidden" }, 403);
      const { error } = await admin.from("api_keys").delete().eq("id", id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "usage") {
      const id = body.id as string;
      if (!id) return json({ error: "id required" }, 400);
      const { data: row } = await admin
        .from("api_keys").select("business_id").eq("id", id).maybeSingle();
      if (!row) return json({ error: "Not found" }, 404);
      if (!(await assertOwnerOrAdmin(row.business_id))) return json({ error: "Forbidden" }, 403);
      const { data, error } = await admin
        .from("api_key_usage_log")
        .select("endpoint, method, status_code, ip, created_at")
        .eq("api_key_id", id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return json({ data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    console.error("api-keys-manage error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
