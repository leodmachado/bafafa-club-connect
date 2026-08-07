-- Verificação V20.7 — escopo próprio de has_role().
-- Seguro para execução no SQL Editor: somente leitura.

with function_state as (
  select
    pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure) as definition,
    has_function_privilege('anon', 'public.has_role(uuid,public.app_role)', 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', 'public.has_role(uuid,public.app_role)', 'EXECUTE') as authenticated_execute,
    has_function_privilege('service_role', 'public.has_role(uuid,public.app_role)', 'EXECUTE') as service_role_execute
), no_session_test as (
  select coalesce(
    not public.has_role(
      (select ur.user_id from public.user_roles ur where ur.role = 'admin' limit 1),
      'admin'::public.app_role
    ),
    true
  ) as no_session_denied
)
select
  position('_user_id = auth.uid()' in definition) > 0 as restricts_to_current_user,
  position('auth.jwt() ->> ''role''' in definition) > 0 as preserves_service_role_path,
  position('current_session_is_aal2()' in definition) > 0 as preserves_privileged_aal2,
  not anon_execute as anon_cannot_enumerate_roles,
  authenticated_execute as authenticated_can_use_self_check,
  service_role_execute as service_role_can_use_internal_check,
  no_session_denied,
  (
    position('_user_id = auth.uid()' in definition) > 0
    and position('auth.jwt() ->> ''role''' in definition) > 0
    and position('current_session_is_aal2()' in definition) > 0
    and not anon_execute
    and authenticated_execute
    and service_role_execute
    and no_session_denied
  ) as verificacao_ok
from function_state
cross join no_session_test;
