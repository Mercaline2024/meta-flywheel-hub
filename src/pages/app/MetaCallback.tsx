import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMetaAssets } from "@/lib/meta/useMetaAssets";

export default function MetaCallback() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const code = params.get("code");
  const state = params.get("state");

  const redirectUri = useMemo(() => `${window.location.origin}/app/integrations/meta/callback`, []);
  const assets = useMetaAssets(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!code || !state) {
        setStatus("error");
        setErrorMsg("Faltan parámetros de autorización (code/state).")
        return;
      }

      try {
        const { error } = await supabase.functions.invoke("meta-oauth-callback", {
          body: { code, state, redirect_uri: redirectUri },
        });
        if (error) throw error;
        await assets.syncAssets();
        if (cancelled) return;
        setStatus("ok");
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "No se pudo completar la conexión";
        if (cancelled) return;
        setStatus("error");
        setErrorMsg(message);
        toast({ title: "Conexión fallida", description: message });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, state]);

  return (
    <div className="mx-auto max-w-2xl py-10">
      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {status === "working" ? (
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
            ) : status === "ok" ? (
              <CheckCircle2 className="h-5 w-5 text-primary" aria-hidden="true" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" aria-hidden="true" />
            )}
            Conexión con Meta
          </CardTitle>
          <CardDescription>
            {status === "working"
              ? "Guardando autorización y sincronizando activos…"
              : status === "ok"
                ? "Listo. Ya puedes seleccionar BM y cuentas en el dashboard."
                : "No se pudo completar la autorización."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          {status === "error" && errorMsg ? (
            <div className="text-sm text-muted-foreground break-words">{errorMsg}</div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="secondary">
              <Link to="/app/integrations">Volver a Integraciones</Link>
            </Button>
            <Button asChild>
              <Link to="/app/campaigns">Ir a Campañas</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
