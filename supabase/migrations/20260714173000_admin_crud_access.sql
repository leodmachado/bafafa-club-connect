-- BAFAFÁ MVP — permissões e auditoria para o painel administrativo

-- RLS decide quem pode alterar. Os grants abaixo apenas tornam os comandos
-- disponíveis para usuários autenticados que passarem pelas policies.
GRANT INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.campaigns TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.badge_definitions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.title_definitions TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

-- O administrador precisa visualizar os dados declarados dos clientes.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view all preferences" ON public.user_preferences;
CREATE POLICY "Admins can view all preferences"
ON public.user_preferences FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Evita que o último administrador seja removido e reduz o risco de o dono
-- se bloquear acidentalmente pelo painel.
CREATE OR REPLACE FUNCTION public.tg_protect_admin_role_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role = 'admin' THEN
    IF OLD.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Você não pode remover o próprio acesso de administrador.';
    END IF;
    IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <= 1 THEN
      RAISE EXCEPTION 'O sistema precisa manter pelo menos um administrador.';
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_protect_admin_role_delete() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_protect_admin_role_delete() TO service_role;

DROP TRIGGER IF EXISTS user_roles_protect_admin_delete ON public.user_roles;
CREATE TRIGGER user_roles_protect_admin_delete
BEFORE DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_protect_admin_role_delete();

-- Auditoria automática para as principais ações administrativas.
CREATE OR REPLACE FUNCTION public.tg_audit_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id text;
  v_old jsonb := NULL;
  v_new jsonb := NULL;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_id := coalesce(v_old->>'id', v_old->>'user_id');
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_id := coalesce(v_new->>'id', v_new->>'user_id');
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_id := coalesce(v_new->>'id', v_new->>'user_id', v_old->>'id', v_old->>'user_id');
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    lower(TG_OP) || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    v_id,
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_audit_admin_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_audit_admin_change() TO service_role;

DROP TRIGGER IF EXISTS audit_events_admin ON public.events;
CREATE TRIGGER audit_events_admin
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_admin_change();

DROP TRIGGER IF EXISTS audit_campaigns_admin ON public.campaigns;
CREATE TRIGGER audit_campaigns_admin
AFTER INSERT OR UPDATE OR DELETE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_admin_change();

DROP TRIGGER IF EXISTS audit_user_roles_admin ON public.user_roles;
CREATE TRIGGER audit_user_roles_admin
AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_admin_change();
