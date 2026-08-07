-- Verificação V20.7 — objetos futuros do aplicativo fechados por padrão.
-- Somente leitura.

with app_defaults as (
  select
    d.defaclobjtype as object_type,
    coalesce(d.defaclacl, '{}'::aclitem[])::text as acl
  from pg_default_acl d
  join pg_namespace n on n.oid = d.defaclnamespace
  where n.nspname = 'public'
    and pg_get_userbyid(d.defaclrole) = 'postgres'
    and d.defaclobjtype in ('r','S','f')
), app_checks as (
  select
    count(*) filter (
      where object_type = 'r'
        and position('anon=' in acl) = 0
        and position('authenticated=' in acl) = 0
    ) = 1 as future_tables_closed,
    count(*) filter (
      where object_type = 'S'
        and position('anon=' in acl) = 0
        and position('authenticated=' in acl) = 0
    ) = 1 as future_sequences_closed,
    count(*) filter (
      where object_type = 'f'
        and position('anon=' in acl) = 0
        and position('authenticated=' in acl) = 0
    ) = 1 as future_functions_closed
  from app_defaults
), platform_state as (
  select exists (
    select 1
    from pg_default_acl d
    join pg_namespace n on n.oid = d.defaclnamespace
    where n.nspname = 'public'
      and pg_get_userbyid(d.defaclrole) = 'supabase_admin'
      and (
        position('anon=' in coalesce(d.defaclacl, '{}'::aclitem[])::text) > 0
        or position('authenticated=' in coalesce(d.defaclacl, '{}'::aclitem[])::text) > 0
      )
  ) as supabase_admin_defaults_managed_by_platform
)
select
  future_tables_closed,
  future_sequences_closed,
  future_functions_closed,
  supabase_admin_defaults_managed_by_platform,
  future_tables_closed
    and future_sequences_closed
    and future_functions_closed as verificacao_ok
from app_checks
cross join platform_state;
