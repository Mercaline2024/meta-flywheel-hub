/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";
import { z } from "npm:zod@3.25.76";

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const briefSchema = z.object({
  product_name: z.string().trim().min(2).max(120),
  niche: z.string().trim().min(2).max(120),
  target_countries: z.array(z.string().trim().min(2).max(40)).min(1).max(12),
  product_price: z.number().nonnegative().optional().nullable(),
  product_url: z.string().trim().url().optional().nullable(),
  competitor_urls: z.array(z.string().trim().url()).max(8).optional().default([]),
  value_proposition: z.string().trim().min(8).max(400),
  customer_notes: z.string().trim().max(800).optional().nullable(),
});

type SourceItem = {
  title: string;
  type: "product_page" | "competitor_page" | "web_search" | "perplexity";
  url?: string;
  snippet: string;
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

async function readPageSnippet(url: string, label: string, type: SourceItem["type"]): Promise<SourceItem | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EcomdropResearchBot/1.0)" },
    });
    if (!response.ok) return null;

    const html = await response.text();
    const clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1400);

    if (!clean) return null;
    return { title: label, type, url, snippet: clean };
  } catch {
    return null;
  }
}

async function fetchPerplexityContext(query: string): Promise<SourceItem[]> {
  const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (!apiKey) return [];

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: "Devuelve señales de mercado claras y concisas para e-commerce, con foco en demanda, competencia y ángulos de venta.",
        },
        { role: "user", content: query },
      ],
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const content = String(data?.choices?.[0]?.message?.content ?? "").slice(0, 1600);
  const citations = Array.isArray(data?.citations) ? data.citations.slice(0, 5) : [];

  if (!content) return [];

  return [
    {
      title: "Perplexity market signals",
      type: "perplexity",
      snippet: content,
      url: citations[0],
    },
    ...citations.slice(1).map((url: string, index: number) => ({
      title: `Perplexity citation ${index + 2}`,
      type: "web_search" as const,
      url,
      snippet: "Fuente citada por Perplexity para validar tendencias y contexto competitivo.",
    })),
  ];
}

function buildPrompt(input: z.infer<typeof briefSchema>, sources: SourceItem[]) {
  return `
Eres un estratega senior de e-commerce y entrenamiento comercial por WhatsApp.

Objetivo:
Crear un análisis de mercado profesional para entrenar un asistente de ventas por WhatsApp.

Brief del cliente:
- Producto: ${input.product_name}
- Nicho: ${input.niche}
- Países: ${input.target_countries.join(", ")}
- Precio: ${input.product_price ?? "No indicado"}
- Propuesta de valor: ${input.value_proposition}
- Notas: ${input.customer_notes ?? "Sin notas"}

Fuentes recolectadas (internet + URLs del cliente):
${sources
  .map((source, idx) => `
[${idx + 1}] ${source.title}
Tipo: ${source.type}
URL: ${source.url ?? "N/A"}
Snippet: ${source.snippet}`)
  .join("\n")}

Devuelve SOLO JSON válido con esta estructura:
{
  "synthesis": {
    "market_summary": "string",
    "buyer_personas": [
      {
        "name": "string",
        "profile": "string",
        "motivations": ["string"],
        "objections": ["string"]
      }
    ],
    "sales_angles": ["string"],
    "key_objections": ["string"]
  },
  "playbook": {
    "offer_strategy": "string",
    "whatsapp_flow": {
      "opening": ["string"],
      "qualification": ["string"],
      "pitch": ["string"],
      "objection_handling": ["string"],
      "closing": ["string"],
      "follow_up": ["string"]
    },
    "training_notes": ["string"]
  }
}
`;
}

async function generateSynthesis(prompt: string) {
  const LOVABLE_API_KEY = requireEnv("LOVABLE_API_KEY");
  const response = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      temperature: 0.25,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Respondes únicamente JSON válido, accionable, y orientado a ventas por WhatsApp para e-commerce.",
        },
        { role: "user", content: prompt },
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

  const parsed = JSON.parse(content);
  return {
    synthesis: parsed?.synthesis ?? {},
    playbook: parsed?.playbook ?? {},
  };
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

    const parse = briefSchema.safeParse(await req.json());
    if (!parse.success) {
      return json(400, { error: "Invalid payload", details: parse.error.flatten() });
    }

    const input = parse.data;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: brief, error: briefError } = await admin
      .from("market_research_briefs")
      .insert({
        user_id: userId,
        product_name: input.product_name,
        niche: input.niche,
        target_countries: input.target_countries,
        product_price: input.product_price,
        product_url: input.product_url,
        competitor_urls: input.competitor_urls,
        value_proposition: input.value_proposition,
        customer_notes: input.customer_notes,
        status: "processing",
      })
      .select("id")
      .single();

    if (briefError || !brief?.id) {
      return json(500, { error: `Failed to create brief: ${briefError?.message ?? "unknown"}` });
    }

    const sources: SourceItem[] = [];

    if (input.product_url) {
      const source = await readPageSnippet(input.product_url, "Product page", "product_page");
      if (source) sources.push(source);
    }

    for (const competitorUrl of input.competitor_urls.slice(0, 4)) {
      const source = await readPageSnippet(competitorUrl, "Competitor page", "competitor_page");
      if (source) sources.push(source);
    }

    const perplexitySources = await fetchPerplexityContext(
      `Investiga tendencias, demanda, buyer persona, objeciones y ángulos de venta para ${input.product_name} en ${input.niche} para ${input.target_countries.join(", ")}.`,
    );
    sources.push(...perplexitySources);

    const minimalSource: SourceItem = {
      title: "Client brief context",
      type: "web_search",
      snippet: `Producto: ${input.product_name}. Nicho: ${input.niche}. Propuesta de valor: ${input.value_proposition}`,
    };
    if (sources.length === 0) sources.push(minimalSource);

    const prompt = buildPrompt(input, sources);
    const { synthesis, playbook } = await generateSynthesis(prompt);

    const { data: run, error: runError } = await admin
      .from("market_research_runs")
      .insert({
        brief_id: brief.id,
        user_id: userId,
        status: "completed",
        source_count: sources.length,
        sources,
        synthesis,
      })
      .select("id")
      .single();

    if (runError || !run?.id) {
      return json(500, { error: `Failed to create research run: ${runError?.message ?? "unknown"}` });
    }

    const { data: playbookRow, error: playbookError } = await admin
      .from("whatsapp_sales_playbooks")
      .insert({
        brief_id: brief.id,
        run_id: run.id,
        user_id: userId,
        title: `Playbook ${input.product_name} - ${new Date().toISOString().slice(0, 10)}`,
        playbook,
      })
      .select("id")
      .single();

    if (playbookError || !playbookRow?.id) {
      return json(500, { error: `Failed to create playbook: ${playbookError?.message ?? "unknown"}` });
    }

    await admin.from("market_research_briefs").update({ status: "completed" }).eq("id", brief.id);

    return json(200, {
      success: true,
      brief_id: brief.id,
      run_id: run.id,
      playbook_id: playbookRow.id,
      synthesis,
      playbook,
      sources,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("market-research-generate error:", message);
    return json(500, { error: message });
  }
});
