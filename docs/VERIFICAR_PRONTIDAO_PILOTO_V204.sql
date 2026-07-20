-- BAFAFÁ CONNECT V20.4 — verificação somente leitura
-- Esperado: todas as colunas booleanas retornam true e migration_aplicada = 1.

SELECT
  to_regclass('public.private_chat_reports') IS NOT NULL AS reports_table,
  has_table_privilege('authenticated', 'public.private_chat_reports', 'INSERT')
    AS authenticated_can_insert_report,
  has_function_privilege(
    'authenticated',
    'public.report_private_chat_message(uuid,text,text)',
    'EXECUTE'
  ) AS can_report_private,
  NOT has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
    AS trigger_hidden_from_anon,
  NOT has_function_privilege('authenticated', 'public.tg_require_adult_checkin()', 'EXECUTE')
    AS checkin_trigger_hidden_from_client,
  (
    SELECT count(*) = 0
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname IN ('public_read_avatars', 'public_read_event_images')
  ) AS broad_storage_listing_removed,
  (
    SELECT column_default = 'false'
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'is_public'
  ) AS new_profiles_private,
  (
    SELECT rowsecurity
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'private_chat_reports'
  ) AS reports_rls_enabled;

SELECT count(*) AS migration_aplicada
FROM supabase_migrations.schema_migrations
WHERE name = 'pilot_readiness_v204';

SELECT
  p.proname,
  p.prosecdef AS security_definer,
  p.proconfig @> ARRAY['search_path=pg_catalog, public'] AS fixed_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'handle_new_user',
    'is_verified_adult',
    'my_salve_requests',
    'send_private_message',
    'report_private_chat_message',
    'moderate_private_chat_report'
  )
ORDER BY p.proname;

