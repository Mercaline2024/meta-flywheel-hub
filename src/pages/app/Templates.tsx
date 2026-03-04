import { useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, RefreshCw, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  headerVideoUrl?: string;
  buttons?: TemplateButtonPreset[];
};

const presets: TemplatePreset[] = [
  {
    id: "t1",
    category: "Promoción",
    title: "Promo limitada",
    preview: "Hola {{1}}, hoy tienes 15% OFF. ¿Te lo reservo?",
  },
  {
    id: "t2",
    category: "Recordatorio",
    title: "Seguimiento 24h",
    preview: "Hola {{1}}, ¿pudiste revisar la propuesta? Estoy listo para ayudarte.",
  },
  {
    id: "t3",
    category: "Soporte",
    title: "Ticket recibido",
    preview: "Recibimos tu solicitud. Te respondemos en menos de 2 horas hábiles.",
  },
  {
    id: "t4",
    category: "Promoción",
    title: "Carrito abandonado",
    preview: "Vimos que dejaste productos en tu carrito. ¿Te ayudo a finalizar?",
  },
  {
    id: "t5",
    category: "Promoción",
    title: "Mensaje especial Luisa Hernández",
    preview:
      "Hola {{1}} 👋 Soy Luisa Hernández, docente 📚 y empresaria santandereana con 20 años transformando vidas desde la educación y el emprendimiento. Hoy quiero compartirte algo importante para nuestra región 🌿 ¿No deseas recibir más mensajes? Responde STOP y te eliminamos de inmediato ✅",
    buttons: [
      { type: "URL", text: "Conoceme", url: "https://linktr.ee/laprofeluisa" },
      { type: "QUICK_REPLY", text: "STOP Darme de baja" },
    ],
  },
];

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

export default function Templates() {
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [selectedBm, setSelectedBm] = useState<string | null>(null);
  const [selectedWaba, setSelectedWaba] = useState<string | null>(null);

  const assets = useMetaAssets(null);
  const wa = useMetaWhatsapp(selectedBm, selectedWaba);

  const byCategory = useMemo(() => {
    const groups: Record<string, TemplatePreset[]> = { Promoción: [], Recordatorio: [], Soporte: [] };
    for (const t of presets) groups[t.category].push(t);
    return groups;
  }, []);

  const sync = async () => {
    try {
      await assets.syncAssets();
      toast({ title: "Sincronización completada", description: "Activos y plantillas actualizados." });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo sincronizar";
      toast({ title: "Error al sincronizar", description: message });
    }
  };

  const createTemplate = async (t: TemplatePreset) => {
    if (!selectedWaba) {
      toast({ title: "Selecciona un WABA", description: "Primero elige BM → WABA para crear plantillas." });
      return;
    }

    setCreatingId(t.id);
    try {
      const { data, error } = await supabase.functions.invoke("meta-create-whatsapp-template", {
        body: {
          waba_id: selectedWaba,
          name: t.title,
          category: mapCategoryToMeta(t.category),
          language: "es",
          body_text: t.preview,
          header_video_url: t.headerVideoUrl,
          buttons: t.buttons,
        },
      });
      if (error) throw error;

      toast({
        title: "Plantilla enviada a Meta",
        description: `Se solicitó la creación. Respuesta: ${JSON.stringify((data as any) ?? {})}`,
      });

      // refresh list
      await wa.templates.refetch();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "No se pudo crear la plantilla";
      toast({ title: "Error al crear plantilla", description: message });
    } finally {
      setCreatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de WhatsApp</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Selecciona un Business Manager y un WABA para ver las plantillas sincronizadas y crear nuevas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="gap-2">
            <MessageSquareText className="h-4 w-4" aria-hidden="true" />
            {(wa.templates.data?.length ?? 0).toString()} sincronizadas
          </Badge>
          <Button variant="secondary" onClick={sync} disabled={assets.syncing} className="gap-2">
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
            {assets.bms.isError ? (
              <div className="text-xs text-muted-foreground">No se pudo cargar BMs.</div>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="text-sm font-medium">WhatsApp Business Account (WABA)</div>
            <Select
              value={selectedWaba ?? ""}
              onValueChange={(v) => setSelectedWaba(v)}
              disabled={!selectedBm || wa.wabas.isLoading || (wa.wabas.data?.length ?? 0) === 0}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={!selectedBm ? "Selecciona un BM primero" : wa.wabas.isLoading ? "Cargando…" : "Selecciona un WABA"} />
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

      <Tabs defaultValue="Promoción" className="w-full">
        <TabsList>
          <TabsTrigger value="Promoción">Promoción</TabsTrigger>
          <TabsTrigger value="Recordatorio">Recordatorio</TabsTrigger>
          <TabsTrigger value="Soporte">Soporte</TabsTrigger>
        </TabsList>

        {Object.entries(byCategory).map(([category, templates]) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((t) => (
                <Card key={t.id} className="mc-card overflow-hidden">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{t.title}</CardTitle>
                        <CardDescription className="mt-1">Preset {category.toLowerCase()}</CardDescription>
                      </div>
                      <Badge variant="secondary" className="gap-2">
                        <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                        {category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-lg border bg-background/60 p-4 text-sm leading-relaxed text-muted-foreground">
                      {t.preview}
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        {!selectedWaba
                          ? "Selecciona BM → WABA para habilitar"
                          : creatingId === t.id
                            ? "Enviando a Meta…"
                            : "Listo para ejecutar"}
                      </div>
                      <Button
                        variant={creatingId === t.id ? "secondary" : "success"}
                        onClick={() => createTemplate(t)}
                        disabled={creatingId !== null || !selectedWaba}
                      >
                        <CheckCircle2 aria-hidden="true" />
                        Crear
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
