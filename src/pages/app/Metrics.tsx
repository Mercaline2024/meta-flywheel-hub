import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Layers3, Target } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Point = { name: string; value: number };

export default function Metrics() {
  const [range, setRange] = useState("7d");
  const [objective, setObjective] = useState("all");
  const [level, setLevel] = useState<"campaign" | "adset" | "ad">("campaign");

  const data = useMemo<Point[]>(() => {
    const base = range === "30d" ? 22 : range === "14d" ? 14 : 9;
    const mult = objective === "leads" ? 1.1 : objective === "sales" ? 1.25 : 1;
    return Array.from({ length: 10 }).map((_, i) => ({
      name: `D${i + 1}`,
      value: Math.round((base + i * 1.6) * mult + (i % 3) * 2),
    }));
  }, [range, objective]);

  const headline = useMemo(() => {
    if (level === "ad") return "Anuncio";
    if (level === "adset") return "Conjunto";
    return "Campaña";
  }, [level]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas y análisis</h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Visualización por niveles (Campaña → Conjunto → Anuncio) con filtros rápidos.
          </p>
        </div>
        <Badge variant="secondary" className="gap-2">
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Panel modular
        </Badge>
      </div>

      <Card className="mc-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Filtros
          </CardTitle>
          <CardDescription>Atajos para llegar a lo importante sin perder contexto.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Rango</span>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger>
                <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Selecciona rango" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Últimos 7 días</SelectItem>
                <SelectItem value="14d">Últimos 14 días</SelectItem>
                <SelectItem value="30d">Últimos 30 días</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Objetivo</span>
            <Select value={objective} onValueChange={setObjective}>
              <SelectTrigger>
                <Target className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Selecciona objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="leads">Leads</SelectItem>
                <SelectItem value="sales">Ventas</SelectItem>
                <SelectItem value="traffic">Tráfico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground">Nivel</span>
            <Tabs value={level} onValueChange={(v) => setLevel(v as typeof level)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="campaign">Campaña</TabsTrigger>
                <TabsTrigger value="adset">Conjunto</TabsTrigger>
                <TabsTrigger value="ad">Anuncio</TabsTrigger>
              </TabsList>
              <TabsContent value="campaign" />
              <TabsContent value="adset" />
              <TabsContent value="ad" />
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="mc-card lg:col-span-8">
          <CardHeader>
            <CardTitle>Rendimiento · {headline}</CardTitle>
            <CardDescription>Demo: serie temporal basada en los filtros actuales.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 0, right: 12, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="mcArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  fill="url(#mcArea)"
                  strokeWidth={2}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="mc-card lg:col-span-4">
          <CardHeader>
            <CardTitle>Lectura rápida</CardTitle>
            <CardDescription>Lo esencial, sin buscarlo.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-lg border bg-background/60 p-4">
              <div className="text-xs text-muted-foreground">Nivel</div>
              <div className="mt-1 text-sm font-medium">{headline}</div>
            </div>
            <div className="rounded-lg border bg-background/60 p-4">
              <div className="text-xs text-muted-foreground">Rango</div>
              <div className="mt-1 text-sm font-medium">{range === "30d" ? "30 días" : range === "14d" ? "14 días" : "7 días"}</div>
            </div>
            <div className="rounded-lg border bg-background/60 p-4">
              <div className="text-xs text-muted-foreground">Objetivo</div>
              <div className="mt-1 text-sm font-medium">
                {objective === "all" ? "Todos" : objective === "leads" ? "Leads" : objective === "sales" ? "Ventas" : "Tráfico"}
              </div>
            </div>
            <div className="rounded-lg border bg-secondary/40 p-4 text-sm leading-relaxed text-muted-foreground">
              Cuando conectemos la API, este módulo se alimentará de Ads Insights con los mismos filtros.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
