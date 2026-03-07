/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  waba_id: string;
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

function sanitizeText(value: string | undefined, max = 120) {
  return (value ?? "").replace(/[\r\n\t]+/g, " ").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    if (claimsError || !claimsData?.claims?.sub) return json(401, { error: "Unauthorized" });

    const userId = claimsData.claims.sub;
    const body = (await req.json()) as Partial<Body>;
    const wabaId = sanitizeText(body.waba_id, 100);

    if (!wabaId) return json(400, { error: "Missing waba_id" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token, scope")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `Connection lookup failed: ${connError.message}` });
    if (!conn?.access_token) return json(400, { error: "No Meta connection found" });

    const scope = (conn.scope ?? "").toString();
    if (!scope.includes("whatsapp_business_management")) {
      return json(400, { error: "Missing whatsapp_business_management scope. Reconnect Meta integration with that permission." });
    }

    const response = await fetch(
      `${GRAPH_BASE}/${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,status,name_status,code_verification_status&limit=200`,
      {
        headers: {
          Authorization: `Bearer ${conn.access_token}`,
        },
      },
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const message = payload?.error?.message ?? "Meta API error";
      return json(500, { error: message, details: payload });
    }

    const rawNumbers = Array.isArray(payload?.data) ? payload.data : [];

    const phoneNumbers = rawNumbers
      .map((row: Record<string, unknown>) => {
        const status = sanitizeText(String(row.status ?? ""), 40);
        const nameStatus = sanitizeText(String(row.name_status ?? ""), 40);

        return {
          id: sanitizeText(String(row.id ?? ""), 100),
          display_phone_number: sanitizeText(String(row.display_phone_number ?? ""), 40),
          verified_name: sanitizeText(String(row.verified_name ?? ""), 120),
          quality_rating: sanitizeText(String(row.quality_rating ?? "UNKNOWN"), 40),
          status,
          name_status: nameStatus,
          code_verification_status: sanitizeText(String(row.code_verification_status ?? ""), 40),
          is_send_ready: status === "CONNECTED",
        };
      })
      .filter((n) => n.id)
      .sort((a, b) => Number(b.is_send_ready) - Number(a.is_send_ready) || a.display_phone_number.localeCompare(b.display_phone_number));

    return json(200, {
      success: true,
      phone_numbers: phoneNumbers,
      send_ready_count: phoneNumbers.filter((n) => n.is_send_ready).length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-list-phone-numbers error:", message);
    return json(500, { error: message });
  }
});
