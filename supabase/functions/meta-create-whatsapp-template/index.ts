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

type BodyButton =
  | { type: "QUICK_REPLY"; text: string }
  | { type: "URL"; text: string; url: string };

type Body = {
  waba_id: string;
  name: string;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  body_text: string;
  header_video_url?: string;
  buttons?: Array<BodyButton | string>;
};

function slugifyName(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 512);
}

function buildBodyExample(text: string) {
  const matches = Array.from(text.matchAll(/{{\s*(\d+)\s*}}/g));
  if (matches.length === 0) return null;

  const maxIndex = matches.reduce((max, m) => {
    const n = Number.parseInt(m[1] ?? "0", 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  if (maxIndex <= 0) return null;

  const sampleRow = Array.from({ length: maxIndex }, (_, i) => `ejemplo_${i + 1}`);
  return { body_text: [sampleRow] };
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
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const body = (await req.json()) as Partial<Body>;
    const wabaId = (body.waba_id ?? "").trim();
    const rawName = (body.name ?? "").trim();
    const name = slugifyName(rawName);
    const language = (body.language ?? "").trim();
    const bodyText = (body.body_text ?? "").trim();
    const category = (body.category ?? "MARKETING").toString();
    const headerVideoUrl = (body.header_video_url ?? "").trim();
    const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
    const buttons = rawButtons
      .map((button): BodyButton | null => {
        if (typeof button === "string") {
          const text = button.trim();
          return text ? { type: "QUICK_REPLY", text } : null;
        }

        if (!button || typeof button !== "object") return null;

        if (button.type === "URL") {
          const text = (button.text ?? "").trim();
          const url = (button.url ?? "").trim();
          if (!text || !url) return null;
          return { type: "URL", text, url };
        }

        const text = (button.text ?? "").trim();
        if (!text) return null;
        return { type: "QUICK_REPLY", text };
      })
      .filter((button): button is BodyButton => Boolean(button));

    if (!wabaId) return json(400, { error: "Missing waba_id" });
    if (!rawName || !name) return json(400, { error: "Missing name" });
    if (!language) return json(400, { error: "Missing language" });
    if (!bodyText) return json(400, { error: "Missing body_text" });
    if (buttons.length > 3) return json(400, { error: "buttons supports up to 3 entries" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `DB read failed: ${connError.message}` });
    if (!conn?.access_token) return json(400, { error: "Missing Meta access token. Please login with Facebook again." });

    const createUrl = `${GRAPH_BASE}/${wabaId}/message_templates`;

    const bodyComponent: Record<string, unknown> = {
      type: "BODY",
      text: bodyText,
    };

    const bodyExample = buildBodyExample(bodyText);
    if (bodyExample) bodyComponent.example = bodyExample;

    const components: Array<Record<string, unknown>> = [bodyComponent];

    if (headerVideoUrl) {
      components.unshift({
        type: "HEADER",
        format: "VIDEO",
        example: {
          header_handle: [headerVideoUrl],
        },
      });
    }

    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((button) =>
          button.type === "URL"
            ? { type: "URL", text: button.text, url: button.url }
            : { type: "QUICK_REPLY", text: button.text },
        ),
      });
    }

    const payload = {
      name,
      language,
      category,
      components,
    };

    const res = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conn.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      return json(400, { error: `Meta template create failed [${res.status}]: ${JSON.stringify(data)}` });
    }

    // Best-effort: store locally so UI reflects immediately.
    await admin.from("meta_whatsapp_templates").upsert(
      {
        user_id: userId,
        waba_id: wabaId,
        template_name: name,
        language,
        category: category ?? null,
        status: (data?.status ?? null) as any,
        components: payload.components,
        raw: { request: payload, response: data },
      },
      { onConflict: "user_id,waba_id,template_name,language" },
    );

    return json(200, { success: true, template: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-create-whatsapp-template error:", message);
    return json(500, { error: message });
  }
});
