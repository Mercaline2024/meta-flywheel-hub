/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type ContactInput = {
  phone: string;
  name?: string;
  opt_in?: boolean;
  custom_fields?: Record<string, unknown>;
};

type Body = {
  waba_id: string;
  phone_number_id: string;
  template_name: string;
  template_language?: string;
  scheduled_at: string;
  rate_limit_per_minute?: number;
  contacts: ContactInput[];
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

function normalizePhone(input: string) {
  const clean = input.replace(/[^\d+]/g, "").trim();
  if (!clean) return "";
  if (clean.startsWith("+")) return clean;
  return `+${clean}`;
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
    const phoneNumberId = sanitizeText(body.phone_number_id, 100);
    const templateName = sanitizeText(body.template_name, 512).toLowerCase().replace(/\s+/g, "_");
    const templateLanguage = sanitizeText(body.template_language ?? "es", 10);
    const scheduledAtRaw = body.scheduled_at ?? "";
    const scheduledAt = new Date(scheduledAtRaw);
    const contacts = Array.isArray(body.contacts) ? body.contacts : [];
    const rateLimit = Math.max(1, Math.min(1000, Number(body.rate_limit_per_minute ?? 20) || 20));

    if (!wabaId) return json(400, { error: "Missing waba_id" });
    if (!phoneNumberId) return json(400, { error: "Missing phone_number_id" });
    if (!templateName) return json(400, { error: "Missing template_name" });
    if (Number.isNaN(scheduledAt.getTime())) return json(400, { error: "Invalid scheduled_at" });
    if (contacts.length === 0) return json(400, { error: "At least one contact is required" });
    if (contacts.length > 20000) return json(400, { error: "Max 20,000 contacts per campaign" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("id, scope")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `Connection lookup failed: ${connError.message}` });
    if (!conn) return json(400, { error: "No Meta connection found" });

    const scope = (conn.scope ?? "").toString();
    if (!scope.includes("whatsapp_business_management")) {
      return json(400, { error: "Missing whatsapp_business_management scope. Reconnect Meta integration with that permission." });
    }

    const normalizedContacts = contacts
      .map((c) => ({
        phone: normalizePhone((c.phone ?? "").toString()),
        name: sanitizeText(c.name, 120),
        opt_in: c.opt_in !== false,
        custom_fields: c.custom_fields && typeof c.custom_fields === "object" ? c.custom_fields : {},
      }))
      .filter((c) => c.phone.length >= 8 && c.phone.length <= 20);

    if (normalizedContacts.length === 0) {
      return json(400, { error: "No valid contacts after normalization" });
    }

    const uniqueByPhone = Array.from(new Map(normalizedContacts.map((c) => [c.phone, c])).values());

    const campaignInsert = {
      user_id: userId,
      waba_id: wabaId,
      phone_number_id: phoneNumberId,
      template_name: templateName,
      template_language: templateLanguage,
      scheduled_at: scheduledAt.toISOString(),
      rate_limit_per_minute: rateLimit,
      total_recipients: uniqueByPhone.length,
      status: "scheduled",
    };

    const { data: campaign, error: campaignError } = await admin
      .from("whatsapp_campaigns")
      .insert(campaignInsert)
      .select("id, status, scheduled_at, total_recipients")
      .single();

    if (campaignError || !campaign) {
      return json(500, { error: `Campaign insert failed: ${campaignError?.message ?? "unknown"}` });
    }

    const recipientRows = uniqueByPhone.map((contact) => ({
      campaign_id: campaign.id,
      user_id: userId,
      phone_number: contact.phone,
      full_name: contact.name || null,
      opt_in: contact.opt_in,
      custom_fields: contact.custom_fields,
      status_api: contact.opt_in ? "pending" : "failed",
      status_delivery: contact.opt_in ? "unknown" : "failed",
      error_message: contact.opt_in ? null : "Contacto sin opt-in",
      attempt_count: 0,
      next_attempt_at: contact.opt_in ? scheduledAt.toISOString() : null,
    }));

    const { error: recipientError } = await admin.from("whatsapp_campaign_recipients").insert(recipientRows);
    if (recipientError) {
      return json(500, { error: `Recipients insert failed: ${recipientError.message}` });
    }

    const noOptInCount = recipientRows.filter((r) => !r.opt_in).length;
    if (noOptInCount > 0) {
      await admin
        .from("whatsapp_campaigns")
        .update({ failed_count: noOptInCount })
        .eq("id", campaign.id);
    }

    return json(200, {
      success: true,
      campaign,
      stats: {
        total: uniqueByPhone.length,
        pending_to_send: uniqueByPhone.length - noOptInCount,
        rejected_no_opt_in: noOptInCount,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-create-scheduled-campaign error:", message);
    return json(500, { error: message });
  }
});
