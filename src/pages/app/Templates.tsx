import { useMemo, useState } from "react";
import { MessageSquareText, RefreshCw, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMetaAssets } from "@/lib/meta/useMetaAssets";
import { useMetaWhatsapp } from "@/lib/meta/useMetaWhatsapp";

type TemplateButtonPreset =
  | {
      type: "URL";
      text: string;
      url: string;
    }
  | {
      type: "QUICK_REPLY";
      text: string;
    };

type TemplatePreset = {
  id: string;
  category: "Promoción" | "Recordatorio" | "Soporte";
  title: string;
  preview: string;
  footerText?: string;
  headerVideoUrl?: string;
  buttons?: TemplateButtonPreset[];
};

const presets: TemplatePreset[] = [
  {
    id: "luisa-v1",
    category: "Promoción",
    title: "Mnesaje Profe luisa V1",
    preview:
      "Hola 👋\n\nSoy La Profe Luisa, docente 📚 y empresaria santandereana.\n\nLlevo 20 años trabajando por la educación y el emprendimiento sostenible.\n\nQuiero con tu apoyo, trabajar desde el Congreso 🏛️ por más oportunidades para nuestra región 🤝.\n\nEste 8 de marzo 🗳️ pide el tarjetón a la Cámara de Representantes, marca la letra L del Partido Liberal y el número 102 ✅.",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
  {
    id: "luisa-v2",
    category: "Promoción",
    title: "Mensaje Profe Luisa V2",
    preview:
      "Hola 👋\nSoy Luisa Hernández, docente 📚 y empresaria santandereana con 20 años trabajando por la educación y el emprendimiento sostenible.\nTengo una propuesta concreta para llevar más oportunidades a nuestra región 🏛️\nSantander merece una voz comprometida con su gente 🤝🌿",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
  {
    id: "luisa-v3",
    category: "Promoción",
    title: "Mensaje Profe Luisa V3",
    preview:
      "Hola 👋\nSoy La Profe Luisa 📚\n20 años en educación y emprendimiento me han enseñado que Santander tiene todo para crecer 🌿\nHoy doy el paso más importante de mi vida para trabajar desde adentro por nuestra gente 🏛️🤝\n¿Me acompañas en este camino?",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
  {
    id: "luisa-v4",
    category: "Promoción",
    title: "Mensaje Profe Luisa V4",
    preview:
      "Hola 👋\nSoy La Profe Luisa, docente 📚 y empresaria santandereana.\nLlevo 20 años trabajando por la educación y el emprendimiento de nuestra región 🌿\nEste marzo tengo algo importante que contarte sobre el futuro de Santander 🏛️\nCon tu apoyo podemos lograr mucho más 🤝",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
  {
    id: "luisa-v5",
    category: "Promoción",
    title: "Mensaje Profe Luisa V5",
    preview:
      "Hola 👋\nSoy La Profe Luisa, docente 📚 y empresaria santandereana.\nLlevo 20 años trabajando por la educación y el emprendimiento sostenible de nuestra región.\nQuiero con tu apoyo llevar la voz de Santander al Congreso 🏛️ para abrir más oportunidades para nuestra gente 🤝🌿",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
  {
    id: "luisa-v6",
    category: "Promoción",
    title: "Mensaje Profe Luisa V6",
    preview:
      "Hola 👋\nSoy Luisa Hernández, docente 📚 y empresaria santandereana.\nLlevo 20 años construyendo oportunidades desde la educación y el emprendimiento en nuestra región.\nHoy quiero compartirte mi visión para el futuro de Santander 🌿\n¿Te gustaría conocer más sobre este proyecto de transformación regional? 🤝",
    footerText: "Conoce más de mí",
    headerVideoUrl: "https://upload.ecomdrop.io/images/2026/03/04/VIDEO-FINAL-ELEJIDA.mp4",
    buttons: [
      { type: "QUICK_REPLY", text: "Conóceme" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
];

const recommendedOrder = ["luisa-v6", "luisa-v3", "luisa-v2", "luisa-v5", "luisa-v4", "luisa-v1"];

function mapCategoryToMeta(category: TemplatePreset["category"]) {
  switch (category) {
    case "Soporte":
      return "UTILITY" as const;
    case "Recordatorio":
      return "UTILITY" as const;
    case "Promoción":
    default:
      return "MARKETING" as const;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("Timeout al crear plantilla en Meta")), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
}

export default function Templates() {
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [creatingBatch, setCreatingBatch] = useState(false);
  const [selectedPresetIds, setSelectedPresetIds] = useState<string[]>(() => presets.map((preset) => preset.id));
  const [selectedBm, setSelectedBm] = useState<string | null>(null);
  const [selectedWaba, setSelectedWaba] = useState<string | null>(null);

  const assets = useMetaAssets(null);
  const wa = useMetaWhatsapp(selectedBm, selectedWaba);

  const selectedCount = selectedPresetIds.length;

  const templatesToCreate = useMemo(() => {
    const selected = presets.filter((preset) => selectedPresetIds.includes(preset.id));
    const ordered = recommendedOrder
      .map((id) => selected.find((preset) => preset.id === id))
      .filter((preset): preset is TemplatePreset => Boolean(preset));

    const missing = selected.filter((preset) => !recommendedOrder.includes(preset.id));
    return [...ordered, ...missing];
  }, [selectedPresetIds]);

  const sync = async () => {
    try {
      await assets.syncAssets();
      toast({ title: "Sincronización completada", description: "Activos y plantillas actualizados." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo sincronizar";
      toast({ title: "Error al sincronizar", description: message });
    }
  };

  const createTemplateWithRetry = async (template: TemplatePreset) => {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const invokePromise = supabase.functions.invoke("meta-create-whatsapp-template", {
          body: {
            waba_id: selectedWaba,
            name: template.title,
            category: mapCategoryToMeta(template.category),
            language: "es",
            body_text: template.preview,
            footer_text: template.footerText,
            header_video_url: template.headerVideoUrl,
            buttons: template.buttons,
          },
        });

        const { data, error } = await withTimeout(invokePromise, 45000);
        if (error) throw error;

        return data;
      } catch (error) {
        if (attempt === maxAttempts) throw error;
        await sleep(1200 * attempt);
      }
    }
  };

  const createSelectedTemplates = async () => {
    if (!selectedWaba) {
      toast({ title: "Selecciona un WABA", description: "Primero elige BM → WABA para crear plantillas." });
      return;
    }

    if (templatesToCreate.length === 0) {
      toast({ title: "Sin selección", description: "Selecciona al menos una plantilla." });
      return;
    }

    setCreatingBatch(true);
    let ok = 0;
    const failed: string[] = [];

    try {
      for (const template of templatesToCreate) {
        setCreatingId(template.id);

        try {
          await createTemplateWithRetry(template);
          ok += 1;
        } catch {
          failed.push(template.title);
        }
      }

      await wa.templates.refetch();

      toast({
        title: failed.length === 0 ? "Plantillas creadas" : "Creación completada con incidencias",
        description:
          failed.length === 0
            ? `Se crearon ${ok} plantillas.`
            : `Creadas: ${ok}. Fallaron: ${failed.length} (${failed.join(", ")}).`,
      });
    } finally {
      setCreatingBatch(false);
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de WhatsApp</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Selecciona un Business Manager y un WABA para previsualizar y crear plantillas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-2">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            {(wa.templates.data?.length ?? 0).toString()} sincronizadas
          </Badge>
          <Button variant="secondary" onClick={sync} disabled={assets.syncing || creatingBatch} className="gap-2">
            <RefreshCw className={assets.syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
            {assets.syncing ? "Sincronizando…" : "Sincronizar"}
          </Button>
        </div>
      </div>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">Contexto de WhatsApp</CardTitle>
          <CardDescription>Elige BM → WABA para filtrar plantillas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-medium">Business Manager</div>
            <Select
              value={selectedBm ?? ""}
              onValueChange={(v) => {
                setSelectedBm(v);
                setSelectedWaba(null);
              }}
              disabled={assets.bms.isLoading || (assets.bms.data?.length ?? 0) === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={assets.bms.isLoading ? "Cargando…" : "Selecciona un BM"} />
              </SelectTrigger>
              <SelectContent>
                {(assets.bms.data ?? []).map((bm) => (
                  <SelectItem key={bm.meta_bm_id} value={bm.meta_bm_id}>
                    {bm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {assets.bms.isError ? <div className="text-xs text-muted-foreground">No se pudo cargar BMs.</div> : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">WhatsApp Business Account (WABA)</div>
            <Select
              value={selectedWaba ?? ""}
              onValueChange={(v) => setSelectedWaba(v)}
              disabled={!selectedBm || wa.wabas.isLoading || (wa.wabas.data?.length ?? 0) === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={!selectedBm ? "Selecciona un BM primero" : wa.wabas.isLoading ? "Cargando…" : "Selecciona un WABA"}
                />
              </SelectTrigger>
              <SelectContent>
                {(wa.wabas.data ?? []).map((w) => (
                  <SelectItem key={w.waba_id} value={w.waba_id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBm && wa.wabas.isError ? (
              <div className="text-xs text-muted-foreground">No se pudo cargar WABAs.</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {selectedWaba ? (
        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="text-base">Plantillas sincronizadas</CardTitle>
            <CardDescription>Estado actual según la última sincronización.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(wa.templates.data ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No hay plantillas para este WABA. Pulsa “Sincronizar”.</div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {(wa.templates.data ?? []).map((tpl) => (
                  <Card key={tpl.id} className="mc-card">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{tpl.template_name}</CardTitle>
                          <CardDescription className="mt-1">{tpl.language}</CardDescription>
                        </div>
                        <Badge variant="secondary" className="gap-2">
                          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                          {(tpl.status ?? "unknown").toString()}
                        </Badge>
                      </div>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="mc-card">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Variaciones listas para crear</CardTitle>
              <CardDescription>Selecciona manualmente o crea todas con un solo botón.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{selectedCount} seleccionadas</Badge>
              <Button
                variant="outline"
                onClick={() => setSelectedPresetIds([])}
                disabled={creatingBatch || selectedPresetIds.length === 0}
              >
                Limpiar
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedPresetIds(presets.map((preset) => preset.id))}
                disabled={creatingBatch || selectedPresetIds.length === presets.length}
              >
                Seleccionar todas
              </Button>
              <Button
                variant="success"
                onClick={createSelectedTemplates}
                disabled={!selectedWaba || creatingBatch || selectedCount === 0}
              >
                {creatingBatch ? "Creando plantillas…" : "CREAR PLANTILLAS"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {creatingBatch && creatingId ? (
            <div className="text-xs text-muted-foreground">
              Procesando: {presets.find((preset) => preset.id === creatingId)?.title ?? "Plantilla"}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            {presets.map((template) => {
              const checked = selectedPresetIds.includes(template.id);

              return (
                <Card key={template.id} className="mc-card overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{template.title}</CardTitle>
                        <CardDescription className="mt-1">Preset marketing</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="gap-2">
                          <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                          {template.category}
                        </Badge>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => {
                            const shouldSelect = value === true;
                            setSelectedPresetIds((prev) => {
                              if (shouldSelect) return prev.includes(template.id) ? prev : [...prev, template.id];
                              return prev.filter((id) => id !== template.id);
                            });
                          }}
                          aria-label={`Seleccionar ${template.title}`}
                          disabled={creatingBatch}
                        />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-background/60 p-4 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                      {template.preview}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {template.footerText ? `Footer: ${template.footerText}` : "Sin footer"}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
