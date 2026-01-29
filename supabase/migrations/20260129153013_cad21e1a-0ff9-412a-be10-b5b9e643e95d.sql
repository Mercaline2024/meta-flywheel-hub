-- MetaControl: Meta connection + assets

-- Timestamp helper
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Stores provider tokens (HIGHLY SENSITIVE). No direct SELECT from client.
CREATE TABLE IF NOT EXISTS public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'facebook',
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  scope TEXT,
  token_received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  bm_sync_at TIMESTAMPTZ,
  ad_account_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_meta_connections_updated_at
BEFORE UPDATE ON public.meta_connections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

-- CRITICAL: deny direct token reads from client
DROP POLICY IF EXISTS "No direct access to meta_connections" ON public.meta_connections;
CREATE POLICY "No direct access to meta_connections"
ON public.meta_connections
FOR SELECT
USING (false);

-- Also deny direct writes from client (tokens should be stored via backend function only)
DROP POLICY IF EXISTS "No direct insert to meta_connections" ON public.meta_connections;
CREATE POLICY "No direct insert to meta_connections"
ON public.meta_connections
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct update to meta_connections" ON public.meta_connections;
CREATE POLICY "No direct update to meta_connections"
ON public.meta_connections
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct delete to meta_connections" ON public.meta_connections;
CREATE POLICY "No direct delete to meta_connections"
ON public.meta_connections
FOR DELETE
USING (false);

-- Business Managers (safe to show to user)
CREATE TABLE IF NOT EXISTS public.meta_business_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meta_bm_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_bm_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_business_managers_user_id ON public.meta_business_managers(user_id);

CREATE TRIGGER update_meta_business_managers_updated_at
BEFORE UPDATE ON public.meta_business_managers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meta_business_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meta_business_managers" ON public.meta_business_managers;
CREATE POLICY "Users can view own meta_business_managers"
ON public.meta_business_managers
FOR SELECT
USING (auth.uid() = user_id);

-- Deny direct writes (synced by backend function)
DROP POLICY IF EXISTS "No direct writes to meta_business_managers" ON public.meta_business_managers;
CREATE POLICY "No direct writes to meta_business_managers"
ON public.meta_business_managers
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to meta_business_managers" ON public.meta_business_managers;
CREATE POLICY "No direct updates to meta_business_managers"
ON public.meta_business_managers
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to meta_business_managers" ON public.meta_business_managers;
CREATE POLICY "No direct deletes to meta_business_managers"
ON public.meta_business_managers
FOR DELETE
USING (false);

-- Ad Accounts (safe to show to user)
CREATE TABLE IF NOT EXISTS public.meta_ad_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meta_ad_account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  meta_bm_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, meta_ad_account_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_user_id ON public.meta_ad_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_user_bm ON public.meta_ad_accounts(user_id, meta_bm_id);

CREATE TRIGGER update_meta_ad_accounts_updated_at
BEFORE UPDATE ON public.meta_ad_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.meta_ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own meta_ad_accounts" ON public.meta_ad_accounts;
CREATE POLICY "Users can view own meta_ad_accounts"
ON public.meta_ad_accounts
FOR SELECT
USING (auth.uid() = user_id);

-- Deny direct writes (synced by backend function)
DROP POLICY IF EXISTS "No direct writes to meta_ad_accounts" ON public.meta_ad_accounts;
CREATE POLICY "No direct writes to meta_ad_accounts"
ON public.meta_ad_accounts
FOR INSERT
WITH CHECK (false);

DROP POLICY IF EXISTS "No direct updates to meta_ad_accounts" ON public.meta_ad_accounts;
CREATE POLICY "No direct updates to meta_ad_accounts"
ON public.meta_ad_accounts
FOR UPDATE
USING (false);

DROP POLICY IF EXISTS "No direct deletes to meta_ad_accounts" ON public.meta_ad_accounts;
CREATE POLICY "No direct deletes to meta_ad_accounts"
ON public.meta_ad_accounts
FOR DELETE
USING (false);
