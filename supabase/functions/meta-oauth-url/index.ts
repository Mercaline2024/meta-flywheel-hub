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

function base64UrlEncode(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeString(s: string) {
  return base64UrlEncode(new TextEncoder().encode(s));
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
  scopes?: string[];
  redirect_uri?: string;
};

const DEFAULT_SCOPES = ["business_management", "ads_read"];
const META_DIALOG_URL = "https://www.facebook.com/v19.0/dialog/oauth";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnvAny(["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"]);
    const META_APP_ID = requireEnv("META_APP_ID");
    const META_APP_SECRET = requireEnv("META_APP_SECRET");

    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) return json(401, { error: "Unauthorized" });
    const userId = claimsData.claims.sub;

    const body = (await req.json().catch(() => ({}))) as Partial<Body>;
    const redirectUri = (body.redirect_uri ?? "").trim();
    if (!redirectUri) return json(400, { error: "Missing redirect_uri" });

    const scopes = Array.isArray(body.scopes) && body.scopes.length > 0 ? body.scopes : DEFAULT_SCOPES;

    const payload = JSON.stringify({ sub: userId, ts: Date.now() });
    const payloadB64 = base64UrlEncodeString(payload);
    const sig = await hmacSha256Base64Url(META_APP_SECRET, payloadB64);
    const state = `${payloadB64}.${sig}`;

    const qp = new URLSearchParams({
      client_id: META_APP_ID,
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: scopes.join(","),
      auth_type: "rerequest",
    });

    return json(200, { url: `${META_DIALOG_URL}?${qp.toString()}` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-oauth-url error:", message);
    return json(500, { error: message });
  }
});
