import { useMemo, useState } from "react";
import { CheckCircle2, MessageSquareText, Tag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

type Template = {
  id: string;
  category: "Promoción" | "Recordatorio" | "Soporte";
  title: string;
  preview: string;
};

const demoTemplates: Template[] = [
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
];

export default function Templates() {
  const [creatingId, setCreatingId] = useState<string | null>(null);

  const byCategory = useMemo(() => {
    const groups: Record<string, Template[]> = { Promoción: [], Recordatorio: [], Soporte: [] };
    for (const t of demoTemplates) groups[t.category].push(t);
    return groups;
  }, []);

  const createTemplate = async (t: Template) => {
    setCreatingId(t.id);
    // demo latency
    await new Promise((r) => setTimeout(r, 650));
    setCreatingId(null);

    toast({
      title: "Plantilla creada exitosamente en Meta (demo)",
      description: `"${t.title}" quedó lista para usar. Al conectar la API, esto se creará de verdad.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Plantillas de WhatsApp</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Galería por categoría. Un clic para ejecutar la creación vía API.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <MessageSquareText className="h-4 w-4" aria-hidden="true" />
          {demoTemplates.length} disponibles
        </Badge>
      </div>

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
                        <CardDescription className="mt-1">Plantilla {category.toLowerCase()}</CardDescription>
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
                        {creatingId === t.id ? "Enviando a Meta…" : "Listo para ejecutar"}
                      </div>
                      <Button
                        variant={creatingId === t.id ? "secondary" : "success"}
                        onClick={() => createTemplate(t)}
                        disabled={creatingId !== null}
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
