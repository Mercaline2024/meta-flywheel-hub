import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type MetaCampaign = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  effective_status?: string;
};

async function fetchCampaigns(adAccountIds: string[]) {
  const { data, error } = await supabase.functions.invoke("meta-list-campaigns", {
    body: { ad_account_ids: adAccountIds },
  });
  if (error) throw error;
  const campaigns = (data as any)?.campaigns as MetaCampaign[] | undefined;
  return campaigns ?? [];
}

export function useMetaCampaigns(adAccountIds: string[]) {
  const enabled = adAccountIds.length > 0;

  return useQuery({
    queryKey: ["meta", "campaigns", adAccountIds.slice().sort().join(",")],
    queryFn: () => fetchCampaigns(adAccountIds),
    enabled,
    staleTime: 30_000,
  });
}
