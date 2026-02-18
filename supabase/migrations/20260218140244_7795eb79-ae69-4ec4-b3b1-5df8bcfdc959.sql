-- WhatsApp Business Accounts (WABA)
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_business_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  meta_bm_id text NOT NULL,
  waba_id text NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_waba_user_waba_id_uniq
  ON public.meta_whatsapp_business_accounts (user_id, waba_id);

CREATE INDEX IF NOT EXISTS meta_waba_user_bm_id_idx
  ON public.meta_whatsapp_business_accounts (user_id, meta_bm_id);

ALTER TABLE public.meta_whatsapp_business_accounts ENABLE ROW LEVEL SECURITY;

-- Same pattern as existing meta_* tables: allow SELECT for owner, forbid direct writes
DROP POLICY IF EXISTS "Users can view own meta_whatsapp_business_accounts" ON public.meta_whatsapp_business_accounts;
CREATE POLICY "Users can view own meta_whatsapp_business_accounts"
ON public.meta_whatsapp_business_accounts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct writes to meta_whatsapp_business_accounts" ON public.meta_whatsapp_business_accounts;
CREATE POLICY "No direct writes to meta_whatsapp_business_accounts"
ON public.meta_whatsapp_business_accounts
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to meta_whatsapp_business_accounts" ON public.meta_whatsapp_business_accounts;
CREATE POLICY "No direct updates to meta_whatsapp_business_accounts"
ON public.meta_whatsapp_business_accounts
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to meta_whatsapp_business_accounts" ON public.meta_whatsapp_business_accounts;
CREATE POLICY "No direct deletes to meta_whatsapp_business_accounts"
ON public.meta_whatsapp_business_accounts
FOR DELETE
USING (false);

DROP TRIGGER IF EXISTS update_meta_whatsapp_business_accounts_updated_at ON public.meta_whatsapp_business_accounts;
CREATE TRIGGER update_meta_whatsapp_business_accounts_updated_at
BEFORE UPDATE ON public.meta_whatsapp_business_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- WhatsApp message templates
CREATE TABLE IF NOT EXISTS public.meta_whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  waba_id text NOT NULL,
  template_name text NOT NULL,
  language text NOT NULL,
  category text NULL,
  status text NULL,
  components jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_wat_user_waba_name_lang_uniq
  ON public.meta_whatsapp_templates (user_id, waba_id, template_name, language);

CREATE INDEX IF NOT EXISTS meta_wat_user_waba_id_idx
  ON public.meta_whatsapp_templates (user_id, waba_id);

ALTER TABLE public.meta_whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meta_whatsapp_templates" ON public.meta_whatsapp_templates;
CREATE POLICY "Users can view own meta_whatsapp_templates"
ON public.meta_whatsapp_templates
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "No direct writes to meta_whatsapp_templates" ON public.meta_whatsapp_templates;
CREATE POLICY "No direct writes to meta_whatsapp_templates"
ON public.meta_whatsapp_templates
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to meta_whatsapp_templates" ON public.meta_whatsapp_templates;
CREATE POLICY "No direct updates to meta_whatsapp_templates"
ON public.meta_whatsapp_templates
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to meta_whatsapp_templates" ON public.meta_whatsapp_templates;
CREATE POLICY "No direct deletes to meta_whatsapp_templates"
ON public.meta_whatsapp_templates
FOR DELETE
USING (false);

DROP TRIGGER IF EXISTS update_meta_whatsapp_templates_updated_at ON public.meta_whatsapp_templates;
CREATE TRIGGER update_meta_whatsapp_templates_updated_at
BEFORE UPDATE ON public.meta_whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
