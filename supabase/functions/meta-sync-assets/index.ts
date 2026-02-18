/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function requireEnvAny(names: string[]) {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  throw new Error(`${names[0]} is not configured`);
}

async function fetchAllPages<T>(url: string, accessToken: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | undefined = url;

  while (next) {
    const res = await fetch(next, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const text = await res.text();
    let payload: any;
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }

    if (!res.ok) {
      throw new Error(`Meta Graph API failed [${res.status}]: ${JSON.stringify(payload)}`);
    }

    if (Array.isArray(payload?.data)) {
      out.push(...payload.data);
    }
    next = payload?.paging?.next;
  }

  return out;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    // Edge runtime exposes SUPABASE_ANON_KEY (preferred). Keep fallback for older setups.
    const SUPABASE_ANON_KEY = requireEnvAny(["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"]);
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const token = authHeader.replace("Bearer ", "");

    // Validate JWT claims (anon client)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    // Service role for secure DB access
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) {
      return json(500, { error: `DB read failed: ${connError.message}` });
    }
    if (!conn?.access_token) {
      return json(400, { error: "Missing Meta access token. Please login with Facebook again." });
    }

    const accessToken = conn.access_token;

    // 1) Business Managers
    const businesses = await fetchAllPages<{ id: string; name?: string }>(
      `${GRAPH_BASE}/me/businesses?fields=id,name&limit=50`,
      accessToken,
    );

    const bmRows = businesses
      .filter((b) => typeof b.id === "string" && b.id.length > 0)
      .map((b) => ({
        user_id: userId,
        meta_bm_id: b.id,
        name: (b.name ?? `BM ${b.id}`).slice(0, 500),
      }));

    if (bmRows.length > 0) {
      const { error: upsertBmError } = await admin.from("meta_business_managers").upsert(bmRows, {
        onConflict: "user_id,meta_bm_id",
      });
      if (upsertBmError) {
        return json(500, { error: `DB upsert BM failed: ${upsertBmError.message}` });
      }
    }

    // 2) Ad accounts + WABAs per BM
    const adAccountRows: Array<{ user_id: string; meta_ad_account_id: string; name: string; meta_bm_id: string }> = [];
    const wabaRows: Array<{ user_id: string; meta_bm_id: string; waba_id: string; name: string }> = [];

    for (const bm of businesses) {
      const bmId = bm.id;

      const accounts = await fetchAllPages<{ id: string; name?: string }>(
        `${GRAPH_BASE}/${bmId}/owned_ad_accounts?fields=id,name&limit=100`,
        accessToken,
      );
      for (const a of accounts) {
        if (!a?.id) continue;
        adAccountRows.push({
          user_id: userId,
          meta_ad_account_id: a.id,
          name: (a.name ?? `Cuenta ${a.id}`).slice(0, 500),
          meta_bm_id: bmId,
        });
      }

      // WhatsApp Business Accounts (WABA)
      // Requires scope: whatsapp_business_management
      const wabas = await fetchAllPages<{ id: string; name?: string }>(
        `${GRAPH_BASE}/${bmId}/owned_whatsapp_business_accounts?fields=id,name&limit=100`,
        accessToken,
      );
      for (const w of wabas) {
        if (!w?.id) continue;
        wabaRows.push({
          user_id: userId,
          meta_bm_id: bmId,
          waba_id: w.id,
          name: (w.name ?? `WABA ${w.id}`).slice(0, 500),
        });
      }
    }

    // De-dupe rows before upserts to avoid: "ON CONFLICT DO UPDATE command cannot affect row a second time"
    const adAccountRowsUnique = Array.from(
      new Map(adAccountRows.map((r) => [`${r.user_id}:${r.meta_ad_account_id}`, r])).values(),
    );

    const wabaRowsUnique = Array.from(
      new Map(wabaRows.map((r) => [`${r.user_id}:${r.waba_id}`, r])).values(),
    );

    if (adAccountRowsUnique.length > 0) {
      const { error: upsertActError } = await admin.from("meta_ad_accounts").upsert(adAccountRowsUnique, {
        onConflict: "user_id,meta_ad_account_id",
      });
      if (upsertActError) {
        return json(500, { error: `DB upsert ad accounts failed: ${upsertActError.message}` });
      }
    }

    if (wabaRowsUnique.length > 0) {
      const { error: upsertWabaError } = await admin.from("meta_whatsapp_business_accounts").upsert(wabaRowsUnique, {
        onConflict: "user_id,waba_id",
      });
      if (upsertWabaError) {
        return json(500, { error: `DB upsert WABAs failed: ${upsertWabaError.message}` });
      }
    }

    // 3) Templates per WABA
    const templateRowsMap = new Map<
      string,
      {
        user_id: string;
        waba_id: string;
        template_name: string;
        language: string;
        category: string | null;
        status: string | null;
        components: unknown;
        raw: unknown;
      }
    >();

    for (const waba of wabaRowsUnique) {
      const wabaId = waba.waba_id;
      const templates = await fetchAllPages<any>(
        `${GRAPH_BASE}/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100`,
        accessToken,
      );
      for (const t of templates) {
        const name = (t?.name ?? "").toString().trim();
        const language = (t?.language ?? "").toString().trim();
        if (!name || !language) continue;

        const key = `${userId}:${wabaId}:${name}:${language}`;
        // Keep the first occurrence; if Meta returns duplicates across pages, we ignore later ones.
        if (templateRowsMap.has(key)) continue;

        templateRowsMap.set(key, {
          user_id: userId,
          waba_id: wabaId,
          template_name: name,
          language,
          category: (t?.category ?? null) as any,
          status: (t?.status ?? null) as any,
          components: (t?.components ?? []) as any,
          raw: t,
        });
      }
    }

    const templateRows = Array.from(templateRowsMap.values());

    if (templateRows.length > 0) {
      const { error: upsertTplError } = await admin.from("meta_whatsapp_templates").upsert(templateRows, {
        onConflict: "user_id,waba_id,template_name,language",
      });
      if (upsertTplError) {
        return json(500, { error: `DB upsert templates failed: ${upsertTplError.message}` });
      }
    }

    await admin
      .from("meta_connections")
      .update({
        bm_sync_at: new Date().toISOString(),
        ad_account_sync_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return json(200, {
      success: true,
      business_managers: bmRows.length,
      ad_accounts: adAccountRows.length,
      wabas: wabaRows.length,
      templates: templateRows.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-sync-assets error:", message);
    return json(500, { error: message });
  }
});
