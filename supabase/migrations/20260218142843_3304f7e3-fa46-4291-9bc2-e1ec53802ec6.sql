-- Fix: ensure unique indexes exist for UPSERT targets (previous migration failed due to a typo)
DO $$
BEGIN
  -- meta_business_managers: upsert onConflict "user_id,meta_bm_id"
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'meta_business_managers_user_meta_bm_id_uidx'
  ) THEN
    CREATE UNIQUE INDEX meta_business_managers_user_meta_bm_id_uidx
      ON public.meta_business_managers (user_id, meta_bm_id);
  END IF;

  -- meta_ad_accounts: upsert onConflict "user_id,meta_ad_account_id"
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'meta_ad_accounts_user_meta_ad_account_id_uidx'
  ) THEN
    CREATE UNIQUE INDEX meta_ad_accounts_user_meta_ad_account_id_uidx
      ON public.meta_ad_accounts (user_id, meta_ad_account_id);
  END IF;

  -- meta_whatsapp_business_accounts: allow safe upsert by user + waba
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'meta_wabas_user_waba_id_uidx'
  ) THEN
    CREATE UNIQUE INDEX meta_wabas_user_waba_id_uidx
      ON public.meta_whatsapp_business_accounts (user_id, waba_id);
  END IF;

  -- meta_whatsapp_templates: prevent duplicates per user+waba+template+language
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'meta_wa_tpl_user_waba_name_lang_uidx'
  ) THEN
    CREATE UNIQUE INDEX meta_wa_tpl_user_waba_name_lang_uidx
      ON public.meta_whatsapp_templates (user_id, waba_id, template_name, language);
  END IF;
END $$;