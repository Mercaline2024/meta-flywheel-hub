import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, Building2, Filter, Layers3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMetaAssets } from "@/lib/meta/useMetaAssets";

type Campaign = {
  id: string;
  name: string;
  objective: "Leads" | "Ventas" | "Tráfico";
  status: "Activa" | "Pausada";
};

const demoCampaigns: Campaign[] = [
  { id: "c1", name: "Q1 · Lead Gen · WhatsApp", objective: "Leads", status: "Activa" },
  { id: "c2", name: "Remarketing · Catálogo", objective: "Ventas", status: "Activa" },
  { id: "c3", name: "Brand Lift · Always On", objective: "Tráfico", status: "Pausada" },
  { id: "c4", name: "Promos · Fin de mes", objective: "Ventas", status: "Activa" },
];

export default function Campaigns() {
  const [bm, setBm] = useState<string | null>(null);
  const [adAccount, setAdAccount] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({ c1: true, c2: false, c3: false, c4: true });

  const assets = useMetaAssets(bm);
  const bmOptions = assets.bms.data ?? [];
  const adAccountOptions = assets.adAccounts.data ?? [];

  useEffect(() => {
    if (!bm && bmOptions.length > 0) setBm(bmOptions[0].meta_bm_id);
  }, [bm, bmOptions]);

  useEffect(() => {
    if (!adAccount && adAccountOptions.length > 0) setAdAccount(adAccountOptions[0].meta_ad_account_id);
  }, [adAccount, adAccountOptions]);

  const selectedCount = useMemo(() => Object.values(selectedIds).filter(Boolean).length, [selectedIds]);
  const selectedCampaigns = useMemo(
    () => demoCampaigns.filter((c) => selectedIds[c.id]),
    [selectedIds],
  );

  const metrics = useMemo(() => {
    // demo aggregation (no hardcoded colors)
    const base = Math.max(1, selectedCount);
    return {
      spend: 420 * base,
      ctr: Math.min(3.8, 1.4 + base * 0.5),
      cpl: Math.max(1.8, 6.4 - base * 0.8),
      leads: 38 * base,
    };
  }, [selectedCount]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="lg:col-span-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Campañas</h1>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Selecciona las campañas que quieres analizar. Feedback inmediato, sin ruido.
            </p>
          </div>
          <Badge variant="secondary" className="gap-2">
            <Filter className="h-4 w-4" aria-hidden="true" />
            {selectedCount} seleccionadas
          </Badge>
        </div>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Portafolio (BM)
            </CardTitle>
            <CardDescription>Elige el Business Manager para cargar cuentas y campañas.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Business Manager</span>
              <Select value={bm ?? ""} onValueChange={(v) => setBm(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un BM" />
                </SelectTrigger>
                <SelectContent>
                  {bmOptions.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Sin BMs (conecta Meta)
                    </SelectItem>
                  ) : (
                    bmOptions.map((b) => (
                      <SelectItem key={b.meta_bm_id} value={b.meta_bm_id}>
                        {b.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {assets.syncing ? <div className="text-xs text-muted-foreground">Sincronizando BMs…</div> : null}
              {assets.syncError ? (
                <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
                  No pude sincronizar datos reales de Meta.
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link to="/auth">Reintentar login</Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Cuenta publicitaria</span>
              <Select value={adAccount ?? ""} onValueChange={(v) => setAdAccount(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {adAccountOptions.length === 0 ? (
                    <SelectItem value="__empty" disabled>
                      Sin cuentas (elige BM)
                    </SelectItem>
                  ) : (
                    adAccountOptions.map((a) => (
                      <SelectItem key={a.meta_ad_account_id} value={a.meta_ad_account_id}>
                        {a.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {!assets.syncing && bmOptions.length === 0 ? (
                <div className="text-xs text-muted-foreground">Tip: inicia sesión con Facebook para traer tus BMs reales.</div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Campañas
            </CardTitle>
            <CardDescription>Selección múltiple con estado visible.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {demoCampaigns.map((c) => {
              const checked = !!selectedIds[c.id];
              return (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-start justify-between gap-3 rounded-lg border bg-background/60 p-4 transition-all duration-200 hover:bg-accent/10"
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSelectedIds((prev) => ({ ...prev, [c.id]: Boolean(v) }));
                      }}
                      aria-label={`Seleccionar ${c.name}`}
                    />
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary">{c.objective}</Badge>
                        <span>{c.status}</span>
                      </div>
                    </div>
                  </div>

                  <span className="text-xs text-muted-foreground">ID: {c.id}</span>
                </label>
              );
            })}

            <Separator />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Feedback inmediato: {selectedCount} campañas listas.</span>
              <Button variant="success" disabled={selectedCount === 0}>
                Analizar selección
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>

      <aside className="lg:col-span-4">
        <div className="sticky top-20 space-y-4">
          <Card className="mc-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Métricas en tiempo real
              </CardTitle>
              <CardDescription>Vista rápida por campaña / conjunto / anuncio.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Spend</div>
                  <div className="mt-1 text-lg font-semibold">${metrics.spend.toLocaleString()}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">CTR</div>
                  <div className="mt-1 text-lg font-semibold">{metrics.ctr.toFixed(2)}%</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">CPL</div>
                  <div className="mt-1 text-lg font-semibold">${metrics.cpl.toFixed(2)}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Leads</div>
                  <div className="mt-1 text-lg font-semibold">{metrics.leads}</div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Seleccionadas</div>
                {selectedCampaigns.length === 0 ? (
                  <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
                    Selecciona al menos 1 campaña para ver detalle.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {selectedCampaigns.map((c) => (
                      <li key={c.id} className="rounded-lg border bg-background/60 p-3">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Objetivo: {c.objective}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </aside>
    </div>
  );
}
