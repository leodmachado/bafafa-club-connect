-- BAFAFÁ CONNECT V20.6 — VERIFICAÇÃO DO BLOQUEIO 2FA
-- Execute depois de aplicar 20260802120000_privileged_aal2_enforcement_v206.sql.

WITH checks AS (
  SELECT
    to_regprocedure('public.current_session_is_aal2()') IS NOT NULL AS helper_aal2_existe,
    to_regprocedure('public.require_privileged_aal2()') IS NOT NULL AS guard_explicito_existe,
    to_regprocedure('public.has_role(uuid,public.app_role)') IS NOT NULL AS has_role_existe,
    position(
      'current_session_is_aal2'
      IN pg_get_functiondef(to_regprocedure('public.has_role(uuid,public.app_role)'))
    ) > 0 AS has_role_exige_aal2,
    NOT has_function_privilege('anon', 'public.current_session_is_aal2()', 'EXECUTE') AS anon_sem_helper,
    NOT has_function_privilege('anon', 'public.require_privileged_aal2()', 'EXECUTE') AS anon_sem_guard,
    NOT has_function_privilege('anon', 'public.has_role(uuid,public.app_role)', 'EXECUTE') AS anon_sem_has_role,
    has_function_privilege('authenticated', 'public.current_session_is_aal2()', 'EXECUTE') AS autenticado_pode_consultar_aal,
    has_function_privilege('authenticated', 'public.require_privileged_aal2()', 'EXECUTE') AS autenticado_pode_executar_guard,
    has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE') AS autenticado_pode_consultar_role
)
SELECT
  *,
  helper_aal2_existe
  AND guard_explicito_existe
  AND has_role_existe
  AND has_role_exige_aal2
  AND anon_sem_helper
  AND anon_sem_guard
  AND anon_sem_has_role
  AND autenticado_pode_consultar_aal
  AND autenticado_pode_executar_guard
  AND autenticado_pode_consultar_role AS verificacao_ok
FROM checks;

-- TESTE DE ACEITAÇÃO MANUAL OBRIGATÓRIO
-- 1. Entrar com conta admin usando somente e-mail/senha ou primeiro fator.
-- 2. Confirmar que qualquer URL autenticada redireciona para /seguranca.
-- 3. Tentar abrir /admin e /staff/checkin diretamente: ambas devem voltar para /seguranca.
-- 4. No console do navegador, tentar uma leitura/escrita administrativa: deve receber permission denied.
-- 5. Confirmar o TOTP e verificar que a sessão passou a aal2.
-- 6. Abrir /admin: somente agora o painel deve carregar.
-- 7. Atualizar a página e repetir uma ação administrativa para confirmar persistência do aal2.
-- 8. Sair, entrar novamente e confirmar que uma nova sessão volta a exigir o TOTP.
