import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Brain, Film, ImagePlus, Sparkles, UploadCloud } from "lucide-react";

import { useAuth } from "@/auth/AuthProvider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CAMPAIGN_STRATEGIES, DEFAULT_STRATEGY_KEY } from "@/lib/meta/campaignStrategies";
import { useMetaAssets } from "@/lib/meta/useMetaAssets";

type UploadedAsset = {
  path: string;
  name: string;
  type: string;
  size: number;
};

type AiPlanResponse = {
  campaign_name?: string;
  objective?: string;
  primary_text?: string;
  headline?: string;
  description?: string;
  call_to_action?: string;
  audience?: string;
  notes?: string[];
};

const AI_ASSET_BUCKET = "ai-campaign-assets";

function sanitizeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").slice(0, 120);
}

export default function AICampaignBuilder() {
  const { user } = useAuth();

  const [selectedBm, setSelectedBm] = useState<string | null>(null);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [strategyKey, setStrategyKey] = useState(DEFAULT_STRATEGY_KEY);
  const [provider, setProvider] = useState<"lovable" | "claude">("lovable");
  const [productName, setProductName] = useState("");
  const [landingUrl, setLandingUrl] = useState("");
  const [budgetDaily, setBudgetDaily] = useState<number>(20);
  const [countries, setCountries] = useState("CO, MX");
  const [extraContext, setExtraContext] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadedAssets, setUploadedAssets] = useState<UploadedAsset[]>([]);
  const [result, setResult] = useState<{ plan?: AiPlanResponse; metaCampaignId?: string; provider?: string } | null>(null);

  const assets = useMetaAssets(selectedBm);

  const filteredAdAccounts = useMemo(() => assets.adAccounts.data ?? [], [assets.adAccounts.data]);

  const uploadAssets = async () => {
    if (!user?.id) throw new Error("Sesión inválida, vuelve a iniciar sesión.");
    if (selectedFiles.length === 0) throw new Error("Sube al menos una imagen o video.");

    const uploaded: UploadedAsset[] = [];

    for (const file of selectedFiles) {
      if (file.size > 20 * 1024 * 1024) {
        throw new Error(`El archivo ${file.name} excede 20MB.`);
      }

      const safeName = sanitizeFileName(file.name || `asset-${Date.now()}`);
      const path = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from(AI_ASSET_BUCKET).upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (error) {
        throw new Error(`No se pudo subir ${file.name}: ${error.message}`);
      }

      uploaded.push({ path, name: file.name, type: file.type, size: file.size });
    }

    setUploadedAssets(uploaded);
    return uploaded;
  };

  const buildCampaign = useMutation({
    mutationFn: async () => {
      if (!selectedAdAccount) throw new Error("Selecciona una cuenta publicitaria.");
      if (!strategyKey) throw new Error("Selecciona una estrategia.");

      const assetsToUse = uploadedAssets.length > 0 ? uploadedAssets : await uploadAssets();

      const { data, error } = await supabase.functions.invoke("meta-ai-create-campaign", {
        body: {
          provider,
          ad_account_id: selectedAdAccount,
          strategy_key: strategyKey,
          product_name: productName,
          landing_url: landingUrl,
          budget_daily: budgetDaily,
          countries: countries
            .split(",")
            .map((value) => value.trim().toUpperCase())
            .filter(Boolean),
          extra_context: extraContext,
          asset_paths: assetsToUse.map((item) => item.path),
          create_in_meta: true,
        },
      });

      if (error) throw error;
      return data as { plan?: AiPlanResponse; meta_campaign_id?: string; used_provider?: string };
    },
    onSuccess: (data) => {
      setResult({ plan: data.plan, metaCampaignId: data.meta_campaign_id, provider: data.used_provider });
      toast({
        title: "Campaña creada",
        description: data.meta_campaign_id
          ? `Campaña creada en Meta con ID ${data.meta_campaign_id}.`
          : "Se generó el plan de campaña correctamente.",
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo generar la campaña";
      toast({ title: "Error en campaña IA", description: message });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Campañas de Ads con IA</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sube creativos, elige estrategia y crea campañas directamente en Meta con un flujo automatizado.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          10 estrategias predeterminadas
        </Badge>
      </div>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">1) Contexto comercial y cuenta publicitaria</CardTitle>
          <CardDescription>Define dónde se creará la campaña y qué enfoque estratégico usará la IA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Business Manager</Label>
            <Select
              value={selectedBm ?? ""}
              onValueChange={(value) => {
                setSelectedBm(value);
                setSelectedAdAccount("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona BM" />
              </SelectTrigger>
              <SelectContent>
                {(assets.bms.data ?? []).map((bm) => (
                  <SelectItem key={bm.meta_bm_id} value={bm.meta_bm_id}>
                    {bm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Cuenta publicitaria</Label>
            <Select value={selectedAdAccount} onValueChange={setSelectedAdAccount} disabled={!selectedBm}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona cuenta" />
              </SelectTrigger>
              <SelectContent>
                {filteredAdAccounts.map((account) => (
                  <SelectItem key={account.meta_ad_account_id} value={account.meta_ad_account_id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Estrategia</Label>
            <Select value={strategyKey} onValueChange={setStrategyKey}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona estrategia" />
              </SelectTrigger>
              <SelectContent>
                {CAMPAIGN_STRATEGIES.map((strategy) => (
                  <SelectItem key={strategy.key} value={strategy.key}>
                    {strategy.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Proveedor IA</Label>
            <Select value={provider} onValueChange={(value: "lovable" | "claude") => setProvider(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable">Lovable AI (recomendado)</SelectItem>
                <SelectItem value="claude">Claude API (si está configurada)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">2) Creativos y briefing</CardTitle>
          <CardDescription>Sube imágenes/videos de la campaña y aporta contexto para que la IA optimice la propuesta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="product-name">Producto / servicio</Label>
              <Input id="product-name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Ej: Kit anticaída" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="landing-url">Landing URL</Label>
              <Input id="landing-url" value={landingUrl} onChange={(e) => setLandingUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget-daily">Presupuesto diario (USD)</Label>
              <Input
                id="budget-daily"
                type="number"
                min={5}
                max={100000}
                value={budgetDaily}
                onChange={(e) => setBudgetDaily(Math.max(5, Number(e.target.value) || 20))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="countries">Países objetivo (ISO, separados por coma)</Label>
              <Input id="countries" value={countries} onChange={(e) => setCountries(e.target.value)} placeholder="CO, MX, CL" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="extra-context">Contexto adicional</Label>
            <Textarea
              id="extra-context"
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              placeholder="Promoción activa, ticket promedio, segmento principal, tono de marca, objeciones frecuentes..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ad-assets">Imágenes y videos (máx 10, 20MB cada uno)</Label>
            <Input
              id="ad-assets"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []).slice(0, 10);
                setSelectedFiles(files);
                setUploadedAssets([]);
              }}
            />
            {selectedFiles.length > 0 ? (
              <div className="rounded-lg border bg-secondary/30 p-3 text-xs text-muted-foreground">
                {selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                    {file.type.startsWith("video/") ? <Film className="h-3.5 w-3.5" /> : <ImagePlus className="h-3.5 w-3.5" />}
                    <span className="truncate">{file.name}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="gap-2"
              disabled={selectedFiles.length === 0 || buildCampaign.isPending}
              onClick={async () => {
                try {
                  const uploaded = await uploadAssets();
                  toast({ title: "Assets cargados", description: `${uploaded.length} archivos listos para IA.` });
                } catch (err: unknown) {
                  const message = err instanceof Error ? err.message : "No se pudo subir los archivos";
                  toast({ title: "Error de carga", description: message });
                }
              }}
            >
              <UploadCloud className="h-4 w-4" aria-hidden="true" />
              Subir assets
            </Button>

            <Button
              type="button"
              variant="hero"
              className="gap-2"
              disabled={!selectedAdAccount || selectedFiles.length === 0 || buildCampaign.isPending}
              onClick={() => buildCampaign.mutate()}
            >
              <Brain className="h-4 w-4" aria-hidden="true" />
              {buildCampaign.isPending ? "Analizando y creando…" : "Generar y crear campaña"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">3) Resultado IA</CardTitle>
          <CardDescription>Resumen de decisión de la IA y campaña creada en Meta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!result ? (
            <div className="rounded-lg border bg-secondary/30 p-3 text-muted-foreground">Aún no has generado una campaña IA.</div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Proveedor: {result.provider ?? "lovable"}</Badge>
                {result.metaCampaignId ? <Badge variant="secondary">Meta Campaign ID: {result.metaCampaignId}</Badge> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Nombre campaña</div>
                  <div className="mt-1 font-medium">{result.plan?.campaign_name ?? "—"}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Objetivo</div>
                  <div className="mt-1 font-medium">{result.plan?.objective ?? "—"}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3 md:col-span-2">
                  <div className="text-xs text-muted-foreground">Primary text</div>
                  <div className="mt-1 whitespace-pre-wrap">{result.plan?.primary_text ?? "—"}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">Headline</div>
                  <div className="mt-1">{result.plan?.headline ?? "—"}</div>
                </div>
                <div className="rounded-lg border bg-background/60 p-3">
                  <div className="text-xs text-muted-foreground">CTA</div>
                  <div className="mt-1">{result.plan?.call_to_action ?? "—"}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
