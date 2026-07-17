-- V18 — verificação de infraestrutura e continuidade.
SELECT
  to_regclass('public.security_events') IS NOT NULL AS security_events_ok,
  to_regclass('public.security_controls') IS NOT NULL AS security_controls_ok,
  to_regprocedure('public.admin_security_snapshot()') IS NOT NULL AS snapshot_ok,
  to_regprocedure('public.admin_set_security_control(text,boolean,text,text)') IS NOT NULL AS controls_rpc_ok,
  to_regprocedure('public.admin_resolve_security_event(uuid,text)') IS NOT NULL AS resolve_rpc_ok,
  to_regprocedure('public.admin_prune_security_events(integer)') IS NOT NULL AS retention_rpc_ok;

SELECT
  c.relname AS tabela,
  c.relrowsecurity AS rls_ativa
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('security_events','security_controls')
ORDER BY c.relname;

SELECT
  has_table_privilege('authenticated','public.security_events','INSERT') AS authenticated_insere_eventos,
  has_table_privilege('authenticated','public.security_events','UPDATE') AS authenticated_altera_eventos,
  has_table_privilege('authenticated','public.security_controls','UPDATE') AS authenticated_altera_controles;

SELECT control_key, category, label, completed
FROM public.security_controls
ORDER BY category, label;
