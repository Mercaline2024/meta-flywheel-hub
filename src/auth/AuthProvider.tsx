import * as React from "react";
import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);

      // Store provider token securely (async work deferred to avoid auth deadlocks)
      if (nextSession?.provider_token) {
        const providerToken = nextSession.provider_token;
        const refreshToken = nextSession.provider_refresh_token;

        setTimeout(() => {
          supabase.functions
            .invoke("meta-store-token", {
              body: {
                provider: "facebook",
                access_token: providerToken,
                refresh_token: refreshToken ?? undefined,
              },
            })
            .then(({ error }) => {
              if (error) {
                toast({
                  title: "Conectado, pero sin token",
                  description:
                    "No pude guardar el token de Meta para sincronizar BMs/cuentas. Revisa configuración del proveedor y reintenta.",
                });
              }
            })
            .catch(() => {
              // Avoid noisy errors
            });
        }, 0);
      }
    });

    // THEN check current session
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const value = React.useMemo<AuthContextValue>(() => ({ session, user, loading }), [session, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
