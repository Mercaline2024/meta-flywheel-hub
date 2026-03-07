/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type CampaignRow = {
  id: string;
  user_id: string;
  phone_number_id: string;
  template_name: string;
  template_language: string;
  rate_limit_per_minute: number;
  status: string;
};

type RecipientRow = {
  id: string;
  phone_number: string;
  attempt_count: number;
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

async function sendTemplateMessage(params: {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  templateName: string;
  languageCode: string;
}) {
  const { accessToken, phoneNumberId, to, templateName, languageCode } = params;

  const response = await fetch(`${GRAPH_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    }),
  });

  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, payload, status: response.status };
}

function calcNextRetryAt(attemptCount: number) {
  const delayMinutes = Math.min(30, 2 ** Math.max(1, attemptCount));
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function isTransientError(payload: any) {
  const error = payload?.error;
  return Boolean(error?.is_transient) || [1, 2, 4, 17, 613].includes(Number(error?.code));
}

async function processRecipient(params: {
  admin: ReturnType<typeof createClient>;
  campaign: CampaignRow;
  recipient: RecipientRow;
  accessToken: string;
}) {
  const { admin, campaign, recipient, accessToken } = params;

  const nextAttempt = recipient.attempt_count + 1;
  const result = await sendTemplateMessage({
    accessToken,
    phoneNumberId: campaign.phone_number_id,
    to: recipient.phone_number,
    templateName: campaign.template_name,
    languageCode: campaign.template_language,
  });

  if (result.ok) {
    const messageId = result.payload?.messages?.[0]?.id ?? null;
    await admin
      .from("whatsapp_campaign_recipients")
      .update({
        status_api: "accepted",
        status_delivery: "sent",
        meta_message_id: messageId,
        accepted_at: new Date().toISOString(),
        attempt_count: nextAttempt,
        next_attempt_at: null,
        error_message: null,
      })
      .eq("id", recipient.id);
    return { accepted: 1, failed: 0 };
  }

  const transient = isTransientError(result.payload);
  const hasRetriesLeft = nextAttempt < 3;

  if (transient && hasRetriesLeft) {
    await admin
      .from("whatsapp_campaign_recipients")
      .update({
        status_api: "pending",
        attempt_count: nextAttempt,
        next_attempt_at: calcNextRetryAt(nextAttempt),
        error_message: JSON.stringify(result.payload).slice(0, 1000),
      })
      .eq("id", recipient.id);
    return { accepted: 0, failed: 0 };
  }

  await admin
    .from("whatsapp_campaign_recipients")
    .update({
      status_api: "failed",
      status_delivery: "failed",
      attempt_count: nextAttempt,
      next_attempt_at: null,
      error_message: JSON.stringify(result.payload).slice(0, 1000),
    })
    .eq("id", recipient.id);

  return { accepted: 0, failed: 1 };
}

async function refreshCampaignCounters(admin: ReturnType<typeof createClient>, campaignId: string) {
  const [{ count: sent }, { count: failed }, { count: delivered }, { count: pending }] = await Promise.all([
    admin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status_api", "accepted"),
    admin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status_api", "failed"),
    admin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .in("status_delivery", ["delivered", "read"]),
    admin
      .from("whatsapp_campaign_recipients")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId)
      .eq("status_api", "pending"),
  ]);

  const status = (pending ?? 0) === 0 ? "completed" : "running";

  await admin
    .from("whatsapp_campaigns")
    .update({
      sent_api_count: sent ?? 0,
      failed_count: failed ?? 0,
      delivered_count: delivered ?? 0,
      status,
    })
    .eq("id", campaignId);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const nowIso = new Date().toISOString();

    const { data: campaigns, error: campaignsError } = await admin
      .from("whatsapp_campaigns")
      .select("id, user_id, phone_number_id, template_name, template_language, rate_limit_per_minute, status")
      .in("status", ["scheduled", "running"])
      .lte("scheduled_at", nowIso)
      .order("scheduled_at", { ascending: true })
      .limit(10);

    if (campaignsError) return json(500, { error: campaignsError.message });

    let processedCampaigns = 0;
    let acceptedCount = 0;
    let failedCount = 0;

    for (const campaign of (campaigns ?? []) as CampaignRow[]) {
      await admin.from("whatsapp_campaigns").update({ status: "running" }).eq("id", campaign.id);

      const { data: conn, error: connError } = await admin
        .from("meta_connections")
        .select("access_token")
        .eq("user_id", campaign.user_id)
        .maybeSingle();

      if (connError || !conn?.access_token) {
        await admin.from("whatsapp_campaigns").update({ status: "failed" }).eq("id", campaign.id);
        continue;
      }

      const { data: recipients, error: recipientsError } = await admin
        .from("whatsapp_campaign_recipients")
        .select("id, phone_number, attempt_count")
        .eq("campaign_id", campaign.id)
        .eq("status_api", "pending")
        .or(`next_attempt_at.is.null,next_attempt_at.lte.${nowIso}`)
        .limit(Math.max(1, campaign.rate_limit_per_minute || 20));

      if (recipientsError) {
        await admin.from("whatsapp_campaigns").update({ status: "failed" }).eq("id", campaign.id);
        continue;
      }

      for (const recipient of (recipients ?? []) as RecipientRow[]) {
        const result = await processRecipient({
          admin,
          campaign,
          recipient,
          accessToken: conn.access_token,
        });
        acceptedCount += result.accepted;
        failedCount += result.failed;
      }

      await refreshCampaignCounters(admin, campaign.id);
      processedCampaigns += 1;
    }

    return json(200, {
      success: true,
      processed_campaigns: processedCampaigns,
      accepted: acceptedCount,
      failed: failedCount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("whatsapp-dispatch-scheduled error:", message);
    return json(500, { error: message });
  }
});
