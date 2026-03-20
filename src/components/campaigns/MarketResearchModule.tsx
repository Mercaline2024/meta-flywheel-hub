import { useMutation } from "@tanstack/react-query";
import { Loader2, SearchCheck, Target, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const briefSchema = z.object({
  product_name: z.string().trim().min(2, "Ingresa un producto válido").max(120),
  niche: z.string().trim().min(2, "Ingresa un nicho").max(120),
  target_countries: z.string().trim().min(2, "Ingresa al menos un país"),
  product_price: z
    .string()
    .trim()
    .optional()
    .transform((value) => value ?? ""),
  product_url: z.string().trim().url("URL inválida").optional().or(z.literal("")),
  competitor_urls: z.string().trim().optional().or(z.literal("")),
  value_proposition: z.string().trim().min(8, "Agrega propuesta de valor").max(400),
  customer_notes: z.string().trim().max(800).optional().or(z.literal("")),
});

type BriefFormValues = z.infer<typeof briefSchema>;

type ResearchOutput = {
  brief_id: string;
  run_id: string;
  playbook_id: string;
  synthesis: {
    market_summary?: string;
    buyer_personas?: Array<{ name: string; profile: string; motivations: string[]; objections: string[] }>;
    sales_angles?: string[];
    key_objections?: string[];
  };
  playbook: {
    offer_strategy?: string;
    whatsapp_flow?: {
      opening?: string[];
      qualification?: string[];
      pitch?: string[];
      objection_handling?: string[];
      closing?: string[];
      follow_up?: string[];
    };
    training_notes?: string[];
  };
  sources: Array<{ title: string; type: string; url?: string; snippet: string }>;
};

function parseCommaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseUrlList(value?: string) {
  if (!value) return [];
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export default function MarketResearchModule() {
  const form = useForm<BriefFormValues>({
    resolver: zodResolver(briefSchema),
    defaultValues: {
      product_name: "",
      niche: "",
      target_countries: "CO, MX",
      product_price: "",
      product_url: "",
      competitor_urls: "",
      value_proposition: "",
      customer_notes: "",
    },
  });

  const research = useMutation({
    mutationFn: async (values: BriefFormValues) => {
      const { data, error } = await supabase.functions.invoke("market-research-generate", {
        body: {
          product_name: values.product_name,
          niche: values.niche,
          target_countries: parseCommaList(values.target_countries),
          product_price: values.product_price ? Number(values.product_price) : null,
          product_url: values.product_url || null,
          competitor_urls: parseUrlList(values.competitor_urls),
          value_proposition: values.value_proposition,
          customer_notes: values.customer_notes || null,
        },
      });

      if (error) throw error;
      return data as ResearchOutput;
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo ejecutar la investigación";
      toast({ title: "Error en investigación", description: message });
    },
    onSuccess: () => {
      toast({ title: "Investigación lista", description: "Playbook de WhatsApp generado correctamente." });
    },
  });

  const result = research.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Investigación de mercado IA</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Completa un brief y genera automáticamente buyer persona, ángulos de venta y playbook profesional para WhatsApp.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <SearchCheck className="h-4 w-4" aria-hidden="true" />
          Multi-fuente
        </Badge>
      </div>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">1) Brief del producto</CardTitle>
          <CardDescription>Contexto mínimo para ejecutar investigación y generar estrategia de venta.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((values) => research.mutate(values))} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Producto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Corrector de postura inteligente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="niche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nicho</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej: Salud y bienestar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_countries"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Países objetivo</FormLabel>
                      <FormControl>
                        <Input placeholder="CO, MX, CL" {...field} />
                      </FormControl>
                      <FormDescription>Formato ISO o nombres separados por coma.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="product_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio promedio (opcional)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step="0.01" placeholder="39.9" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="product_url"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>URL del producto (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://tu-tienda.com/producto" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="competitor_urls"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>URLs de competidores (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="https://competidor1.com\nhttps://competidor2.com"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>Separadas por coma o salto de línea.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="value_proposition"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Propuesta de valor</FormLabel>
                      <FormControl>
                        <Textarea rows={3} placeholder="Qué hace diferente tu oferta y por qué deberían comprarte." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customer_notes"
                  render={({ field }) => (
                    <FormItem className="md:col-span-2">
                      <FormLabel>Notas adicionales</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Objeciones comunes, tono de marca, promociones vigentes, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button type="submit" variant="hero" className="gap-2" disabled={research.isPending}>
                {research.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Target className="h-4 w-4" aria-hidden="true" />}
                {research.isPending ? "Investigando mercado…" : "Ejecutar investigación y generar playbook"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="text-base">2) Resultado estratégico</CardTitle>
          <CardDescription>Salida lista para entrenamiento de asistente de ventas por WhatsApp.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {!result ? (
            <div className="rounded-lg border bg-secondary/30 p-3 text-muted-foreground">Aún no hay investigación ejecutada.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Brief: {result.brief_id.slice(0, 8)}</Badge>
                <Badge variant="secondary">Run: {result.run_id.slice(0, 8)}</Badge>
                <Badge variant="secondary">Playbook: {result.playbook_id.slice(0, 8)}</Badge>
              </div>

              <div className="rounded-lg border bg-background/60 p-4">
                <h3 className="font-medium">Resumen de mercado</h3>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{result.synthesis.market_summary ?? "Sin resumen"}</p>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg border bg-background/60 p-4">
                  <h3 className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Buyer persona
                  </h3>
                  <ul className="mt-2 space-y-2 text-muted-foreground">
                    {(result.synthesis.buyer_personas ?? []).slice(0, 3).map((persona, idx) => (
                      <li key={`${persona.name}-${idx}`}>
                        <p className="font-medium text-foreground">{persona.name}</p>
                        <p>{persona.profile}</p>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border bg-background/60 p-4">
                  <h3 className="font-medium">Ángulos de venta</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
                    {(result.synthesis.sales_angles ?? []).map((angle, idx) => (
                      <li key={`${angle}-${idx}`}>{angle}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border bg-background/60 p-4">
                <h3 className="font-medium">Playbook de WhatsApp</h3>
                <p className="mt-2 text-muted-foreground">Oferta recomendada: {result.playbook.offer_strategy ?? "No definida"}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {(
                    [
                      ["Apertura", result.playbook.whatsapp_flow?.opening],
                      ["Calificación", result.playbook.whatsapp_flow?.qualification],
                      ["Pitch", result.playbook.whatsapp_flow?.pitch],
                      ["Manejo de objeciones", result.playbook.whatsapp_flow?.objection_handling],
                      ["Cierre", result.playbook.whatsapp_flow?.closing],
                      ["Seguimiento", result.playbook.whatsapp_flow?.follow_up],
                    ] as Array<[string, string[] | undefined]>
                  ).map(([title, lines]) => (
                    <div key={title} className="rounded-md border bg-secondary/20 p-3">
                      <p className="font-medium">{title}</p>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {lines?.map((line, index) => <li key={`${title}-${index}`}>{line}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border bg-background/60 p-4">
                <h3 className="font-medium">Fuentes utilizadas</h3>
                <ul className="mt-2 space-y-2 text-muted-foreground">
                  {result.sources.map((source, idx) => (
                    <li key={`${source.type}-${idx}`} className="rounded-md border bg-secondary/20 p-2">
                      <p className="font-medium text-foreground">{source.title}</p>
                      <p className="text-xs uppercase tracking-wide">{source.type}</p>
                      {source.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer" className="text-xs underline">
                          {source.url}
                        </a>
                      ) : null}
                      <p className="mt-1 text-xs">{source.snippet}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
