-- BAFAFÁ CONNECT V20.4
-- Prontidão para o piloto: consentimento, maioridade, privacidade, Resenha,
-- conversa privada e endurecimento das permissões de funções/Storage.
--
-- Riscos: novos usuários sem nascimento adulto válido não fazem check-in;
-- bloqueios encerram conversas privadas ativas; listagem anônima de Storage
-- deixa de funcionar, embora URLs públicas conhecidas continuem acessíveis.
--
-- Rollback orientado: restaurar as funções pela migration anterior, remover o
-- gatilho checkins_require_verified_adult e as políticas restritivas de Storage.
-- A tabela private_chat_reports deve ser preservada para não apagar histórico;
-- num rollback funcional, basta revogar os endpoints novos e ocultar a UI.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Pré-condições: falha cedo caso a migration seja apontada para outro app.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.events') IS NULL
     OR to_regclass('public.salve_requests') IS NULL
     OR to_regclass('public.private_chat_messages') IS NULL THEN
    RAISE EXCEPTION 'Estrutura do Bafafá Connect não encontrada. Confirme o projeto Supabase.';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 1. Privacidade por padrão para novos perfis.
-- Perfis existentes não são alterados automaticamente para preservar escolhas.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ALTER COLUMN is_public SET DEFAULT false,
  ALTER COLUMN show_birth_month SET DEFAULT false,
  ALTER COLUMN show_city SET DEFAULT false,
  ALTER COLUMN show_checkin_count SET DEFAULT false,
  ALTER COLUMN show_event_preferences SET DEFAULT false;

-- Buckets públicos continuam servindo URLs conhecidas, mas deixam de permitir
-- enumeração ampla. Donos e administração mantêm leitura/listagem restrita.
DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
DROP POLICY IF EXISTS "public_read_event_images" ON storage.objects;
DROP POLICY IF EXISTS "users_read_own_avatar_objects" ON storage.objects;
CREATE POLICY "users_read_own_avatar_objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "admins_read_event_image_objects" ON storage.objects;
CREATE POLICY "admins_read_event_image_objects"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'event-images'
  AND public.has_role((SELECT auth.uid()), 'admin')
);

-- ---------------------------------------------------------------------------
-- 2. Maioridade derivada da data de nascimento, nunca de metadado editável.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_verified_adult(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.deleted_at IS NULL
      AND p.is_over_18 = true
      AND p.birth_date IS NOT NULL
      AND p.birth_date <= (current_date - interval '18 years')::date
  )
$$;

REVOKE ALL ON FUNCTION public.is_verified_adult(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_verified_adult(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_require_adult_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NOT public.is_verified_adult(NEW.user_id) THEN
    RAISE EXCEPTION 'Confirme uma data de nascimento válida para fazer check-in.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_require_verified_adult ON public.checkins;
CREATE TRIGGER checkins_require_verified_adult
BEFORE INSERT ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.tg_require_adult_checkin();

REVOKE ALL ON FUNCTION public.tg_require_adult_checkin() FROM PUBLIC, anon, authenticated;

-- O acesso à Resenha também é reavaliado caso a data de nascimento mude
-- depois de um check-in histórico. Equipe e moderação mantêm acesso operacional.
CREATE OR REPLACE FUNCTION public.can_access_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'moderador')
     OR public.has_role(auth.uid(), 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT public.is_verified_adult(auth.uid()) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = auth.uid() AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  RETURN now() BETWEEN v_open AND v_close;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_read_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'moderador')
     OR public.has_role(auth.uid(), 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT public.is_verified_adult(auth.uid()) THEN RETURN false; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = auth.uid() AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  RETURN now() BETWEEN v_open AND (v_close + interval '48 hours');
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_event_chat(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_read_event_chat(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_event_chat(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_read_event_chat(uuid,uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Cadastro conciliado: campos de CRM da V20 + consentimentos da V16.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_display text;
  v_username text;
  v_whatsapp text;
  v_phone text;
  v_birth date;
  v_city text;
  v_claimed_over18 boolean;
  v_is_adult boolean;
  v_marketing boolean;
  v_consent_version text;
  v_first text;
  v_last text;
  v_welcome_title uuid;
BEGIN
  v_phone := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data->>'phone_e164', ''),
    nullif(new.raw_user_meta_data->>'whatsapp', '')
  );
  v_display := coalesce(
    nullif(new.raw_user_meta_data->>'display_name', ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'name', ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Bafafã'
  );
  v_first := coalesce(nullif(new.raw_user_meta_data->>'first_name', ''), split_part(v_display, ' ', 1));
  v_last := nullif(new.raw_user_meta_data->>'last_name', '');
  v_username := nullif(new.raw_user_meta_data->>'username', '');
  v_whatsapp := coalesce(nullif(new.raw_user_meta_data->>'whatsapp', ''), v_phone);
  v_city := nullif(new.raw_user_meta_data->>'city', '');
  v_claimed_over18 := lower(coalesce(new.raw_user_meta_data->>'is_over_18', 'false')) IN ('true','1','yes','on');
  v_marketing := lower(coalesce(new.raw_user_meta_data->>'marketing_opt_in', 'false')) IN ('true','1','yes','on');
  v_consent_version := left(coalesce(nullif(new.raw_user_meta_data->>'consent_version', ''), '2.1'), 32);

  BEGIN
    v_birth := (new.raw_user_meta_data->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    v_birth := null;
  END;
  v_is_adult := v_birth IS NOT NULL
    AND v_birth <= (current_date - interval '18 years')::date;

  INSERT INTO public.profiles(
    id, display_name, first_name, last_name, username, whatsapp, phone_e164,
    phone_verified_at, birth_date, city, is_over_18, is_public,
    show_birth_month, show_city, show_checkin_count, show_event_preferences
  )
  VALUES(
    new.id, v_display, v_first, v_last, v_username, v_whatsapp, v_phone,
    CASE WHEN new.phone_confirmed_at IS NOT NULL THEN new.phone_confirmed_at ELSE NULL END,
    v_birth, v_city, v_is_adult, false, false, false, false, false
  )
  ON CONFLICT(id) DO UPDATE SET
    display_name = coalesce(nullif(EXCLUDED.display_name, ''), public.profiles.display_name),
    first_name = coalesce(EXCLUDED.first_name, public.profiles.first_name),
    last_name = coalesce(EXCLUDED.last_name, public.profiles.last_name),
    phone_e164 = coalesce(EXCLUDED.phone_e164, public.profiles.phone_e164),
    phone_verified_at = coalesce(EXCLUDED.phone_verified_at, public.profiles.phone_verified_at),
    whatsapp = coalesce(EXCLUDED.whatsapp, public.profiles.whatsapp),
    birth_date = coalesce(EXCLUDED.birth_date, public.profiles.birth_date),
    is_over_18 = EXCLUDED.is_over_18,
    updated_at = now();

  INSERT INTO public.user_preferences(user_id, marketing_opt_in, notify_whatsapp)
  VALUES(new.id, v_marketing, v_marketing)
  ON CONFLICT(user_id) DO UPDATE SET
    marketing_opt_in = EXCLUDED.marketing_opt_in,
    notify_whatsapp = EXCLUDED.notify_whatsapp,
    updated_at = now();

  INSERT INTO public.user_roles(user_id, role)
  VALUES(new.id, 'gratuito')
  ON CONFLICT DO NOTHING;

  IF lower(coalesce(new.raw_user_meta_data->>'accept_terms', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES(new.id, 'termos', true, v_consent_version);
  END IF;
  IF lower(coalesce(new.raw_user_meta_data->>'accept_privacy', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES(new.id, 'privacidade', true, v_consent_version);
  END IF;
  IF lower(coalesce(new.raw_user_meta_data->>'accept_community', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES(new.id, 'comunidade', true, v_consent_version);
  END IF;
  IF v_claimed_over18 AND v_is_adult THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES(new.id, 'maioridade', true, v_consent_version);
  END IF;
  INSERT INTO public.user_consents(user_id, kind, accepted, version)
  VALUES(new.id, 'marketing', v_marketing, v_consent_version);

  SELECT id INTO v_welcome_title
  FROM public.title_definitions
  WHERE slug = 'cheguei-no-bafafa' AND is_active;

  IF v_welcome_title IS NOT NULL THEN
    INSERT INTO public.user_titles(user_id, title_id)
    VALUES(new.id, v_welcome_title)
    ON CONFLICT(user_id, title_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

-- ---------------------------------------------------------------------------
-- 4. Salves: leitura segura dos nomes, bloqueio coerente e limite de abuso.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_salve_requests(_event_id uuid)
RETURNS TABLE(
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  status text,
  opener text,
  created_at timestamptz,
  sender_name text,
  recipient_name text,
  thread_id uuid,
  other_user_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR NOT public.is_verified_adult(v_user) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.sender_id,
    sr.recipient_id,
    sr.status,
    sr.opener,
    sr.created_at,
    coalesce(ps.display_name, 'Bafafã'),
    coalesce(pr.display_name, 'Bafafã'),
    pct.id,
    CASE WHEN sr.sender_id = v_user THEN sr.recipient_id ELSE sr.sender_id END
  FROM public.salve_requests sr
  JOIN public.profiles ps ON ps.id = sr.sender_id AND ps.deleted_at IS NULL
  JOIN public.profiles pr ON pr.id = sr.recipient_id AND pr.deleted_at IS NULL
  LEFT JOIN public.private_chat_threads pct ON pct.salve_request_id = sr.id
  WHERE sr.event_id = _event_id
    AND v_user IN (sr.sender_id, sr.recipient_id)
  ORDER BY sr.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.my_salve_requests(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_salve_requests(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_salve_request(_event_id uuid, _recipient_id uuid, _opener text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_opener text := nullif(trim(coalesce(_opener, '')), '');
BEGIN
  IF v_user IS NULL OR NOT public.is_verified_adult(v_user) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;
  IF v_user = _recipient_id THEN RAISE EXCEPTION 'Você não pode mandar um salve para si.'; END IF;
  IF NOT public.is_verified_adult(_recipient_id) THEN RAISE EXCEPTION 'Conversa indisponível.'; END IF;
  IF v_opener IS NOT NULL AND char_length(v_opener) > 180 THEN
    RAISE EXCEPTION 'O quebra-gelo pode ter até 180 caracteres.';
  END IF;
  IF NOT public.can_access_event_chat(v_user, _event_id)
     OR NOT EXISTS (
       SELECT 1 FROM public.checkins c
       WHERE c.user_id = _recipient_id AND c.event_id = _event_id
     ) THEN
    RAISE EXCEPTION 'O salve só pode ser enviado entre participantes desta Resenha.';
  END IF;
  IF public.is_event_chat_blocked(v_user, _recipient_id) THEN
    RAISE EXCEPTION 'Não é possível enviar este salve.';
  END IF;
  IF (
    SELECT count(*)
    FROM public.salve_requests sr
    WHERE sr.sender_id = v_user AND sr.created_at > now() - interval '1 hour'
  ) >= 20 THEN
    RAISE EXCEPTION 'Você atingiu o limite de salves por agora. Tente mais tarde.';
  END IF;

  INSERT INTO public.salve_requests(event_id, sender_id, recipient_id, opener)
  VALUES(_event_id, v_user, _recipient_id, v_opener)
  ON CONFLICT (event_id, sender_id, recipient_id) WHERE status = 'pending'
  DO UPDATE SET opener = EXCLUDED.opener, created_at = now(), expires_at = now() + interval '24 hours'
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'request_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_salve_request(_request_id uuid, _accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_request public.salve_requests%ROWTYPE;
  v_thread uuid;
BEGIN
  IF v_user IS NULL OR NOT public.is_verified_adult(v_user) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  SELECT * INTO v_request
  FROM public.salve_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND OR v_request.recipient_id <> v_user THEN
    RAISE EXCEPTION 'Solicitação não encontrada.';
  END IF;
  IF v_request.status <> 'pending' OR v_request.expires_at <= now() THEN
    RAISE EXCEPTION 'Este salve não está mais disponível.';
  END IF;
  IF _accept AND (
    NOT public.is_verified_adult(v_request.sender_id)
    OR public.is_event_chat_blocked(v_user, v_request.sender_id)
  ) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  UPDATE public.salve_requests
  SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,
      responded_at = now()
  WHERE id = _request_id;

  IF _accept THEN
    INSERT INTO public.private_chat_threads(
      event_id, salve_request_id, member_one_id, member_two_id
    )
    VALUES(
      v_request.event_id,
      v_request.id,
      CASE WHEN v_request.sender_id::text < v_request.recipient_id::text
        THEN v_request.sender_id ELSE v_request.recipient_id END,
      CASE WHEN v_request.sender_id::text < v_request.recipient_id::text
        THEN v_request.recipient_id ELSE v_request.sender_id END
    )
    ON CONFLICT(salve_request_id) DO UPDATE SET status = 'active', updated_at = now()
    RETURNING id INTO v_thread;
  END IF;

  RETURN jsonb_build_object('ok', true, 'accepted', _accept, 'thread_id', v_thread);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_event_chat_block(_blocked_user_id uuid, _blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL OR _blocked_user_id = v_user THEN
    RAISE EXCEPTION 'Usuário inválido.';
  END IF;

  IF _blocked THEN
    INSERT INTO public.event_chat_blocks(user_id, blocked_user_id)
    VALUES(v_user, _blocked_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE public.private_chat_threads
    SET status = 'blocked', updated_at = now()
    WHERE status = 'active'
      AND v_user IN (member_one_id, member_two_id)
      AND _blocked_user_id IN (member_one_id, member_two_id);

    UPDATE public.salve_requests
    SET status = 'cancelled', responded_at = now()
    WHERE status = 'pending'
      AND (
        (sender_id = v_user AND recipient_id = _blocked_user_id)
        OR (sender_id = _blocked_user_id AND recipient_id = v_user)
      );
  ELSE
    DELETE FROM public.event_chat_blocks
    WHERE user_id = v_user AND blocked_user_id = _blocked_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.send_salve_request(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_salve_request(uuid,boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_event_chat_block(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_salve_request(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_salve_request(uuid,boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_event_chat_block(uuid,boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Conversa privada: limite, bloqueio, denúncia e fila de moderação.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.private_chat_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.private_chat_messages(id) ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES public.private_chat_threads(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam','assedio','ofensa','exposicao','outro')),
  details text CHECK (details IS NULL OR char_length(details) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS private_chat_reports_status_idx
  ON public.private_chat_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS private_chat_reports_thread_idx
  ON public.private_chat_reports(thread_id, created_at DESC);

ALTER TABLE public.private_chat_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.private_chat_reports TO authenticated;
GRANT ALL ON public.private_chat_reports TO service_role;

DROP POLICY IF EXISTS "Reporters and moderators read private reports" ON public.private_chat_reports;
CREATE POLICY "Reporters and moderators read private reports"
ON public.private_chat_reports FOR SELECT TO authenticated
USING (
  reporter_id = (SELECT auth.uid())
  OR public.has_role((SELECT auth.uid()), 'admin')
  OR public.has_role((SELECT auth.uid()), 'moderador')
);

CREATE OR REPLACE FUNCTION public.send_private_message(_thread_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_id uuid;
  v_body text := trim(coalesce(_body, ''));
  v_thread public.private_chat_threads%ROWTYPE;
  v_other uuid;
BEGIN
  IF v_user IS NULL OR NOT public.is_verified_adult(v_user) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  SELECT * INTO v_thread
  FROM public.private_chat_threads t
  WHERE t.id = _thread_id
  FOR UPDATE;

  IF NOT FOUND OR v_thread.status <> 'active'
     OR v_user NOT IN (v_thread.member_one_id, v_thread.member_two_id) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  v_other := CASE WHEN v_user = v_thread.member_one_id
    THEN v_thread.member_two_id ELSE v_thread.member_one_id END;

  IF NOT public.is_verified_adult(v_other)
     OR public.is_event_chat_blocked(v_user, v_other) THEN
    UPDATE public.private_chat_threads
    SET status = 'blocked', updated_at = now()
    WHERE id = _thread_id;
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;

  IF char_length(v_body) < 1 OR char_length(v_body) > 1000 THEN
    RAISE EXCEPTION 'A mensagem deve ter entre 1 e 1000 caracteres.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.private_chat_messages m
    WHERE m.sender_id = v_user AND m.created_at > now() - interval '2 seconds'
  ) THEN
    RAISE EXCEPTION 'Espere alguns segundos para mandar outra mensagem.';
  END IF;
  IF (
    SELECT count(*) FROM public.private_chat_messages m
    WHERE m.sender_id = v_user AND m.created_at > now() - interval '1 minute'
  ) >= 15 THEN
    RAISE EXCEPTION 'Você atingiu o limite de mensagens por minuto.';
  END IF;

  INSERT INTO public.private_chat_messages(thread_id, sender_id, body)
  VALUES(_thread_id, v_user, v_body)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.report_private_chat_message(
  _message_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message public.private_chat_messages%ROWTYPE;
  v_thread public.private_chat_threads%ROWTYPE;
  v_report_id uuid;
  v_details text := nullif(trim(coalesce(_details, '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _reason NOT IN ('spam','assedio','ofensa','exposicao','outro') THEN
    RAISE EXCEPTION 'Escolha um motivo válido.';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    RAISE EXCEPTION 'Os detalhes podem ter até 500 caracteres.';
  END IF;

  SELECT * INTO v_message
  FROM public.private_chat_messages m
  WHERE m.id = _message_id AND m.deleted_at IS NULL;
  IF NOT FOUND OR v_message.sender_id = v_user THEN
    RAISE EXCEPTION 'Mensagem não encontrada.';
  END IF;

  SELECT * INTO v_thread
  FROM public.private_chat_threads t
  WHERE t.id = v_message.thread_id
    AND v_user IN (t.member_one_id, t.member_two_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'Conversa indisponível.'; END IF;

  INSERT INTO public.private_chat_reports(
    message_id, thread_id, reporter_id, reported_user_id, reason, details
  )
  VALUES(
    v_message.id, v_message.thread_id, v_user, v_message.sender_id, _reason, v_details
  )
  ON CONFLICT(message_id, reporter_id) DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    status = 'open',
    resolved_by = NULL,
    resolved_at = NULL
  RETURNING id INTO v_report_id;

  RETURN v_report_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_private_chat_report_queue()
RETURNS TABLE(
  report_id uuid,
  message_id uuid,
  thread_id uuid,
  reporter_id uuid,
  reported_user_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  message_body text,
  author_name text,
  reporter_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderador')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à moderação.';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.message_id,
    r.thread_id,
    r.reporter_id,
    r.reported_user_id,
    r.reason,
    r.details,
    r.status,
    r.created_at,
    m.body,
    coalesce(pa.display_name, 'Bafafã'),
    coalesce(pr.display_name, 'Bafafã')
  FROM public.private_chat_reports r
  JOIN public.private_chat_messages m ON m.id = r.message_id
  JOIN public.profiles pa ON pa.id = r.reported_user_id
  JOIN public.profiles pr ON pr.id = r.reporter_id
  ORDER BY CASE WHEN r.status = 'open' THEN 0 ELSE 1 END, r.created_at DESC
  LIMIT 500;
END;
$$;

CREATE OR REPLACE FUNCTION public.moderate_private_chat_report(_report_id uuid, _action text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_report public.private_chat_reports%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT (
    public.has_role(v_actor, 'admin') OR public.has_role(v_actor, 'moderador')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à moderação.';
  END IF;
  IF _action NOT IN ('remove_message','close_conversation','dismiss') THEN
    RAISE EXCEPTION 'Ação de moderação inválida.';
  END IF;

  SELECT * INTO v_report
  FROM public.private_chat_reports
  WHERE id = _report_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Denúncia não encontrada.'; END IF;

  IF _action IN ('remove_message','close_conversation') THEN
    UPDATE public.private_chat_messages
    SET deleted_at = coalesce(deleted_at, now())
    WHERE id = v_report.message_id;
  END IF;
  IF _action = 'close_conversation' THEN
    UPDATE public.private_chat_threads
    SET status = 'closed', updated_at = now()
    WHERE id = v_report.thread_id;
  END IF;

  UPDATE public.private_chat_reports
  SET status = CASE WHEN _action = 'dismiss' THEN 'dismissed' ELSE 'resolved' END,
      resolved_by = v_actor,
      resolved_at = now()
  WHERE id = _report_id;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(
    v_actor,
    'moderate_private_chat_report',
    'private_chat_report',
    _report_id::text,
    jsonb_build_object('action', _action, 'thread_id', v_report.thread_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_private_message(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.report_private_chat_message(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_private_chat_report_queue() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderate_private_chat_report(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_private_message(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_private_chat_message(uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_private_chat_report_queue() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.moderate_private_chat_report(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Funções de gatilho não são endpoints. Remove EXECUTE direto dos clientes.
-- Funções de produto continuam com concessões explícitas e são revisadas à parte.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_function record;
BEGIN
  FOR v_function IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prorettype = 'trigger'::regtype
  LOOP
    EXECUTE format(
      'REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      v_function.signature
    );
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

NOTIFY pgrst, 'reload schema';
COMMIT;
