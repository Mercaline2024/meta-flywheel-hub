import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type MetaWhatsappBusinessAccount = {
  id: string;
  meta_bm_id: string;
  waba_id: string;
  name: string;
};

export type MetaWhatsappTemplate = {
  id: string;
  waba_id: string;
  template_name: string;
  language: string;
  category: string | null;
  status: string | null;
  components: unknown;
  raw: unknown;
};

async function fetchWabas(metaBmId: string | null): Promise<MetaWhatsappBusinessAccount[]> {
  if (!metaBmId) return [];

  const { data, error } = await supabase
    .from("meta_whatsapp_business_accounts")
    .select("id, meta_bm_id, waba_id, name")
    .eq("meta_bm_id", metaBmId)
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

async function fetchTemplates(wabaId: string | null): Promise<MetaWhatsappTemplate[]> {
  if (!wabaId) return [];

  const { data, error } = await supabase
    .from("meta_whatsapp_templates")
    .select("id, waba_id, template_name, language, category, status, components, raw")
    .eq("waba_id", wabaId)
    .order("template_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function useMetaWhatsapp(metaBmId: string | null, wabaId: string | null) {
  const wabas = useQuery({
    queryKey: ["meta", "wabas", metaBmId ?? "none"],
    queryFn: () => fetchWabas(metaBmId),
    enabled: !!metaBmId,
  });

  const templates = useQuery({
    queryKey: ["meta", "wa-templates", wabaId ?? "none"],
    queryFn: () => fetchTemplates(wabaId),
    enabled: !!wabaId,
  });

  return { wabas, templates };
}
