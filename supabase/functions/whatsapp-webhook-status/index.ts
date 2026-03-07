/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-hub-signature-256",
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

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function signPayload(secret: string, payload: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    const META_APP_SECRET = requireEnv("META_APP_SECRET");

    // Meta verification challenge
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === META_APP_SECRET && challenge) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }

      return json(403, { error: "Verification failed" });
    }

    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const bodyText = await req.text();
    const signatureHeader = req.headers.get("x-hub-signature-256") ?? "";
    const expected = `sha256=${await signPayload(META_APP_SECRET, bodyText)}`;

    if (!timingSafeEqual(signatureHeader, expected)) {
      return json(401, { error: "Invalid webhook signature" });
    }

    const payload = JSON.parse(bodyText);
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const statuses: Array<any> = [];
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        const values = change?.value;
        if (Array.isArray(values?.statuses)) statuses.push(...values.statuses);
      }
    }

    let updated = 0;

    for (const statusItem of statuses) {
      const messageId = (statusItem?.id ?? "").toString().trim();
      const status = (statusItem?.status ?? "").toString().trim();
      if (!messageId || !status) continue;

      const statusDelivery = ["delivered", "read", "failed", "sent"].includes(status) ? status : "unknown";
      const deliveredAt = status === "delivered" || status === "read" ? new Date().toISOString() : null;

      const { data: row } = await admin
        .from("whatsapp_campaign_recipients")
        .update({
          status_delivery: statusDelivery,
          delivered_at: deliveredAt,
        })
        .eq("meta_message_id", messageId)
        .select("campaign_id")
        .maybeSingle();

      if (row?.campaign_id) {
        updated += 1;
        const [{ count: delivered }] = await Promise.all([
          admin
            .from("whatsapp_campaign_recipients")
            .select("id", { count: "exact", head: true })
            .eq("campaign_id", row.campaign_id)
            .in("status_delivery", ["delivered", "read"]),
        ]);

        await admin
          .from("whatsapp_campaigns")
          .update({ delivered_count: delivered ?? 0 })
          .eq("id", row.campaign_id);
      }
    }

    return json(200, { success: true, updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-webhook-status error:", message);
    return json(500, { error: message });
  }
});
