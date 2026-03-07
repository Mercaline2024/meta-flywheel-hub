/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function requireEnvAny(names: string[]) {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }
  throw new Error(`${names[0]} is not configured`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "GET" && req.method !== "POST") return json(405, { error: "Method not allowed" });

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
    if (claimsError || !claimsData?.claims?.sub) return json(401, { error: "Unauthorized" });

    const userId = claimsData.claims.sub;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: campaigns, error: campaignError } = await admin
      .from("whatsapp_campaigns")
      .select(
        "id, status, waba_id, phone_number_id, template_name, template_language, scheduled_at, rate_limit_per_minute, total_recipients, sent_api_count, delivered_count, failed_count, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (campaignError) return json(500, { error: campaignError.message });

    const campaignIds = (campaigns ?? []).map((c) => c.id);
    if (campaignIds.length === 0) return json(200, { campaigns: [] });

    const { data: recipients, error: recipientError } = await admin
      .from("whatsapp_campaign_recipients")
      .select("campaign_id, status_api, status_delivery")
      .eq("user_id", userId)
      .in("campaign_id", campaignIds);

    if (recipientError) return json(500, { error: recipientError.message });

    const statsMap = new Map<string, { pending: number; accepted: number; failed: number; delivered: number; read: number }>();

    for (const row of recipients ?? []) {
      const current = statsMap.get(row.campaign_id) ?? { pending: 0, accepted: 0, failed: 0, delivered: 0, read: 0 };
      if (row.status_api === "pending") current.pending += 1;
      if (row.status_api === "accepted") current.accepted += 1;
      if (row.status_api === "failed") current.failed += 1;
      if (row.status_delivery === "delivered") current.delivered += 1;
      if (row.status_delivery === "read") current.read += 1;
      statsMap.set(row.campaign_id, current);
    }

    const data = (campaigns ?? []).map((campaign) => ({
      ...campaign,
      stats: statsMap.get(campaign.id) ?? { pending: 0, accepted: 0, failed: 0, delivered: 0, read: 0 },
    }));

    return json(200, { campaigns: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-list-scheduled-campaigns error:", message);
    return json(500, { error: message });
  }
});
