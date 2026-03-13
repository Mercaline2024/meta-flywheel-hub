/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const ASSET_BUCKET = "ai-campaign-assets";

const STRATEGIES: Record<string, { name: string; objective: string; angle: string }> = {
  sales_conversion: {
    name: "Ventas (Conversión)",
    objective: "OUTCOME_SALES",
    angle: "Oferta clara + urgencia + prueba social.",
  },
  catalog_sales: {
    name: "Ventas por catálogo",
    objective: "OUTCOME_SALES",
    angle: "Producto protagonista + beneficios concretos.",
  },
  lead_generation: {
    name: "Generación de leads",
    objective: "OUTCOME_LEADS",
    angle: "Pain point + solución + incentivo de registro.",
  },
  traffic: {
    name: "Tráfico web",
    objective: "OUTCOME_TRAFFIC",
    angle: "Hook visual + beneficio principal + CTA directo.",
  },
  engagement: {
    name: "Interacción",
    objective: "OUTCOME_ENGAGEMENT",
    angle: "Contenido participativo + pregunta detonante.",
  },
  brand_awareness: {
    name: "Reconocimiento de marca",
    objective: "OUTCOME_AWARENESS",
    angle: "Storytelling corto + identidad de marca consistente.",
  },
  reach: {
    name: "Alcance",
    objective: "OUTCOME_AWARENESS",
    angle: "Mensaje simple de alto impacto visual.",
  },
  video_views: {
    name: "Visualizaciones de video",
    objective: "OUTCOME_ENGAGEMENT",
    angle: "Gancho en 3 segundos + edición dinámica + CTA final.",
  },
  app_promotion: {
    name: "Promoción de app",
    objective: "OUTCOME_APP_PROMOTION",
    angle: "Demo de uso + propuesta de valor + prueba social.",
  },
  remarketing: {
    name: "Remarketing",
    objective: "OUTCOME_SALES",
    angle: "Recordatorio + objeciones + incentivo de cierre.",
  },
};

const ALLOWED_OBJECTIVES = new Set([
  "OUTCOME_AWARENESS",
  "OUTCOME_TRAFFIC",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_LEADS",
  "OUTCOME_APP_PROMOTION",
  "OUTCOME_SALES",
]);

type Body = {
  provider?: "lovable" | "claude";
  ad_account_id: string;
  strategy_key: string;
  product_name?: string;
  landing_url?: string;
  budget_daily?: number;
  countries?: string[];
  extra_context?: string;
  asset_paths: string[];
  create_in_meta?: boolean;
};

type Plan = {
  campaign_name: string;
  objective: string;
  primary_text: string;
  headline: string;
  description: string;
  call_to_action: string;
  audience: string;
  notes: string[];
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

function normalizeAdAccountId(id: string) {
  const raw = (id ?? "").trim();
  if (!raw) return "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function objectiveOrFallback(rawObjective: string | undefined, fallback: string) {
  const candidate = (rawObjective ?? "").trim().toUpperCase();
  if (ALLOWED_OBJECTIVES.has(candidate)) return candidate;
  return fallback;
}

function safePlan(input: Partial<Plan>, strategyObjective: string): Plan {
  return {
    campaign_name: (input.campaign_name ?? "Campaña IA").toString().slice(0, 150),
    objective: objectiveOrFallback(input.objective, strategyObjective),
    primary_text: (input.primary_text ?? "Texto principal generado por IA").toString().slice(0, 1000),
    headline: (input.headline ?? "Anuncio optimizado").toString().slice(0, 255),
    description: (input.description ?? "").toString().slice(0, 300),
    call_to_action: (input.call_to_action ?? "LEARN_MORE").toString().slice(0, 60),
    audience: (input.audience ?? "Audiencia amplia y relevante").toString().slice(0, 400),
    notes: Array.isArray(input.notes) ? input.notes.map((value) => String(value).slice(0, 180)) : [],
  };
}

function buildPrompt(input: {
  strategyName: string;
  strategyObjective: string;
  strategyAngle: string;
  productName: string;
  landingUrl: string;
  countries: string[];
  budgetDaily: number;
  extraContext: string;
  imageUrls: string[];
  videoUrls: string[];
}) {
  return `
Eres un media buyer senior de Meta Ads.

Objetivo de negocio:
- Estrategia: ${input.strategyName}
- Objetivo Meta preferente: ${input.strategyObjective}
- Ángulo estratégico: ${input.strategyAngle}

Contexto comercial:
- Producto/servicio: ${input.productName || "No especificado"}
- Landing URL: ${input.landingUrl || "No especificada"}
- Presupuesto diario estimado: ${input.budgetDaily} USD
- Países: ${input.countries.join(", ") || "No especificados"}
- Contexto adicional: ${input.extraContext || "Sin contexto adicional"}

Activos visuales:
- Imágenes (${input.imageUrls.length}): ${input.imageUrls.join(" | ") || "Ninguna"}
- Videos (${input.videoUrls.length}): ${input.videoUrls.join(" | ") || "Ninguno"}

Devuelve SOLO un JSON válido con esta estructura exacta:
{
  "campaign_name": "string",
  "objective": "OUTCOME_AWARENESS|OUTCOME_TRAFFIC|OUTCOME_ENGAGEMENT|OUTCOME_LEADS|OUTCOME_APP_PROMOTION|OUTCOME_SALES",
  "primary_text": "string",
  "headline": "string",
  "description": "string",
  "call_to_action": "LEARN_MORE|SHOP_NOW|SIGN_UP|APPLY_NOW|CONTACT_US|GET_OFFER",
  "audience": "string",
  "notes": ["string", "string"]
}
`;
}

async function generatePlanWithLovableAI(args: {
  lovableApiKey: string;
  prompt: string;
  imageUrls: string[];
}) {
  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: "text", text: args.prompt },
  ];

  for (const imageUrl of args.imageUrls.slice(0, 6)) {
    userContent.push({ type: "image_url", image_url: { url: imageUrl } });
  }

  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.lovableApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Eres un especialista en Meta Ads orientado a performance. Siempre respondes JSON válido y accionable.",
        },
        {
          role: "user",
          content: userContent,
        },
      ],
    }),
  });

  if (response.status === 429) {
    throw new Error("Rate limits exceeded, please try again later.");
  }
  if (response.status === 402) {
    throw new Error("Payment required, please add funds to your Lovable AI workspace.");
  }

  const raw = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    throw new Error("AI gateway returned invalid JSON");
  }

  if (!response.ok) {
    throw new Error(`AI gateway error [${response.status}]: ${JSON.stringify(payload)}`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI gateway returned empty content");

  return content as string;
}

async function generatePlanWithClaude(args: {
  claudeApiKey: string;
  prompt: string;
}) {
  const response = await fetch(CLAUDE_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": args.claudeApiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1200,
      temperature: 0.35,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  const raw = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw new Error(`Claude API error [${response.status}]: ${JSON.stringify(payload)}`);
  }

  const content = payload?.content?.[0]?.text;
  if (!content) throw new Error("Claude returned empty content");

  return content as string;
}

async function createMetaCampaign(args: {
  accessToken: string;
  adAccountId: string;
  plan: Plan;
  budgetDaily: number;
}) {
  const body = new URLSearchParams({
    name: args.plan.campaign_name,
    objective: args.plan.objective,
    status: "PAUSED",
    special_ad_categories: "[]",
    daily_budget: String(Math.max(5, Math.floor(args.budgetDaily)) * 100),
    access_token: args.accessToken,
  });

  const response = await fetch(`${GRAPH_BASE}/${args.adAccountId}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const raw = await response.text();
  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  if (!response.ok) {
    throw new Error(`Meta campaign creation failed [${response.status}]: ${JSON.stringify(payload)}`);
  }

  return payload?.id as string | undefined;
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

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) return json(401, { error: "Unauthorized" });

    const userId = claimsData.claims.sub;
    const input = (await req.json()) as Partial<Body>;

    const provider = (input.provider ?? "lovable") as "lovable" | "claude";
    const strategy = STRATEGIES[(input.strategy_key ?? "").trim()];
    if (!strategy) return json(400, { error: "Invalid strategy_key" });

    const adAccountId = normalizeAdAccountId(input.ad_account_id ?? "");
    if (!adAccountId) return json(400, { error: "Missing ad_account_id" });

    const assetPaths = Array.isArray(input.asset_paths) ? input.asset_paths.filter(Boolean) : [];
    if (assetPaths.length === 0) return json(400, { error: "Missing asset_paths" });

    const productName = (input.product_name ?? "").toString().trim();
    const landingUrl = (input.landing_url ?? "").toString().trim();
    const budgetDaily = Math.max(5, Math.min(100000, Number(input.budget_daily ?? 20) || 20));
    const countries = Array.isArray(input.countries)
      ? input.countries.map((value) => String(value).trim().toUpperCase()).filter(Boolean)
      : [];
    const extraContext = (input.extra_context ?? "").toString().trim();
    const createInMeta = input.create_in_meta !== false;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: adAccount, error: adAccountError } = await admin
      .from("meta_ad_accounts")
      .select("meta_ad_account_id, name")
      .eq("user_id", userId)
      .or(`meta_ad_account_id.eq.${adAccountId},meta_ad_account_id.eq.${adAccountId.replace("act_", "")}`)
      .maybeSingle();

    if (adAccountError) return json(500, { error: `Ad account lookup failed: ${adAccountError.message}` });
    if (!adAccount) return json(400, { error: "No tienes acceso a esa cuenta publicitaria" });

    const { data: conn, error: connError } = await admin
      .from("meta_connections")
      .select("access_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (connError) return json(500, { error: `Meta connection lookup failed: ${connError.message}` });
    if (!conn?.access_token) return json(400, { error: "Falta token de Meta. Reconecta la integración." });

    const imageUrls: string[] = [];
    const videoUrls: string[] = [];

    for (const rawPath of assetPaths.slice(0, 10)) {
      const path = String(rawPath).trim();
      if (!path.startsWith(`${userId}/`)) {
        return json(403, { error: "Asset path no autorizado" });
      }

      const { data: signed, error: signedError } = await admin.storage.from(ASSET_BUCKET).createSignedUrl(path, 3600);
      if (signedError || !signed?.signedUrl) {
        return json(500, { error: `No se pudo firmar asset ${path}: ${signedError?.message ?? "unknown"}` });
      }

      const fullUrl = signed.signedUrl;
      const lower = path.toLowerCase();
      if (/(\.jpg|\.jpeg|\.png|\.webp|\.gif)$/i.test(lower)) {
        imageUrls.push(fullUrl);
      } else {
        videoUrls.push(fullUrl);
      }
    }

    const prompt = buildPrompt({
      strategyName: strategy.name,
      strategyObjective: strategy.objective,
      strategyAngle: strategy.angle,
      productName,
      landingUrl,
      countries,
      budgetDaily,
      extraContext,
      imageUrls,
      videoUrls,
    });

    let rawPlan = "";
    if (provider === "claude") {
      const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
      if (!CLAUDE_API_KEY) {
        return json(400, {
          error:
            "CLAUDE_API_KEY no está configurada. Agrega el secret para usar Claude o cambia a Lovable AI.",
        });
      }
      rawPlan = await generatePlanWithClaude({ claudeApiKey: CLAUDE_API_KEY, prompt });
    } else {
      const LOVABLE_API_KEY = requireEnv("LOVABLE_API_KEY");
      rawPlan = await generatePlanWithLovableAI({
        lovableApiKey: LOVABLE_API_KEY,
        prompt,
        imageUrls,
      });
    }

    let parsedPlan: Partial<Plan>;
    try {
      parsedPlan = JSON.parse(rawPlan);
    } catch {
      parsedPlan = {
        campaign_name: `${strategy.name} - ${new Date().toISOString().slice(0, 10)}`,
        objective: strategy.objective,
        primary_text: rawPlan.slice(0, 900),
        headline: `${strategy.name} IA`,
        description: "Plan generado en formato texto.",
        call_to_action: "LEARN_MORE",
        audience: "Audiencia sugerida por IA",
        notes: ["La respuesta de IA no llegó en JSON; se aplicó fallback."],
      };
    }

    const plan = safePlan(parsedPlan, strategy.objective);

    let metaCampaignId: string | undefined;
    if (createInMeta) {
      metaCampaignId = await createMetaCampaign({
        accessToken: conn.access_token,
        adAccountId,
        plan,
        budgetDaily,
      });
    }

    return json(200, {
      success: true,
      strategy: strategy.name,
      objective: plan.objective,
      used_provider: provider,
      meta_campaign_id: metaCampaignId,
      plan,
      assets: {
        images: imageUrls.length,
        videos: videoUrls.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-ai-create-campaign error:", message);
    return json(500, { error: message });
  }
});
