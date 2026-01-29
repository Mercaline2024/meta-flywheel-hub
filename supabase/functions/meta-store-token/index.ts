/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@^2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Body = {
  provider?: string;
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Unauthorized" });
    }

    const SUPABASE_URL = requireEnv("SUPABASE_URL");
    const SUPABASE_ANON_KEY = requireEnv("SUPABASE_PUBLISHABLE_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const token = authHeader.replace("Bearer ", "");

    // Validate JWT claims (anon client)
    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub;

    const body = (await req.json()) as Partial<Body>;
    const provider = body.provider ?? "facebook";
    const accessToken = (body.access_token ?? "").trim();
    const refreshToken = (body.refresh_token ?? "").trim();
    const tokenType = (body.token_type ?? "").trim();
    const scope = (body.scope ?? "").trim();

    if (!accessToken || accessToken.length < 10 || accessToken.length > 4000) {
      return json(400, { error: "Invalid access_token" });
    }

    // Service role for secure writes (RLS bypass)
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error: upsertError } = await admin.from("meta_connections").upsert(
      {
        user_id: userId,
        provider,
        access_token: accessToken,
        refresh_token: refreshToken || null,
        token_type: tokenType || null,
        scope: scope || null,
        token_received_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (upsertError) {
      return json(500, { error: `DB upsert failed: ${upsertError.message}` });
    }

    return json(200, { success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("meta-store-token error:", message);
    return json(500, { error: message });
  }
});
