-- BAFAFÁ V15 — verificação pós-instalação
-- Execute no SQL Editor depois do SETUP V15. Somente leitura.

-- 1) RLS ligada nas tabelas sensíveis
SELECT
  c.relname AS tabela,
  c.relrowsecurity AS rls_ativa,
  c.relforcerowsecurity AS rls_forcada
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'profiles','user_roles','user_consents','user_preferences','checkins',
    'user_rewards','reward_redemptions','audit_logs','event_chat_messages',
    'event_chat_reports','event_chat_blocks','qr_tokens'
  )
ORDER BY c.relname;

-- 2) Privilégios brutos de cliente nas tabelas mais sensíveis
SELECT grantee, table_name, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon','authenticated')
  AND table_name IN (
    'profiles','checkins','user_rewards','reward_redemptions','audit_logs',
    'event_chat_blocks'
  )
ORDER BY table_name, grantee, privilege_type;

-- Esperado:
-- profiles: authenticated SELECT; UPDATE aparece somente na consulta de colunas abaixo.
-- checkins/user_rewards/reward_redemptions: authenticated SELECT, protegido por RLS.
-- audit_logs: authenticated SELECT, somente admin pela policy.
-- event_chat_blocks: sem INSERT/UPDATE/DELETE direto.

-- 3) Colunas que o próprio cliente pode editar no perfil
SELECT grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND grantee = 'authenticated'
ORDER BY column_name;

-- Não podem aparecer: phone_verified_at, is_over_18, member_since,
-- last_seen_at, deleted_at, created_at, updated_at, id.

-- 4) Policies finais nas tabelas sensíveis
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles','checkins','user_rewards','reward_redemptions','audit_logs',
    'event_chat_blocks'
  )
ORDER BY tablename, policyname;

-- 5) Funções críticas existem
SELECT
  to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL AS has_role_ok,
  to_regprocedure('public.get_public_profile(text)') IS NOT NULL AS perfil_publico_seguro_ok,
  to_regprocedure('public.validate_checkin_qr(text,uuid)') IS NOT NULL AS validar_checkin_ok,
  to_regprocedure('public.redeem_reward_qr(text)') IS NOT NULL AS validar_mimo_ok,
  to_regprocedure('public.can_access_event_chat(uuid,uuid)') IS NOT NULL AS acesso_resenha_ok,
  to_regprocedure('public.can_read_event_chat(uuid,uuid)') IS NOT NULL AS leitura_resenha_ok;

-- 6) O schema público não aceita CREATE de papéis de cliente
SELECT
  has_schema_privilege('anon', 'public', 'CREATE') AS anon_pode_criar,
  has_schema_privilege('authenticated', 'public', 'CREATE') AS autenticado_pode_criar;
-- Esperado: false / false.
