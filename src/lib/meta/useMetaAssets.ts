import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type MetaBusinessManager = {
  id: string;
  meta_bm_id: string;
  name: string;
};

export type MetaAdAccount = {
  id: string;
  meta_ad_account_id: string;
  name: string;
  meta_bm_id: string | null;
};

async function syncAssets() {
  const { error } = await supabase.functions.invoke("meta-sync-assets", { body: {} });
  if (error) throw error;
  return true;
}

async function fetchBms(): Promise<MetaBusinessManager[]> {
  const { data, error } = await supabase
    .from("meta_business_managers")
    .select("id, meta_bm_id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

async function fetchAdAccounts(metaBmId?: string | null): Promise<MetaAdAccount[]> {
  const q = supabase
    .from("meta_ad_accounts")
    .select("id, meta_ad_account_id, name, meta_bm_id")
    .order("name", { ascending: true });

  const { data, error } = metaBmId ? await q.eq("meta_bm_id", metaBmId) : await q;
  if (error) throw error;
  return data ?? [];
}

export function useMetaAssets(metaBmId?: string | null) {
  const qc = useQueryClient();

  const sync = useMutation({
    mutationFn: syncAssets,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meta", "bms"] });
      qc.invalidateQueries({ queryKey: ["meta", "ad-accounts"] });
    },
  });

  const bms = useQuery({
    queryKey: ["meta", "bms"],
    queryFn: fetchBms,
  });

  const adAccounts = useQuery({
    queryKey: ["meta", "ad-accounts", metaBmId ?? "all"],
    queryFn: () => fetchAdAccounts(metaBmId),
  });

  return {
    syncing: sync.isPending,
    syncError: sync.error,
    syncAssets: sync.mutateAsync,
    bms,
    adAccounts,
  };
}
