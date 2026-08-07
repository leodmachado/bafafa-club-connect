-- V20.7 — inventário estrutural de RPCs públicas.
--
-- Este arquivo é somente leitura. Ele classifica funções do schema public e
-- falha logicamente quando encontra uma SECURITY DEFINER exposta sem uma
-- justificativa estrutural conhecida.

with function_state as (
  select
    p.oid,
    p.oid::regprocedure::text as signature,
    p.proname,
    p.prosecdef,
    coalesce(p.proconfig, array[]::text[]) as proconfig,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
    has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
    pg_get_functiondef(p.oid) as definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
), classified as (
  select
    *,
    proname like 'admin_%' as admin_rpc,
    position('has_role' in definition) > 0 as checks_has_role,
    position('auth.uid()' in definition) > 0 as checks_auth_uid,
    exists (
      select 1
      from unnest(proconfig) setting
      where setting like 'search_path=%'
    ) as fixed_search_path,
    proname in (
      'check_content_allowed',
      'event_fofocometro',
      'get_public_profile'
    ) as intentional_public_security_definer
  from function_state
), summary as (
  select
    count(*) as total_public_functions,
    count(*) filter (where prosecdef) as security_definer_total,
    count(*) filter (
      where prosecdef and authenticated_execute
    ) as authenticated_security_definer,
    count(*) filter (
      where prosecdef and anon_execute
    ) as anon_security_definer,
    count(*) filter (
      where admin_rpc and authenticated_execute
    ) as authenticated_admin_rpcs,
    count(*) filter (
      where admin_rpc and authenticated_execute and checks_has_role
    ) as protected_admin_rpcs,
    count(*) filter (
      where prosecdef and not fixed_search_path
    ) as security_definer_without_fixed_search_path,
    count(*) filter (
      where prosecdef
        and authenticated_execute
        and not checks_has_role
        and not checks_auth_uid
        and not intentional_public_security_definer
    ) as unexplained_authenticated_security_definer,
    count(*) filter (
      where prosecdef
        and anon_execute
        and not intentional_public_security_definer
    ) as unexplained_anon_security_definer
  from classified
)
select
  *,
  authenticated_admin_rpcs = protected_admin_rpcs
    as all_admin_rpcs_have_role_guard,
  security_definer_without_fixed_search_path = 0
    as all_security_definer_have_fixed_search_path,
  unexplained_authenticated_security_definer = 0
    as no_unexplained_authenticated_security_definer,
  unexplained_anon_security_definer = 0
    as no_unexplained_anon_security_definer,
  authenticated_admin_rpcs = protected_admin_rpcs
    and security_definer_without_fixed_search_path = 0
    and unexplained_authenticated_security_definer = 0
    and unexplained_anon_security_definer = 0
    as verificacao_ok
from summary;
