-- Briefs submitted by each authenticated user
CREATE TABLE IF NOT EXISTS public.market_research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  product_name TEXT NOT NULL,
  niche TEXT NOT NULL,
  target_countries TEXT[] NOT NULL DEFAULT '{}'::text[],
  product_price NUMERIC(12,2),
  product_url TEXT,
  competitor_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  value_proposition TEXT,
  customer_notes TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_research_briefs_user_id ON public.market_research_briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_market_research_briefs_status ON public.market_research_briefs(status);

ALTER TABLE public.market_research_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own market_research_briefs"
ON public.market_research_briefs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "No direct writes to market_research_briefs"
ON public.market_research_briefs
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct updates to market_research_briefs"
ON public.market_research_briefs
FOR UPDATE
USING (false);

CREATE POLICY "No direct deletes to market_research_briefs"
ON public.market_research_briefs
FOR DELETE
USING (false);

CREATE TRIGGER update_market_research_briefs_updated_at
BEFORE UPDATE ON public.market_research_briefs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Research execution runs and collected evidence
CREATE TABLE IF NOT EXISTS public.market_research_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES public.market_research_briefs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  source_count INTEGER NOT NULL DEFAULT 0,
  sources JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthesis JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_research_runs_brief_id ON public.market_research_runs(brief_id);
CREATE INDEX IF NOT EXISTS idx_market_research_runs_user_id ON public.market_research_runs(user_id);

ALTER TABLE public.market_research_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own market_research_runs"
ON public.market_research_runs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "No direct writes to market_research_runs"
ON public.market_research_runs
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct updates to market_research_runs"
ON public.market_research_runs
FOR UPDATE
USING (false);

CREATE POLICY "No direct deletes to market_research_runs"
ON public.market_research_runs
FOR DELETE
USING (false);

CREATE TRIGGER update_market_research_runs_updated_at
BEFORE UPDATE ON public.market_research_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Final playbook to train WhatsApp sales assistants
CREATE TABLE IF NOT EXISTS public.whatsapp_sales_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id UUID NOT NULL REFERENCES public.market_research_briefs(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.market_research_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  playbook JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sales_playbooks_brief_id ON public.whatsapp_sales_playbooks(brief_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sales_playbooks_run_id ON public.whatsapp_sales_playbooks(run_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sales_playbooks_user_id ON public.whatsapp_sales_playbooks(user_id);

ALTER TABLE public.whatsapp_sales_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own whatsapp_sales_playbooks"
ON public.whatsapp_sales_playbooks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "No direct writes to whatsapp_sales_playbooks"
ON public.whatsapp_sales_playbooks
FOR INSERT
WITH CHECK (false);

CREATE POLICY "No direct updates to whatsapp_sales_playbooks"
ON public.whatsapp_sales_playbooks
FOR UPDATE
USING (false);

CREATE POLICY "No direct deletes to whatsapp_sales_playbooks"
ON public.whatsapp_sales_playbooks
FOR DELETE
USING (false);

CREATE TRIGGER update_whatsapp_sales_playbooks_updated_at
BEFORE UPDATE ON public.whatsapp_sales_playbooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();