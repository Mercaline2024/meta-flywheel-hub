import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Facebook, ShieldCheck } from "lucide-react";

import PointerSpotlight from "@/components/metacontrol/PointerSpotlight";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const META_SCOPES = ["business_management", "ads_read", "ads_management", "whatsapp_business_management"] as const;

export default function Integrations() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const redirectUri = useMemo(() => `${window.location.origin}/app/integrations/meta/callback`, []);

  const connectMeta = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-oauth-url", {
        body: { scopes: META_SCOPES, redirect_uri: redirectUri },
      });
      if (error) throw error;
      const url = (data as any)?.url as string | undefined;
      if (!url) throw new Error("No se pudo iniciar OAuth");
      window.location.assign(url);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo iniciar la conexión";
      toast({
        title: "No se pudo conectar Meta",
        description: message,
      });
      setBusy(false);
    }
  };

  return (
    <PointerSpotlight className="min-h-[70vh] bg-background">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Integraciones</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Autoriza proveedores para sincronizar activos (BM, cuentas publicitarias) y alimentar el dashboard.
            </p>
          </div>
          <Badge variant="secondary" className="gap-2">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Tokens protegidos
          </Badge>
        </div>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Facebook / Meta
            </CardTitle>
            <CardDescription>
              Inicia sesión para solicitar permisos y autorizar el acceso a la API de Meta (BM + Ad Accounts).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              Redirect URI:
              <div className="mt-1 font-mono text-xs text-foreground/80 break-all">{redirectUri}</div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="hero" onClick={connectMeta} disabled={busy} className="gap-2">
                <Facebook aria-hidden="true" />
                Conectar
              </Button>
              <Button variant="secondary" onClick={() => navigate("/app/campaigns")} disabled={busy}>
                Volver a campañas
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PointerSpotlight>
  );
}
