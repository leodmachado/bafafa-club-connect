-- Verificação V20.7 — proteção de UPDATE em user_roles.
-- Somente leitura estrutural.

with trigger_state as (
  select
    bool_or(t.tgname = 'user_roles_protect_admin_delete'
      and pg_get_triggerdef(t.oid) ilike '%BEFORE DELETE OR UPDATE%')
      as admin_protection_covers_update,
    bool_or(t.tgname = 'security_user_roles_change'
      and pg_get_triggerdef(t.oid) ilike '%AFTER INSERT OR DELETE OR UPDATE%')
      as security_event_covers_update
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'user_roles'
    and not t.tgisinternal
), function_state as (
  select
    position(
      'new.user_id is distinct from old.user_id'
      in pg_get_functiondef('public.tg_block_self_privileged_role()'::regprocedure)
    ) > 0 as role_row_transfer_blocked,
    position(
      'tg_op = ''UPDATE'''
      in pg_get_functiondef('public.tg_protect_admin_role_delete()'::regprocedure)
    ) > 0 as last_admin_update_checked,
    position(
      'privileged_role_revoked'
      in pg_get_functiondef('public.tg_security_role_change()'::regprocedure)
    ) > 0 as revocation_event_present,
    position(
      'privileged_role_granted'
      in pg_get_functiondef('public.tg_security_role_change()'::regprocedure)
    ) > 0 as grant_event_present
)
select
  admin_protection_covers_update,
  security_event_covers_update,
  role_row_transfer_blocked,
  last_admin_update_checked,
  revocation_event_present,
  grant_event_present,
  admin_protection_covers_update
    and security_event_covers_update
    and role_row_transfer_blocked
    and last_admin_update_checked
    and revocation_event_present
    and grant_event_present as verificacao_ok
from trigger_state
cross join function_state;
