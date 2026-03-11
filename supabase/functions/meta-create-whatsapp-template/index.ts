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
  header_text?: string;
  footer_text?: string;
  header_video_url?: string;
  header_video_handle?: string;
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

function buildAlternativeTemplateName(baseName: string) {
  const suffix = Date.now().toString().slice(-6);
  return `${baseName.slice(0, Math.max(0, 512 - 7))}_${suffix}`;
}

function parseMetaError(raw: unknown) {
  if (!raw || typeof raw !== "object") return null;
  const error = (raw as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;

  const parsed = error as {
    code?: number;
    error_subcode?: number;
    error_user_msg?: string;
    error_user_title?: string;
    message?: string;
    type?: string;
  };

  return {
    code: parsed.code,
    subcode: parsed.error_subcode,
    title: parsed.error_user_title,
    userMessage: parsed.error_user_msg,
    message: parsed.message,
    type: parsed.type,
  };
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

function buildHeaderExample(text: string) {
  const matches = Array.from(text.matchAll(/{{\s*(\d+)\s*}}/g));
  if (matches.length === 0) return null;

  const maxIndex = matches.reduce((max, m) => {
    const n = Number.parseInt(m[1] ?? "0", 10);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, 0);

  if (maxIndex <= 0) return null;

  return { header_text: Array.from({ length: maxIndex }, (_, i) => `ejemplo_${i + 1}`) };
}

function sanitizeButtonText(input: string) {
  return input
    .replace(/{{\s*\d+\s*}}/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ .,!?:;()/_-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 25);
}

function inferVideoMimeTypeFromUrl(url: string) {
  const clean = url.split("?")[0]?.toLowerCase() ?? "";
  if (clean.endsWith(".mov")) return "video/quicktime";
  if (clean.endsWith(".webm")) return "video/webm";
  return "video/mp4";
}

function inferVideoFileNameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split("/").filter(Boolean).pop();
    return segment && segment.length > 0 ? segment : "template-video.mp4";
  } catch {
    return "template-video.mp4";
  }
}

async function uploadTemplateVideoHandle(params: {
  sourceUrl: string;
  accessToken: string;
  appId: string;
}) {
  const { sourceUrl, accessToken, appId } = params;

  const mediaRes = await fetch(sourceUrl);
  if (!mediaRes.ok) {
    throw new Error(`Unable to download video sample [${mediaRes.status}]`);
  }

  const videoBytes = await mediaRes.arrayBuffer();
  if (!videoBytes.byteLength) {
    throw new Error("Video sample is empty");
  }

  const fileName = inferVideoFileNameFromUrl(sourceUrl);
  const fileType = inferVideoMimeTypeFromUrl(sourceUrl);

  const initUrl = new URL(`${GRAPH_BASE}/${appId}/uploads`);
  initUrl.searchParams.set("file_name", fileName);
  initUrl.searchParams.set("file_length", String(videoBytes.byteLength));
  initUrl.searchParams.set("file_type", fileType);

  const initRes = await fetch(initUrl.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData?.id) {
    throw new Error(`Video upload init failed: ${JSON.stringify(initData)}`);
  }

  const uploadSessionId = String(initData.id);

  const transferRes = await fetch(`${GRAPH_BASE}/${uploadSessionId}`, {
    method: "POST",
    headers: {
      Authorization: `OAuth ${accessToken}`,
      file_offset: "0",
      "Content-Type": "application/octet-stream",
    },
    body: videoBytes,
  });

  const transferData = await transferRes.json().catch(() => ({}));
  const handle = transferData?.h;

  if (!transferRes.ok || !handle) {
    throw new Error(`Video upload transfer failed: ${JSON.stringify(transferData)}`);
  }

  return String(handle);
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
    const META_APP_ID = requireEnv("META_APP_ID");

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
    const headerText = (body.header_text ?? "").trim();
    const footerText = (body.footer_text ?? "").trim();
    const category = (body.category ?? "MARKETING").toString();
    const headerVideoUrl = (body.header_video_url ?? "").trim();
    const headerVideoHandleInput = (body.header_video_handle ?? "").trim();
    const rawButtons = Array.isArray(body.buttons) ? body.buttons : [];
    const buttons = rawButtons
      .map((button): BodyButton | null => {
        if (typeof button === "string") {
          const text = sanitizeButtonText(button);
          return text ? { type: "QUICK_REPLY", text } : null;
        }

        if (!button || typeof button !== "object") return null;

        if (button.type === "URL") {
          const text = sanitizeButtonText(button.text ?? "");
          const url = (button.url ?? "").trim();
          if (!text || !url) return null;
          return { type: "URL", text, url };
        }

        const text = sanitizeButtonText(button.text ?? "");
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

    if (headerVideoUrl || headerVideoHandleInput) {
      const headerHandle = headerVideoHandleInput
        ? headerVideoHandleInput
        : await uploadTemplateVideoHandle({
            sourceUrl: headerVideoUrl,
            accessToken: conn.access_token,
            appId: META_APP_ID,
          });

      components.unshift({
        type: "HEADER",
        format: "VIDEO",
        example: {
          header_handle: [headerHandle],
        },
      });
    }

    if (footerText) {
      components.push({
        type: "FOOTER",
        text: footerText,
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

    const createTemplateAtMeta = async (templateName: string) => {
      const payload = {
        name: templateName,
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

      return { res, data, payload };
    };

    let finalTemplateName = name;
    let result = await createTemplateAtMeta(finalTemplateName);

    if (!result.res.ok) {
      const parsedError = parseMetaError(result.data);
      const shouldRetryWithNewName = parsedError?.code === 100 && parsedError?.subcode === 2388023;

      if (shouldRetryWithNewName) {
        finalTemplateName = buildAlternativeTemplateName(name);
        result = await createTemplateAtMeta(finalTemplateName);
      }
    }

    if (!result.res.ok) {
      return json(400, { error: `Meta template create failed [${result.res.status}]: ${JSON.stringify(result.data)}` });
    }

    // Best-effort: store locally so UI reflects immediately.
    await admin.from("meta_whatsapp_templates").upsert(
      {
        user_id: userId,
        waba_id: wabaId,
        template_name: finalTemplateName,
        language,
        category: category ?? null,
        status: (result.data?.status ?? null) as any,
        components: result.payload.components,
        raw: { request: result.payload, response: result.data },
      },
      { onConflict: "user_id,waba_id,template_name,language" },
    );

    return json(200, { success: true, template: result.data, template_name_used: finalTemplateName });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-create-whatsapp-template error:", message);
    return json(500, { error: message });
  }
});
