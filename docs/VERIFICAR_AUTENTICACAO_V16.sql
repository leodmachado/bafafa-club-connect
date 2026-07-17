-- BAFAFÁ V16 — verificação de autenticação e contas privilegiadas
-- Execute no SQL Editor depois do setup da V16.

SELECT
  to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL AS has_role_ok,
  to_regprocedure('public.my_auth_security_status()') IS NOT NULL AS status_auth_ok,
  to_regprocedure('public.handle_new_user()') IS NOT NULL AS signup_trigger_function_ok,
  to_regprocedure('public.set_my_preferences(text[],text[],text[],boolean,boolean,boolean,boolean,boolean,text)') IS NOT NULL AS preferencias_seguras_ok,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created' AND NOT tgisinternal
  ) AS signup_trigger_ok;

SELECT
  p.proname,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) LIKE '%aal2%' AS menciona_aal2,
  p.proconfig AS configuracoes_fixadas
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('has_role','my_auth_security_status','set_my_preferences','handle_new_user')
ORDER BY p.proname;

-- O papel authenticated não deve ter escrita bruta nas preferências nem nos
-- consentimentos. As mudanças legítimas passam pela RPC protegida.
SELECT
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'authenticated'
  AND table_schema = 'public'
  AND table_name IN ('user_preferences','user_consents')
  AND privilege_type IN ('INSERT','UPDATE','DELETE')
ORDER BY table_name, privilege_type;
-- Resultado esperado: zero linhas.

-- Confirma que a função has_role realmente exige AAL2 para papéis sensíveis.
SELECT
  position('aal2' IN pg_get_functiondef(p.oid)) > 0 AS has_role_exige_aal2,
  position('admin' IN pg_get_functiondef(p.oid)) > 0 AS contempla_admin,
  position('moderador' IN pg_get_functiondef(p.oid)) > 0 AS contempla_moderador,
  position('equipe' IN pg_get_functiondef(p.oid)) > 0 AS contempla_equipe
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'has_role';
