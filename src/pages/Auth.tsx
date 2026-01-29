import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, Facebook, LockKeyhole } from "lucide-react";

import PointerSpotlight from "@/components/metacontrol/PointerSpotlight";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

export default function Auth() {
  const navigate = useNavigate();

  const redirectHint = useMemo(() => `${window.location.origin}/app`, []);

  return (
    <PointerSpotlight className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-6 py-16">
        <section className="w-full animate-enter">
          <div className="mb-6 flex items-center justify-center">
            <Badge variant="secondary" className="gap-2">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              MetaControl · consola comercial
            </Badge>
          </div>

          <div className="mc-card mx-auto max-w-xl p-8 text-left">
            <header className="mb-6">
              <h1 className="text-balance text-3xl font-bold tracking-tight">Conecta tu cuenta de Meta</h1>
              <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                Conecta y desbloquea tu portafolio comercial. Todo queda listo para ejecutar sin fricción.
              </p>
            </header>

            <div className="space-y-3">
              <Button
                variant="hero"
                size="lg"
                className="w-full justify-center"
                onClick={() => {
                  toast({
                    title: "Conexión de Meta (demo)",
                    description:
                      "Ya dejé el flujo y el UI listos. El siguiente paso es activar OAuth de Facebook en Lovable Cloud para autenticar de verdad.",
                  });
                  navigate("/app");
                }}
              >
                <Facebook aria-hidden="true" />
                Continuar con Facebook
              </Button>

              <div className="flex items-start gap-3 rounded-lg border bg-secondary/40 p-4">
                <LockKeyhole className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <div className="text-sm leading-relaxed text-muted-foreground">
                  <p>
                    En producción, este botón iniciará sesión con OAuth. El redirect recomendado es:{" "}
                    <span className="font-medium text-foreground">{redirectHint}</span>
                  </p>
                </div>
              </div>
            </div>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>Modo demo: datos simulados y sin acceso a cuentas reales.</span>
              <Link to="/app" className="story-link text-primary">
                Entrar al panel
              </Link>
            </footer>
          </div>
        </section>
      </main>
    </PointerSpotlight>
  );
}
