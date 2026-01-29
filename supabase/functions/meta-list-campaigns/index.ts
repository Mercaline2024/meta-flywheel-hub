/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

type Body = {
  ad_account_ids: string[];
};

type MetaCampaign = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
};

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

function normalizeAdAccountId(id: string) {
  const raw = (id ?? "").trim();
  if (!raw) return "";
  // Meta a veces devuelve `act_123`, otras solo `123`.
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnvAny(["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"]);
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const body = (await req.json()) as Partial<Body>;
    const ids = Array.isArray(body.ad_account_ids) ? body.ad_account_ids : [];
    const adAccountIds = Array.from(new Set(ids.map(normalizeAdAccountId))).filter(Boolean);
    if (adAccountIds.length === 0) return json(400, { error: "Missing ad_account_ids" });
    if (adAccountIds.length > 20) return json(400, { error: "Too many ad accounts (max 20)" });

    // Service role for secure DB access (RLS bypass)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `DB read failed: ${connError.message}` });
    if (!conn?.access_token) {
      return json(400, { error: "Missing Meta access token. Please login with Facebook again." });
    }

    const accessToken = conn.access_token;
    const fields = "id,name,objective,status,effective_status";

    const campaignsById = new Map<string, MetaCampaign>();
    for (const actId of adAccountIds) {
      const url = `${GRAPH_BASE}/${actId}/campaigns?fields=${encodeURIComponent(fields)}&limit=100`;
      const campaigns = await fetchAllPages<MetaCampaign>(url, accessToken);
      for (const c of campaigns) {
        if (!c?.id) continue;
        campaignsById.set(c.id, c);
      }
    }

    return json(200, {
      success: true,
      campaigns: Array.from(campaignsById.values()),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-list-campaigns error:", message);
    return json(500, { error: message });
  }
});
