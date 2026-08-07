-- V20.7 — protege alterações de papéis feitas por UPDATE.
--
-- Corrige dois caminhos:
-- 1. impedir que o último admin ou o próprio admin seja removido por UPDATE;
-- 2. registrar concessão/revogação de papel privilegiado também em UPDATE.

create or replace function public.tg_block_self_privileged_role()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id then
      raise exception 'Não é permitido transferir um registro de papel para outro usuário.';
    end if;
  end if;

  if auth.uid() is not null then
    new.granted_by := auth.uid();
    if tg_op = 'INSERT' or new.role is distinct from old.role then
      new.granted_at := now();
    end if;
  end if;

  if new.role in ('equipe','moderador','admin') then
    if auth.uid() = new.user_id and not public.has_role(auth.uid(), 'admin') then
      raise exception 'Não é permitido atribuir esse papel a si mesmo.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function public.tg_protect_admin_role_delete()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_removes_admin boolean := false;
begin
  if tg_op = 'DELETE' then
    v_removes_admin := old.role = 'admin';
  elsif tg_op = 'UPDATE' then
    v_removes_admin := old.role = 'admin'
      and (
        new.role is distinct from 'admin'::public.app_role
        or new.user_id is distinct from old.user_id
      );
  end if;

  if v_removes_admin then
    if old.user_id = auth.uid() then
      raise exception 'Você não pode remover o próprio acesso de administrador.';
    end if;

    if (
      select count(*)
      from public.user_roles
      where role = 'admin'::public.app_role
    ) <= 1 then
      raise exception 'O sistema precisa manter pelo menos um administrador.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

create or replace function public.tg_security_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_actor uuid := auth.uid();
  v_old_privileged boolean := false;
  v_new_privileged boolean := false;
begin
  if tg_op in ('DELETE','UPDATE') then
    v_old_privileged := old.role in ('admin','moderador','equipe');
  end if;

  if tg_op in ('INSERT','UPDATE') then
    v_new_privileged := new.role in ('admin','moderador','equipe');
  end if;

  if tg_op = 'UPDATE'
     and old.user_id is not distinct from new.user_id
     and old.role is not distinct from new.role then
    return new;
  end if;

  if v_old_privileged then
    perform public.record_security_event(
      case when old.role = 'admin' then 'critical' else 'high' end,
      'access',
      'privileged_role_revoked',
      'Papel privilegiado removido',
      v_actor,
      old.user_id,
      'user_role',
      old.user_id::text,
      jsonb_build_object(
        'role', old.role,
        'operation', tg_op,
        'replacement_role', case when tg_op = 'UPDATE' then new.role else null end
      )
    );
  end if;

  if v_new_privileged then
    perform public.record_security_event(
      case when new.role = 'admin' then 'critical' else 'high' end,
      'access',
      'privileged_role_granted',
      'Papel privilegiado concedido',
      v_actor,
      new.user_id,
      'user_role',
      new.user_id::text,
      jsonb_build_object(
        'role', new.role,
        'operation', tg_op,
        'previous_role', case when tg_op = 'UPDATE' then old.role else null end
      )
    );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists user_roles_protect_admin_delete on public.user_roles;
create trigger user_roles_protect_admin_delete
before delete or update on public.user_roles
for each row execute function public.tg_protect_admin_role_delete();

drop trigger if exists security_user_roles_change on public.user_roles;
create trigger security_user_roles_change
after insert or update or delete on public.user_roles
for each row execute function public.tg_security_role_change();
