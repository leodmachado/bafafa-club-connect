BEGIN;

-- =====================================================================
-- BAFAFÁ V6 — perfil 100% atingível + Resenha do Evento
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Perfil: uma única regra no banco, atingível durante o login por e-mail
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.profile_completion_details(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  prefs public.user_preferences%ROWTYPE;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_complete boolean;
BEGIN
  SELECT * INTO p FROM public.profiles WHERE id = _user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('percentage', 0, 'items', '[]'::jsonb, 'next_key', NULL);
  END IF;

  SELECT * INTO prefs FROM public.user_preferences WHERE user_id = _user_id;

  v_complete := coalesce(trim(p.display_name), '') <> '' AND p.birth_date IS NOT NULL;
  IF v_complete THEN v_total := v_total + 20; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','identity','label','Nome e nascimento','weight',20,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.city), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','city','label','Cidade','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.neighborhood), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','neighborhood','label','Bairro','weight',10,'complete',v_complete
  ));

  v_complete := prefs.event_categories IS NOT NULL AND coalesce(array_length(prefs.event_categories, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 15; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','events','label','Preferências de eventos','weight',15,'complete',v_complete
  ));

  v_complete := prefs.drink_preferences IS NOT NULL AND coalesce(array_length(prefs.drink_preferences, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','drinks','label','Preferências de bebidas','weight',10,'complete',v_complete
  ));

  v_complete := prefs.food_preferences IS NOT NULL AND coalesce(array_length(prefs.food_preferences, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','foods','label','Preferências de comidas','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.how_found_us), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','origin','label','Como conheceu o Bafafá','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.avatar_url), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','avatar','label','Foto do perfil','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.username), '') <> '';
  IF v_complete THEN v_total := v_total + 5; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','username','label','Nome de usuário','weight',5,'complete',v_complete
  ));

  RETURN jsonb_build_object(
    'percentage', least(v_total, 100),
    'items', v_items,
    'next_key', (
      SELECT item->>'key'
      FROM jsonb_array_elements(v_items) item
      WHERE coalesce((item->>'complete')::boolean, false) = false
      LIMIT 1
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce((public.profile_completion_details(_user_id)->>'percentage')::integer, 0);
$$;

CREATE OR REPLACE FUNCTION public.my_profile_completion_details()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_completion_details(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.my_profile_completeness()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.calculate_profile_completeness(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.profile_completion_details(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_profile_completeness(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_profile_completion_details() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_profile_completeness() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_completion_details(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_profile_completeness(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.my_profile_completion_details() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile_completeness() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_profile_completion_overview()
RETURNS TABLE(user_id uuid, percentage integer, details jsonb)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  RETURN QUERY
  SELECT p.id, public.calculate_profile_completeness(p.id), public.profile_completion_details(p.id)
  FROM public.profiles p
  WHERE p.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_profile_completion_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_profile_completion_overview() TO authenticated, service_role;

-- Mantém a maioridade coerente quando o nascimento é alterado pelo perfil.
CREATE OR REPLACE FUNCTION public.tg_sync_profile_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.birth_date IS NOT NULL AND NEW.birth_date > current_date THEN
    RAISE EXCEPTION 'Data de nascimento inválida.';
  END IF;
  NEW.is_over_18 := NEW.birth_date IS NOT NULL
    AND NEW.birth_date <= (current_date - interval '18 years')::date;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_sync_age ON public.profiles;
CREATE TRIGGER profiles_sync_age
  BEFORE INSERT OR UPDATE OF birth_date ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_sync_profile_age();

-- Reavalia os perfis existentes e concede Perfil no Grau quando aplicável.
SELECT public.award_profile_progress(id) FROM public.profiles WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------
-- 2. Eventos: controle da sala de Resenha
-- ---------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS chat_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chat_opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_closes_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_events_chat_enabled ON public.events(chat_enabled) WHERE chat_enabled;

-- ---------------------------------------------------------------------
-- 3. Mensagens, denúncias e bloqueios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 300),
  reply_to uuid REFERENCES public.event_chat_messages(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'visible' CHECK (status IN ('visible','deleted','moderated')),
  moderation_reason text,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_chat_messages_event_time
  ON public.event_chat_messages(event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_chat_messages_user_time
  ON public.event_chat_messages(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.event_chat_messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','assedio','ofensa','exposicao','outro')),
  details text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS idx_event_chat_reports_status
  ON public.event_chat_reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.event_chat_blocks (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id, blocked_user_id),
  CHECK (user_id <> blocked_user_id)
);

GRANT SELECT ON public.event_chat_messages TO authenticated;
GRANT SELECT ON public.event_chat_reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.event_chat_blocks TO authenticated;
GRANT ALL ON public.event_chat_messages, public.event_chat_reports, public.event_chat_blocks TO service_role;

ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_blocks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'moderador')
     OR public.has_role(_user_id, 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.user_id = _user_id AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  RETURN now() BETWEEN v_open AND v_close;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_event_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_event_chat(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_event_chat_blocked(_viewer uuid, _author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_chat_blocks b
    WHERE (b.user_id = _viewer AND b.blocked_user_id = _author)
       OR (b.user_id = _author AND b.blocked_user_id = _viewer)
  );
$$;

REVOKE ALL ON FUNCTION public.is_event_chat_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_chat_blocked(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Checked-in users read event chat" ON public.event_chat_messages;
CREATE POLICY "Checked-in users read event chat"
ON public.event_chat_messages FOR SELECT TO authenticated
USING (
  public.can_access_event_chat(auth.uid(), event_id)
  AND (
    status = 'visible'
    OR user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderador')
    OR NOT public.is_event_chat_blocked(auth.uid(), user_id)
  )
);

DROP POLICY IF EXISTS "Moderators read chat reports" ON public.event_chat_reports;
CREATE POLICY "Moderators read chat reports"
ON public.event_chat_reports FOR SELECT TO authenticated
USING (
  reporter_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'moderador')
);

DROP POLICY IF EXISTS "Users read own chat blocks" ON public.event_chat_blocks;
CREATE POLICY "Users read own chat blocks"
ON public.event_chat_blocks FOR SELECT TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users create own chat blocks" ON public.event_chat_blocks;
CREATE POLICY "Users create own chat blocks"
ON public.event_chat_blocks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND blocked_user_id <> auth.uid());

DROP POLICY IF EXISTS "Users remove own chat blocks" ON public.event_chat_blocks;
CREATE POLICY "Users remove own chat blocks"
ON public.event_chat_blocks FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.my_event_chat_rooms()
RETURNS TABLE(
  event_id uuid,
  event_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  image_url text,
  category text,
  chat_closes_at timestamptz,
  message_count bigint,
  last_message_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.starts_at,
    e.ends_at,
    e.image_url,
    e.category,
    coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours'),
    count(m.id) FILTER (WHERE m.status = 'visible'),
    max(m.created_at) FILTER (WHERE m.status = 'visible')
  FROM public.events e
  LEFT JOIN public.event_chat_messages m ON m.event_id = e.id
  WHERE public.can_access_event_chat(auth.uid(), e.id)
  GROUP BY e.id
  ORDER BY e.starts_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.my_event_chat_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_chat_rooms() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_event_chat_feed(_event_id uuid, _limit integer DEFAULT 80)
RETURNS TABLE(
  message_id uuid,
  event_id uuid,
  author_id uuid,
  body text,
  reply_to uuid,
  created_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text,
  author_title text,
  author_badges jsonb,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(_limit, 80), 150));
BEGIN
  IF NOT public.can_access_event_chat(v_user, _event_id) THEN
    RAISE EXCEPTION 'Faça check-in neste evento para entrar na Resenha.';
  END IF;

  RETURN QUERY
  SELECT q.id, q.event_id, q.user_id, q.body, q.reply_to, q.created_at,
         coalesce(p.display_name, 'Bafafã'), p.username, p.avatar_url,
         td.name,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
             'slug', bd.slug,
             'name', bd.name,
             'description', bd.description,
             'icon', bd.icon
           ) ORDER BY CASE WHEN bd.slug = 'bafafa-fundador' THEN 0 ELSE 1 END, bd.sort_order)
           FROM public.user_badges ub
           JOIN public.badge_definitions bd ON bd.id = ub.badge_id
           WHERE ub.user_id = q.user_id AND ub.is_hidden = false AND bd.is_active = true
         ), '[]'::jsonb),
         q.user_id = v_user
  FROM (
    SELECT m.*
    FROM public.event_chat_messages m
    WHERE m.event_id = _event_id
      AND m.status = 'visible'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_chat_blocks b
        WHERE (b.user_id = v_user AND b.blocked_user_id = m.user_id)
           OR (b.user_id = m.user_id AND b.blocked_user_id = v_user)
      )
    ORDER BY m.created_at DESC
    LIMIT v_limit
  ) q
  JOIN public.profiles p ON p.id = q.user_id
  LEFT JOIN public.title_definitions td ON td.id = p.active_title_id AND td.is_active
  ORDER BY q.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_chat_feed(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_chat_feed(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_event_chat_message(
  _event_id uuid,
  _body text,
  _reply_to uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_body text := trim(coalesce(_body, ''));
  v_id uuid;
BEGIN
  IF NOT public.can_access_event_chat(v_user, _event_id) THEN
    RAISE EXCEPTION 'Faça check-in neste evento para entrar na Resenha.';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 300 THEN
    RAISE EXCEPTION 'A mensagem deve ter entre 1 e 300 caracteres.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_chat_messages
    WHERE user_id = v_user AND created_at > now() - interval '3 seconds'
  ) THEN
    RAISE EXCEPTION 'Calma na fofoca: espere alguns segundos para mandar outra mensagem.';
  END IF;

  IF (
    SELECT count(*) FROM public.event_chat_messages
    WHERE user_id = v_user AND created_at > now() - interval '1 minute'
  ) >= 8 THEN
    RAISE EXCEPTION 'Você atingiu o limite de mensagens por minuto.';
  END IF;

  IF _reply_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.event_chat_messages
    WHERE id = _reply_to AND event_id = _event_id AND status = 'visible'
  ) THEN
    RAISE EXCEPTION 'A mensagem respondida não está mais disponível.';
  END IF;

  INSERT INTO public.event_chat_messages(event_id, user_id, body, reply_to)
  VALUES (_event_id, v_user, v_body, _reply_to)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_event_chat_message(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_event_chat_message(uuid, text, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_event_chat_message(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message public.event_chat_messages%ROWTYPE;
  v_is_moderator boolean;
BEGIN
  SELECT * INTO v_message FROM public.event_chat_messages WHERE id = _message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada.'; END IF;

  v_is_moderator := public.has_role(v_user, 'admin') OR public.has_role(v_user, 'moderador');
  IF v_message.user_id <> v_user AND NOT v_is_moderator THEN
    RAISE EXCEPTION 'Você não pode apagar esta mensagem.';
  END IF;

  UPDATE public.event_chat_messages
  SET status = CASE WHEN v_is_moderator AND v_message.user_id <> v_user THEN 'moderated' ELSE 'deleted' END,
      moderation_reason = CASE WHEN v_is_moderator AND v_message.user_id <> v_user THEN 'Removida pela moderação' ELSE moderation_reason END,
      moderated_by = CASE WHEN v_is_moderator AND v_message.user_id <> v_user THEN v_user ELSE moderated_by END,
      deleted_at = now(),
      updated_at = now()
  WHERE id = _message_id;

  IF v_is_moderator AND v_message.user_id <> v_user THEN
    INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
    VALUES (v_user, 'moderate_chat_message', 'event_chat_messages', _message_id::text,
      jsonb_build_object('event_id', v_message.event_id, 'author_id', v_message.user_id));
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_event_chat_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_event_chat_message(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.report_event_chat_message(
  _message_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message public.event_chat_messages%ROWTYPE;
BEGIN
  SELECT * INTO v_message FROM public.event_chat_messages WHERE id = _message_id AND status = 'visible';
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada.'; END IF;
  IF NOT public.can_access_event_chat(v_user, v_message.event_id) THEN RAISE EXCEPTION 'Sem acesso à sala.'; END IF;
  IF v_message.user_id = v_user THEN RAISE EXCEPTION 'Você não pode denunciar sua própria mensagem.'; END IF;
  IF _reason NOT IN ('spam','assedio','ofensa','exposicao','outro') THEN RAISE EXCEPTION 'Motivo inválido.'; END IF;

  INSERT INTO public.event_chat_reports(message_id, reporter_id, reason, details)
  VALUES (_message_id, v_user, _reason, nullif(trim(coalesce(_details,'')),''))
  ON CONFLICT (message_id, reporter_id) DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    status = 'open',
    resolved_by = NULL,
    resolved_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.report_event_chat_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_event_chat_message(uuid, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_event_chat_block(_blocked_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR _blocked_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF _blocked THEN
    INSERT INTO public.event_chat_blocks(user_id, blocked_user_id)
    VALUES (auth.uid(), _blocked_user_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.event_chat_blocks
    WHERE user_id = auth.uid() AND blocked_user_id = _blocked_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_event_chat_block(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_event_chat_block(uuid, boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.moderate_event_chat_message(
  _message_id uuid,
  _restore boolean DEFAULT false,
  _reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message public.event_chat_messages%ROWTYPE;
BEGIN
  IF NOT (public.has_role(v_user, 'admin') OR public.has_role(v_user, 'moderador')) THEN
    RAISE EXCEPTION 'Acesso restrito à moderação.';
  END IF;

  SELECT * INTO v_message FROM public.event_chat_messages WHERE id = _message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada.'; END IF;

  UPDATE public.event_chat_messages
  SET status = CASE WHEN _restore THEN 'visible' ELSE 'moderated' END,
      moderation_reason = CASE WHEN _restore THEN NULL ELSE nullif(trim(coalesce(_reason,'')), '') END,
      moderated_by = CASE WHEN _restore THEN NULL ELSE v_user END,
      deleted_at = CASE WHEN _restore THEN NULL ELSE now() END,
      updated_at = now()
  WHERE id = _message_id;

  UPDATE public.event_chat_reports
  SET status = CASE WHEN _restore THEN 'dismissed' ELSE 'resolved' END,
      resolved_by = v_user,
      resolved_at = now()
  WHERE message_id = _message_id AND status = 'open';

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (v_user, CASE WHEN _restore THEN 'restore_chat_message' ELSE 'hide_chat_message' END,
    'event_chat_messages', _message_id::text,
    jsonb_build_object('event_id', v_message.event_id, 'reason', _reason));
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_event_chat_message(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.moderate_event_chat_message(uuid, boolean, text) TO authenticated, service_role;

-- Realtime simples para o MVP. As mensagens continuam protegidas por RLS.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'event_chat_messages'
     ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages';
  END IF;
END;
$$;

-- Ativa o módulo globalmente, mantendo cada evento desativado até o ADM ligar.
INSERT INTO public.app_settings(key, value, description)
VALUES ('feature_flags', '{"fofoquinhas":false,"reservas":false,"assinaturas":false,"indicacoes":false,"chat":true,"phone_auth":false,"email_auth_public":true}'::jsonb,
  'Módulos ativos/desativados do app.')
ON CONFLICT (key) DO UPDATE
SET value = jsonb_set(coalesce(public.app_settings.value, '{}'::jsonb), '{chat}', 'true'::jsonb, true),
    updated_at = now();

COMMIT;
