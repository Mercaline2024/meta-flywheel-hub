-- Campaigns for scheduled WhatsApp template sending
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'es',
  scheduled_at TIMESTAMPTZ NOT NULL,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 20 CHECK (rate_limit_per_minute > 0 AND rate_limit_per_minute <= 1000),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'running', 'completed', 'paused', 'failed')),
  total_recipients INTEGER NOT NULL DEFAULT 0,
  sent_api_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_user_id ON public.whatsapp_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaigns_status_scheduled_at ON public.whatsapp_campaigns(status, scheduled_at);

-- Recipients per campaign (from uploaded CSV)
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phone_number TEXT NOT NULL,
  full_name TEXT,
  opt_in BOOLEAN NOT NULL DEFAULT true,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_api TEXT NOT NULL DEFAULT 'pending' CHECK (status_api IN ('pending', 'accepted', 'failed')),
  status_delivery TEXT NOT NULL DEFAULT 'unknown' CHECK (status_delivery IN ('unknown', 'sent', 'delivered', 'read', 'failed')),
  meta_message_id TEXT,
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_campaign_id ON public.whatsapp_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_pending ON public.whatsapp_campaign_recipients(campaign_id, status_api, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_meta_message_id ON public.whatsapp_campaign_recipients(meta_message_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_campaign_recipients_user_id ON public.whatsapp_campaign_recipients(user_id);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

-- Read-only from client; writes only through backend functions
DROP POLICY IF EXISTS "Users can view own whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Users can view own whatsapp_campaigns"
ON public.whatsapp_campaigns
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct writes to whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "No direct writes to whatsapp_campaigns"
ON public.whatsapp_campaigns
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "No direct updates to whatsapp_campaigns"
ON public.whatsapp_campaigns
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "No direct deletes to whatsapp_campaigns"
ON public.whatsapp_campaigns
FOR DELETE
USING (false);

DROP POLICY IF EXISTS "Users can view own whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Users can view own whatsapp_campaign_recipients"
ON public.whatsapp_campaign_recipients
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct writes to whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "No direct writes to whatsapp_campaign_recipients"
ON public.whatsapp_campaign_recipients
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "No direct updates to whatsapp_campaign_recipients"
ON public.whatsapp_campaign_recipients
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "No direct deletes to whatsapp_campaign_recipients"
ON public.whatsapp_campaign_recipients
FOR DELETE
USING (false);

-- Timestamp maintenance
DROP TRIGGER IF EXISTS trg_whatsapp_campaigns_updated_at ON public.whatsapp_campaigns;
CREATE TRIGGER trg_whatsapp_campaigns_updated_at
BEFORE UPDATE ON public.whatsapp_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_recipients_updated_at ON public.whatsapp_campaign_recipients;
CREATE TRIGGER trg_whatsapp_campaign_recipients_updated_at
BEFORE UPDATE ON public.whatsapp_campaign_recipients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();