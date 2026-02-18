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

type Body = {
  waba_id: string;
  name: string;
  category?: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  language: string;
  body_text: string;
};

function slugifyName(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 512);
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

    if (!wabaId) return json(400, { error: "Missing waba_id" });
    if (!rawName || !name) return json(400, { error: "Missing name" });
    if (!language) return json(400, { error: "Missing language" });
    if (!bodyText) return json(400, { error: "Missing body_text" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `DB read failed: ${connError.message}` });
    if (!conn?.access_token) return json(400, { error: "Missing Meta access token. Please login with Facebook again." });

    const createUrl = `${GRAPH_BASE}/${wabaId}/message_templates`;

    const payload = {
      name,
      language,
      category,
      components: [
        {
          type: "BODY",
          text: bodyText,
        },
      ],
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
