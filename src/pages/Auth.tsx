import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, Facebook, LockKeyhole, Mail, KeyRound } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useAuth } from "@/auth/AuthProvider";
import PointerSpotlight from "@/components/metacontrol/PointerSpotlight";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const authSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72, "Máximo 72 caracteres"),
});

type AuthValues = z.infer<typeof authSchema>;

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);

  const redirectHint = useMemo(() => `${window.location.origin}/app`, []);

  useEffect(() => {
    if (!loading && session) {
      navigate("/app", { replace: true });
    }
  }, [loading, session, navigate]);

  const form = useForm<AuthValues>({
    resolver: zodResolver(authSchema),
    defaultValues: { email: "", password: "" },
  });

  const signInWithFacebook = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "facebook",
        options: {
          redirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) throw error;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo iniciar sesión";
      toast({
        title: "No se pudo conectar con Facebook",
        description:
          message +
          ". Verifica que el proveedor Facebook esté habilitado en Lovable Cloud (Auth) y que el Redirect URL incluya /app.",
      });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (values: AuthValues) => {
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        });
        if (error) throw error;
        toast({ title: "Todo listo", description: "Sesión iniciada." });
        navigate((location.state as any)?.from ?? "/app", { replace: true });
        return;
      }

      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
        options: {
          emailRedirectTo: `${window.location.origin}/app`,
        },
      });
      if (error) throw error;
      toast({
        title: "Cuenta creada",
        description: "Si tu instancia requiere confirmación por email, revisa tu bandeja. Si no, ya puedes entrar.",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Error de autenticación";
      toast({ title: "No se pudo continuar", description: message });
    } finally {
      setBusy(false);
    }
  };

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

              <div className="space-y-4">
                <Button variant="hero" size="lg" className="w-full justify-center" onClick={signInWithFacebook} disabled={busy}>
                  <Facebook aria-hidden="true" />
                  Continuar con Facebook
                </Button>

                <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="login">Entrar</TabsTrigger>
                    <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
                  </TabsList>

                  <TabsContent value="login" className="mt-4">
                    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input id="email" type="email" autoComplete="email" className="pl-9" {...form.register("email")} />
                        </div>
                        {form.formState.errors.email?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Contraseña</Label>
                        <div className="relative">
                          <KeyRound
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            className="pl-9"
                            {...form.register("password")}
                          />
                        </div>
                        {form.formState.errors.password?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                        ) : null}
                      </div>

                      <Button type="submit" className="w-full" disabled={busy}>
                        Entrar
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="mt-4">
                    <form className="space-y-3" onSubmit={form.handleSubmit(onSubmit)}>
                      <div className="space-y-2">
                        <Label htmlFor="email_s">Email</Label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                          <Input id="email_s" type="email" autoComplete="email" className="pl-9" {...form.register("email")} />
                        </div>
                        {form.formState.errors.email?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password_s">Contraseña</Label>
                        <div className="relative">
                          <KeyRound
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                          />
                          <Input
                            id="password_s"
                            type="password"
                            autoComplete="new-password"
                            className="pl-9"
                            {...form.register("password")}
                          />
                        </div>
                        {form.formState.errors.password?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
                        ) : null}
                      </div>

                      <Button type="submit" className="w-full" disabled={busy}>
                        Crear cuenta
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="flex items-start gap-3 rounded-lg border bg-secondary/40 p-4">
                  <LockKeyhole className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    <p>
                      Para Facebook OAuth, el Redirect URL debe incluir:{" "}
                      <span className="font-medium text-foreground">{redirectHint}</span>
                    </p>
                  </div>
                </div>
              </div>

            <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
              <span>Acceso protegido: /app requiere sesión.</span>
              <Link to="/app" className="story-link text-primary">
                Ir al panel
              </Link>
            </footer>
          </div>
        </section>
      </main>
    </PointerSpotlight>
  );
}
