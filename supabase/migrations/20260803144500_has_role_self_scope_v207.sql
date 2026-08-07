-- V20.7 — restringe a consulta de papéis ao próprio usuário.
--
-- Um usuário autenticado ainda pode usar has_role() indiretamente nas policies
-- e diretamente para consultar o próprio papel, mas não pode enumerar papéis
-- de UUIDs arbitrários. Rotinas internas com service_role continuam permitidas.

create or replace function public.has_role(
  _user_id uuid,
  _role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
  select
    (
      coalesce(auth.jwt() ->> 'role', '') = 'service_role'
      or (
        auth.uid() is not null
        and _user_id = auth.uid()
      )
    )
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = _user_id
        and ur.role = _role
    )
    and (
      _role not in (
        'admin'::public.app_role,
        'moderador'::public.app_role,
        'equipe'::public.app_role
      )
      or public.current_session_is_aal2()
    )
$function$;

revoke all on function public.has_role(uuid, public.app_role) from public;
revoke all on function public.has_role(uuid, public.app_role) from anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
