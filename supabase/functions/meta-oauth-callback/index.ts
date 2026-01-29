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

function base64UrlDecodeToString(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmacSha256Base64Url(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return base64UrlEncode(new Uint8Array(sig));
}

type Body = {
  code: string;
  state: string;
  redirect_uri: string;
};

const GRAPH_BASE = "https://graph.facebook.com/v19.0";
const MAX_STATE_AGE_MS = 10 * 60 * 1000;

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
    const META_APP_SECRET = requireEnv("META_APP_SECRET");

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const body = (await req.json()) as Partial<Body>;
    const code = (body.code ?? "").trim();
    const state = (body.state ?? "").trim();
    const redirectUri = (body.redirect_uri ?? "").trim();
    if (!code || !state || !redirectUri) return json(400, { error: "Missing code/state/redirect_uri" });

    const [payloadB64, sig] = state.split(".");
    if (!payloadB64 || !sig) return json(400, { error: "Invalid state" });
    const expected = await hmacSha256Base64Url(META_APP_SECRET, payloadB64);
    if (expected !== sig) return json(400, { error: "Invalid state" });

    const payloadRaw = base64UrlDecodeToString(payloadB64);
    let payload: { sub: string; ts: number };
    try {
      payload = JSON.parse(payloadRaw);
    } catch {
      return json(400, { error: "Invalid state" });
    }
    if (!payload?.sub || payload.sub !== userId) return json(400, { error: "State user mismatch" });
    if (!payload?.ts || Date.now() - payload.ts > MAX_STATE_AGE_MS) return json(400, { error: "State expired" });

    const exchangeUrl = new URL(`${GRAPH_BASE}/oauth/access_token`);
    exchangeUrl.searchParams.set("client_id", META_APP_ID);
    exchangeUrl.searchParams.set("client_secret", META_APP_SECRET);
    exchangeUrl.searchParams.set("redirect_uri", redirectUri);
    exchangeUrl.searchParams.set("code", code);

    const res = await fetch(exchangeUrl.toString());
    const text = await res.text();
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return json(400, { error: `Meta token exchange failed [${res.status}]: ${JSON.stringify(data)}` });
    }

    const accessToken = (data?.access_token ?? "").toString();
    const tokenType = (data?.token_type ?? "bearer").toString();
    if (!accessToken || accessToken.length < 10) return json(400, { error: "Meta returned empty access_token" });

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await admin.from("meta_connections").upsert(
      {
        user_id: userId,
        provider: "meta",
        access_token: accessToken,
        token_type: tokenType,
        scope: null,
        token_received_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (upsertError) return json(500, { error: `DB upsert failed: ${upsertError.message}` });

    return json(200, { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-oauth-callback error:", message);
    return json(500, { error: message });
  }
});
