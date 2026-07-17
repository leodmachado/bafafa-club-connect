-- ==========================================================================
-- BAFAFÁ V18 — Infraestrutura, continuidade e monitoramento
-- Escopo: trilha de eventos de segurança, checklist operacional e postura.
-- Não armazena senhas, tokens, IPs brutos ou conteúdo privado dos clientes.
-- ==========================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  severity text NOT NULL CHECK (severity IN ('info','low','medium','high','critical')),
  category text NOT NULL CHECK (category IN ('access','export','database','deployment','backup','authentication','operations','other')),
  event_key text NOT NULL,
  title text NOT NULL,
  actor_id uuid,
  target_user_id uuid,
  entity text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS security_events_open_idx
  ON public.security_events (resolved_at, severity, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_actor_idx
  ON public.security_events (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS security_events_key_idx
  ON public.security_events (event_key, occurred_at DESC);

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_events FROM anon, authenticated;
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;

DROP POLICY IF EXISTS "Admins view security events" ON public.security_events;
CREATE POLICY "Admins view security events"
ON public.security_events FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.security_controls (
  control_key text PRIMARY KEY,
  category text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  completed boolean NOT NULL DEFAULT false,
  evidence text,
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.security_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.security_controls FROM anon, authenticated;
GRANT SELECT ON public.security_controls TO authenticated;
GRANT ALL ON public.security_controls TO service_role;

DROP POLICY IF EXISTS "Admins view security controls" ON public.security_controls;
CREATE POLICY "Admins view security controls"
ON public.security_controls FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.security_controls(control_key, category, label, description, required)
VALUES
  ('github_mfa', 'GitHub', 'MFA na conta do GitHub', 'Autenticação em duas etapas habilitada na conta proprietária do repositório.', true),
  ('github_branch_protection', 'GitHub', 'Branch main protegida', 'Merge apenas por Pull Request, checks obrigatórios e force-push bloqueado.', true),
  ('github_dependabot', 'GitHub', 'Dependabot ativo', 'Atualizações de segurança e versão acompanhadas por Pull Requests.', true),
  ('github_secret_scanning', 'GitHub', 'Proteção contra segredos', 'Secret scanning/push protection habilitado quando disponível no plano.', true),
  ('vercel_mfa', 'Vercel', 'MFA na conta da Vercel', 'Autenticação em duas etapas habilitada para quem administra os deployments.', true),
  ('vercel_preview_protection', 'Vercel', 'Previews protegidos', 'Deployments de teste exigem autenticação e não ficam públicos.', true),
  ('vercel_env_review', 'Vercel', 'Variáveis revisadas', 'Somente chaves públicas VITE_ no navegador; nenhum segredo de servidor exposto.', true),
  ('supabase_mfa', 'Supabase', 'MFA na conta do Supabase', 'Autenticação em duas etapas habilitada para proprietários e administradores.', true),
  ('supabase_auth_logs', 'Supabase', 'Logs de autenticação revisados', 'Rotina de revisão dos Auth Audit Logs e Logs Explorer definida.', true),
  ('database_backup', 'Continuidade', 'Backup do banco realizado', 'Exportação do banco guardada fora do computador e do projeto Supabase.', true),
  ('storage_backup', 'Continuidade', 'Backup das imagens realizado', 'Objetos dos buckets avatars e event-images exportados separadamente.', true),
  ('restore_test', 'Continuidade', 'Restauração testada', 'Um backup foi restaurado em ambiente separado e validado.', true),
  ('incident_contacts', 'Resposta', 'Contatos de incidente definidos', 'Responsável técnico, responsável do Bafafá e canais de contato documentados.', true)
ON CONFLICT (control_key) DO UPDATE SET
  category = EXCLUDED.category,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  required = EXCLUDED.required;

CREATE OR REPLACE FUNCTION public.tg_security_controls_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_security_controls_updated_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS security_controls_updated_at ON public.security_controls;
CREATE TRIGGER security_controls_updated_at
BEFORE UPDATE ON public.security_controls
FOR EACH ROW EXECUTE FUNCTION public.tg_security_controls_updated_at();

CREATE OR REPLACE FUNCTION public.record_security_event(
  _severity text,
  _category text,
  _event_key text,
  _title text,
  _actor_id uuid DEFAULT NULL,
  _target_user_id uuid DEFAULT NULL,
  _entity text DEFAULT NULL,
  _entity_id text DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_id uuid;
BEGIN
  IF _severity NOT IN ('info','low','medium','high','critical') THEN
    RAISE EXCEPTION 'Severidade inválida';
  END IF;
  IF _category NOT IN ('access','export','database','deployment','backup','authentication','operations','other') THEN
    RAISE EXCEPTION 'Categoria inválida';
  END IF;

  INSERT INTO public.security_events(
    severity, category, event_key, title, actor_id, target_user_id,
    entity, entity_id, details
  ) VALUES (
    _severity, _category, left(_event_key, 80), left(_title, 180), _actor_id,
    _target_user_id, left(_entity, 80), left(_entity_id, 160),
    coalesce(_details, '{}'::jsonb)
      - 'email' - 'phone' - 'whatsapp' - 'birth_date' - 'token' - 'secret' - 'password'
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_security_event(text,text,text,text,uuid,uuid,text,text,jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_security_event(text,text,text,text,uuid,uuid,text,text,jsonb)
TO service_role;

CREATE OR REPLACE FUNCTION public.tg_security_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid;
  v_role public.app_role;
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user := OLD.user_id;
    v_role := OLD.role;
  ELSE
    v_user := NEW.user_id;
    v_role := NEW.role;
  END IF;
  IF v_role NOT IN ('admin','moderador','equipe') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM public.record_security_event(
    CASE WHEN v_role = 'admin' THEN 'critical' ELSE 'high' END,
    'access',
    CASE WHEN TG_OP = 'INSERT' THEN 'privileged_role_granted' ELSE 'privileged_role_revoked' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'Papel privilegiado concedido' ELSE 'Papel privilegiado removido' END,
    v_actor,
    v_user,
    'user_role',
    v_user::text,
    jsonb_build_object('role', v_role, 'operation', TG_OP)
  );
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_security_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS security_user_roles_change ON public.user_roles;
CREATE TRIGGER security_user_roles_change
AFTER INSERT OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.tg_security_role_change();

CREATE OR REPLACE FUNCTION public.tg_security_from_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.action = 'admin_export' THEN
    PERFORM public.record_security_event(
      'medium', 'export', 'admin_data_export', 'Exportação administrativa realizada',
      NEW.actor_id, NULL, NEW.entity, NEW.entity_id,
      coalesce(NEW.details, '{}'::jsonb)
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_security_from_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS security_from_audit ON public.audit_logs;
CREATE TRIGGER security_from_audit
AFTER INSERT ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_security_from_audit();

CREATE OR REPLACE FUNCTION public.admin_set_security_control(
  _control_key text,
  _completed boolean,
  _evidence text DEFAULT NULL,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  UPDATE public.security_controls
  SET completed = _completed,
      evidence = nullif(left(btrim(coalesce(_evidence,'')), 500), ''),
      notes = nullif(left(btrim(coalesce(_notes,'')), 1000), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  WHERE control_key = _control_key;

  IF NOT FOUND THEN RAISE EXCEPTION 'Controle de segurança não encontrado.'; END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(auth.uid(), 'security_control_updated', 'security_control', _control_key,
    jsonb_build_object('completed', _completed));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_security_control(text,boolean,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_security_control(text,boolean,text,text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_resolve_security_event(
  _event_id uuid,
  _resolution_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  UPDATE public.security_events
  SET resolved_at = now(),
      resolved_by = auth.uid(),
      resolution_note = nullif(left(btrim(coalesce(_resolution_note,'')), 1000), '')
  WHERE id = _event_id AND resolved_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado ou já resolvido.'; END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(auth.uid(), 'security_event_resolved', 'security_event', _event_id::text, '{}'::jsonb);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_resolve_security_event(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_resolve_security_event(uuid,text)
TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_security_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_result jsonb;
  v_sensitive_tables text[] := ARRAY[
    'profiles','user_roles','audit_logs','checkins','user_rewards',
    'reward_redemptions','event_chat_messages','security_events','security_controls'
  ];
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  SELECT jsonb_build_object(
    'generated_at', now(),
    'summary', jsonb_build_object(
      'open_events', (SELECT count(*) FROM public.security_events WHERE resolved_at IS NULL),
      'critical_open', (SELECT count(*) FROM public.security_events WHERE resolved_at IS NULL AND severity = 'critical'),
      'high_open', (SELECT count(*) FROM public.security_events WHERE resolved_at IS NULL AND severity = 'high'),
      'events_24h', (SELECT count(*) FROM public.security_events WHERE occurred_at >= now() - interval '24 hours'),
      'controls_complete', (SELECT count(*) FROM public.security_controls WHERE required AND completed),
      'controls_required', (SELECT count(*) FROM public.security_controls WHERE required),
      'privileged_accounts', (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role IN ('admin','moderador','equipe'))
    ),
    'posture', jsonb_build_array(
      jsonb_build_object(
        'key','rls_sensitive_tables','label','RLS nas tabelas sensíveis','ok',
        NOT EXISTS (
          SELECT 1
          FROM unnest(v_sensitive_tables) AS t(name)
          WHERE NOT coalesce((
            SELECT c.relrowsecurity
            FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relname = t.name
            LIMIT 1
          ), false)
        )
      ),
      jsonb_build_object(
        'key','audit_direct_write','label','Auditoria sem escrita direta','ok',
        NOT has_table_privilege('authenticated','public.audit_logs','INSERT')
        AND NOT has_table_privilege('authenticated','public.audit_logs','UPDATE')
        AND NOT has_table_privilege('authenticated','public.audit_logs','DELETE')
      ),
      jsonb_build_object(
        'key','public_schema_create','label','Schema público protegido','ok',
        NOT has_schema_privilege('authenticated','public','CREATE')
        AND NOT has_schema_privilege('anon','public','CREATE')
      ),
      jsonb_build_object(
        'key','profile_anonymous_read','label','Perfis brutos privados','ok',
        NOT has_table_privilege('anon','public.profiles','SELECT')
      ),
      jsonb_build_object(
        'key','privileged_mfa','label','MFA exigido nos papéis privilegiados','ok',
        position('aal2' in pg_get_functiondef('public.has_role(uuid,public.app_role)'::regprocedure)) > 0
      )
    ),
    'controls', coalesce((
      SELECT jsonb_agg(to_jsonb(sc) ORDER BY sc.category, sc.label)
      FROM public.security_controls sc
    ), '[]'::jsonb),
    'recent_events', coalesce((
      SELECT jsonb_agg(to_jsonb(se) ORDER BY se.occurred_at DESC)
      FROM (
        SELECT id, severity, category, event_key, title, actor_id, target_user_id,
               entity, entity_id, details, occurred_at, resolved_at, resolution_note
        FROM public.security_events
        ORDER BY occurred_at DESC
        LIMIT 100
      ) se
    ), '[]'::jsonb),
    'privileged_users', coalesce((
      SELECT jsonb_agg(to_jsonb(pu) ORDER BY pu.role, pu.display_name)
      FROM (
        SELECT ur.user_id, ur.role, p.display_name, p.username,
               u.last_sign_in_at, u.created_at,
               count(mf.id) FILTER (WHERE mf.status::text = 'verified')::integer AS verified_mfa_factors
        FROM public.user_roles ur
        LEFT JOIN public.profiles p ON p.id = ur.user_id
        LEFT JOIN auth.users u ON u.id = ur.user_id
        LEFT JOIN auth.mfa_factors mf ON mf.user_id = ur.user_id
        WHERE ur.role IN ('admin','moderador','equipe')
        GROUP BY ur.user_id, ur.role, p.display_name, p.username, u.last_sign_in_at, u.created_at
      ) pu
    ), '[]'::jsonb),
    'recent_exports', coalesce((
      SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
      FROM (
        SELECT id, actor_id, created_at, details
        FROM public.audit_logs
        WHERE action = 'admin_export'
        ORDER BY created_at DESC
        LIMIT 25
      ) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_security_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_security_snapshot() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_prune_security_events(_days integer DEFAULT 180)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_deleted integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;
  IF _days < 90 THEN RAISE EXCEPTION 'A retenção mínima é de 90 dias.'; END IF;

  DELETE FROM public.security_events
  WHERE resolved_at IS NOT NULL AND occurred_at < now() - make_interval(days => _days);
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO public.audit_logs(actor_id, action, entity, details)
  VALUES(auth.uid(), 'security_events_pruned', 'security_event', jsonb_build_object('days', _days, 'deleted', v_deleted));
  RETURN v_deleted;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_prune_security_events(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_prune_security_events(integer) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
