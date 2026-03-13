import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, FileUp, PlayCircle, Send, TimerReset } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useMetaAssets } from "@/lib/meta/useMetaAssets";
import { useMetaWhatsapp } from "@/lib/meta/useMetaWhatsapp";

type ParsedContact = {
  phone: string;
  name?: string;
  opt_in?: boolean;
};

type CampaignApiRow = {
  id: string;
  status: string;
  template_name: string;
  template_language: string;
  scheduled_at: string;
  rate_limit_per_minute: number;
  total_recipients: number;
  stats: {
    pending: number;
    accepted: number;
    failed: number;
    delivered: number;
    read: number;
  };
};

type WhatsappPhoneNumberOption = {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
  status: string;
  name_status: string;
  code_verification_status: string;
  is_send_ready: boolean;
};

function toLocalDatetimeInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseCsvRow(row: string) {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i += 1) {
    const char = row[i];

    if (char === '"') {
      const next = row[i + 1];
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  out.push(current.trim());
  return out;
}

function parseContactsCsv(text: string): ParsedContact[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvRow(lines[0]).map((header) =>
    header
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim(),
  );

  const phoneIndex = headers.findIndex((h) => ["phone", "telefono", "telefono_whatsapp", "whatsapp", "numero"].includes(h));
  const nameIndex = headers.findIndex((h) => ["name", "nombre", "full_name"].includes(h));
  const optInIndex = headers.findIndex((h) => ["opt_in", "optin", "consent", "consentimiento", "autorizado"].includes(h));

  if (phoneIndex < 0) return [];

  return lines.slice(1).flatMap((line) => {
    const cols = parseCsvRow(line);
    const rawPhone = (cols[phoneIndex] ?? "").replace(/[^\d+]/g, "").trim();
    const phone = rawPhone.startsWith("+") ? rawPhone : `+${rawPhone}`;

    if (phone.length < 8 || phone.length > 20) return [];

    const name = nameIndex >= 0 ? (cols[nameIndex] ?? "").trim().slice(0, 120) : "";
    const rawOptIn = (optInIndex >= 0 ? cols[optInIndex] : "true")?.toLowerCase().trim();
    const optIn = !["0", "false", "no", "n"].includes(rawOptIn);

    return [{ phone, name: name || undefined, opt_in: optIn }];
  });
}

export default function WhatsappCampaignScheduler() {
  const queryClient = useQueryClient();

  const [selectedBm, setSelectedBm] = useState<string | null>(null);
  const [selectedWaba, setSelectedWaba] = useState<string | null>(null);
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [rateLimit, setRateLimit] = useState(20);
  const [scheduledAt, setScheduledAt] = useState(() => {
    const date = new Date(Date.now() + 10 * 60_000);
    return toLocalDatetimeInputValue(date);
  });
  const [contacts, setContacts] = useState<ParsedContact[]>([]);
  const [csvFileName, setCsvFileName] = useState("");

  const assets = useMetaAssets(null);
  const wa = useMetaWhatsapp(selectedBm, selectedWaba);

  const campaignsQuery = useQuery({
    queryKey: ["whatsapp", "scheduled-campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-list-scheduled-campaigns", { body: {} });
      if (error) throw error;
      return ((data?.campaigns ?? []) as CampaignApiRow[]).map((campaign) => ({
        ...campaign,
        stats: campaign.stats ?? { pending: 0, accepted: 0, failed: 0, delivered: 0, read: 0 },
      }));
    },
    refetchInterval: 10000,
  });

  const phoneNumbersQuery = useQuery({
    queryKey: ["whatsapp", "phone-numbers", selectedWaba ?? "none"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-list-phone-numbers", {
        body: { waba_id: selectedWaba },
      });
      if (error) throw error;
      return (data?.phone_numbers ?? []) as WhatsappPhoneNumberOption[];
    },
    enabled: !!selectedWaba,
  });

  const createCampaign = useMutation({
    mutationFn: async () => {
      const scheduledIso = new Date(scheduledAt).toISOString();

      const { data, error } = await supabase.functions.invoke("whatsapp-create-scheduled-campaign", {
        body: {
          waba_id: selectedWaba,
          phone_number_id: phoneNumberId,
          template_name: selectedTemplateName,
          template_language: "es",
          scheduled_at: scheduledIso,
          rate_limit_per_minute: rateLimit,
          contacts,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Campaña programada", description: "La campaña quedó lista para ejecutarse por minuto según tu límite." });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "scheduled-campaigns"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo crear la campaña";
      toast({ title: "Error al programar", description: message });
    },
  });

  const dispatchNow = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("whatsapp-dispatch-scheduled", { body: { manual: true } });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Despacho ejecutado", description: "Se procesó un ciclo inmediato de envíos." });
      queryClient.invalidateQueries({ queryKey: ["whatsapp", "scheduled-campaigns"] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : "No se pudo ejecutar el despacho";
      toast({ title: "Error en despacho", description: message });
    },
  });

  const templates = wa.templates.data ?? [];
  const phoneNumbers = phoneNumbersQuery.data ?? [];
  const sendReadyPhoneNumbers = useMemo(
    () => phoneNumbers.filter((phoneNumber) => phoneNumber.is_send_ready),
    [phoneNumbers],
  );

  const canCreate = Boolean(selectedWaba && selectedTemplateName && phoneNumberId.trim() && contacts.length > 0 && scheduledAt);

  const campaigns = campaignsQuery.data ?? [];
  const totals = useMemo(() => {
    return campaigns.reduce(
      (acc, row) => {
        acc.pending += row.stats.pending;
        acc.accepted += row.stats.accepted;
        acc.delivered += row.stats.delivered + row.stats.read;
        acc.failed += row.stats.failed;
        return acc;
      },
      { pending: 0, accepted: 0, delivered: 0, failed: 0 },
    );
  }, [campaigns]);

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="space-y-6 lg:col-span-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Campañas programadas de WhatsApp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sube CSV, elige plantilla Meta y programa envíos con límite por minuto.
            </p>
          </div>
          <Badge variant="secondary" className="gap-2">
            <TimerReset className="h-4 w-4" aria-hidden="true" />
            {totals.pending} pendientes
          </Badge>
        </div>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="text-base">1) Contexto Meta</CardTitle>
            <CardDescription>Selecciona BM, WABA y la plantilla aprobada a enviar.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Business Manager</Label>
              <Select
                value={selectedBm ?? ""}
                onValueChange={(value) => {
                  setSelectedBm(value);
                  setSelectedWaba(null);
                  setSelectedTemplateName("");
                  setPhoneNumberId("");
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
              <Label>WABA</Label>
              <Select
                value={selectedWaba ?? ""}
                onValueChange={(value) => {
                  setSelectedWaba(value);
                  setSelectedTemplateName("");
                  setPhoneNumberId("");
                }}
                disabled={!selectedBm}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona WABA" />
                </SelectTrigger>
                <SelectContent>
                  {(wa.wabas.data ?? []).map((waba) => (
                    <SelectItem key={waba.waba_id} value={waba.waba_id}>
                      {waba.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Plantilla Meta</Label>
              <Select value={selectedTemplateName} onValueChange={setSelectedTemplateName} disabled={!selectedWaba}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona plantilla" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={`${template.template_name}:${template.language}`} value={template.template_name}>
                      {template.template_name} ({template.language})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="text-base">2) Programación y base de datos CSV</CardTitle>
            <CardDescription>Formato mínimo del CSV: columnas phone y name (opcional opt_in).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Número de WhatsApp remitente</Label>
                <Select
                  value={phoneNumberId}
                  onValueChange={setPhoneNumberId}
                  disabled={!selectedWaba || phoneNumbersQuery.isLoading || sendReadyPhoneNumbers.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedWaba
                          ? "Selecciona WABA primero"
                          : phoneNumbersQuery.isLoading
                            ? "Cargando números..."
                            : sendReadyPhoneNumbers.length === 0
                              ? "Sin números aptos para envío"
                              : "Selecciona número remitente"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sendReadyPhoneNumbers.map((number) => (
                      <SelectItem key={number.id} value={number.id}>
                        {number.display_phone_number || number.id}
                        {number.verified_name ? ` · ${number.verified_name}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedWaba && !phoneNumbersQuery.isLoading && sendReadyPhoneNumbers.length === 0 ? (
                  <div className="text-xs text-muted-foreground">No hay números conectados y aptos para enviar en este WABA.</div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="scheduled-at">Fecha/hora de inicio</Label>
                <Input
                  id="scheduled-at"
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(event) => setScheduledAt(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rate-limit">Límite por minuto</Label>
                <Input
                  id="rate-limit"
                  type="number"
                  min={1}
                  max={1000}
                  value={rateLimit}
                  onChange={(event) => setRateLimit(Math.max(1, Math.min(1000, Number(event.target.value) || 20)))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-upload">CSV de contactos</Label>
              <Input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;

                  const csvText = await file.text();
                  const parsed = parseContactsCsv(csvText);
                  setContacts(parsed);
                  setCsvFileName(file.name);

                  if (parsed.length === 0) {
                    toast({ title: "CSV inválido", description: "Debe incluir una columna phone y al menos una fila válida." });
                  } else {
                    toast({ title: "CSV cargado", description: `${parsed.length} contactos válidos listos para envío.` });
                  }
                }}
              />
              {csvFileName ? <div className="text-xs text-muted-foreground">Archivo: {csvFileName}</div> : null}
            </div>

            <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
              Vista previa: {contacts.length} contactos cargados.
              {contacts.length > 0 ? (
                <div className="mt-2 space-y-1">
                  {contacts.slice(0, 4).map((contact) => (
                    <div key={`${contact.phone}-${contact.name ?? ""}`}>• {contact.phone} {contact.name ? `— ${contact.name}` : ""}</div>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="success"
                disabled={!canCreate || createCampaign.isPending}
                onClick={() => createCampaign.mutate()}
                className="gap-2"
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                {createCampaign.isPending ? "Programando…" : "Programar campaña"}
              </Button>
              <Button variant="secondary" onClick={() => dispatchNow.mutate()} disabled={dispatchNow.isPending} className="gap-2">
                <PlayCircle className="h-4 w-4" aria-hidden="true" />
                Probar ciclo ahora
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="mc-card">
          <CardHeader>
            <CardTitle className="text-base">3) Estado de campañas</CardTitle>
            <CardDescription>Se guarda estado API (aceptado/fallido) y estado final (entregado/leído).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {campaigns.length === 0 ? (
              <div className="rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground">
                No hay campañas aún.
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="rounded-lg border bg-background/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{campaign.template_name}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(campaign.scheduled_at).toLocaleString()} · {campaign.rate_limit_per_minute}/min · {campaign.total_recipients} contactos
                      </div>
                    </div>
                    <Badge variant="secondary">{campaign.status}</Badge>
                  </div>

                  <Separator className="my-3" />

                  <div className="grid gap-2 text-xs sm:grid-cols-4">
                    <div className="rounded-lg border bg-secondary/30 p-2">Pendientes: {campaign.stats.pending}</div>
                    <div className="rounded-lg border bg-secondary/30 p-2">Aceptados API: {campaign.stats.accepted}</div>
                    <div className="rounded-lg border bg-secondary/30 p-2">Entregados/Leídos: {campaign.stats.delivered + campaign.stats.read}</div>
                    <div className="rounded-lg border bg-secondary/30 p-2">Fallidos: {campaign.stats.failed}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <aside className="space-y-4 lg:col-span-4">
        <Card className="mc-card sticky top-20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Send className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              Resumen de despacho
            </CardTitle>
            <CardDescription>Monitoreo rápido del pipeline programado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">Pendientes</div>
                <div className="mt-1 text-lg font-semibold">{totals.pending}</div>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">Aceptados API</div>
                <div className="mt-1 text-lg font-semibold">{totals.accepted}</div>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">Entregados/Leídos</div>
                <div className="mt-1 text-lg font-semibold">{totals.delivered}</div>
              </div>
              <div className="rounded-lg border bg-background/60 p-3">
                <div className="text-xs text-muted-foreground">Fallidos</div>
                <div className="mt-1 text-lg font-semibold">{totals.failed}</div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileUp className="h-3.5 w-3.5" aria-hidden="true" />
                CSV con columna <strong>phone</strong> obligatoria.
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Cumplimiento: se omiten contactos sin opt-in.
              </div>
            </div>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
