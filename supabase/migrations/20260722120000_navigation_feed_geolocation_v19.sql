-- ============================================================================
-- BAFAFÁ V19 — Feed, Fofoquinhas, check-in por localização e carteirinha
-- Idempotente, compatível com as proteções V15–V18 e sem excluir dados.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Carteirinha inclusiva
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gender_identity text,
  ADD COLUMN IF NOT EXISTS gender_custom text,
  ADD COLUMN IF NOT EXISTS pronouns text,
  ADD COLUMN IF NOT EXISTS show_gender boolean NOT NULL DEFAULT false;

GRANT UPDATE (gender_identity, gender_custom, pronouns, show_gender)
ON public.profiles TO authenticated;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_identity_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_identity_check CHECK (
  gender_identity IS NULL OR gender_identity IN (
    'mulher','homem','nao_binaria','outra','prefiro_descrever','prefiro_nao_informar'
  )
);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_custom_length_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_gender_custom_length_check
  CHECK (gender_custom IS NULL OR char_length(gender_custom) <= 80);
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pronouns_length_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_pronouns_length_check
  CHECK (pronouns IS NULL OR char_length(pronouns) <= 40);

-- ---------------------------------------------------------------------------
-- 2. Eventos preparados para geolocalização
-- Coordenadas exatas não são gravadas no check-in; apenas distância e precisão.
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS geolocation_checkin_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS venue_latitude double precision,
  ADD COLUMN IF NOT EXISTS venue_longitude double precision,
  ADD COLUMN IF NOT EXISTS geofence_radius_m integer NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS max_location_accuracy_m integer NOT NULL DEFAULT 80;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_latitude_check;
ALTER TABLE public.events ADD CONSTRAINT events_latitude_check
  CHECK (venue_latitude IS NULL OR venue_latitude BETWEEN -90 AND 90);
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_longitude_check;
ALTER TABLE public.events ADD CONSTRAINT events_longitude_check
  CHECK (venue_longitude IS NULL OR venue_longitude BETWEEN -180 AND 180);
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_geofence_radius_check;
ALTER TABLE public.events ADD CONSTRAINT events_geofence_radius_check
  CHECK (geofence_radius_m BETWEEN 20 AND 500);
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_location_accuracy_check;
ALTER TABLE public.events ADD CONSTRAINT events_location_accuracy_check
  CHECK (max_location_accuracy_m BETWEEN 20 AND 500);

-- ---------------------------------------------------------------------------
-- 3. Campanhas por evento, promoções gerais e missões de fidelidade
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS campaign_kind text NOT NULL DEFAULT 'event',
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'event_checkin',
  ADD COLUMN IF NOT EXISTS trigger_target integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trigger_category text,
  ADD COLUMN IF NOT EXISTS feed_priority integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS feed_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS requires_staff_validation boolean NOT NULL DEFAULT true;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_kind_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_kind_check
  CHECK (campaign_kind IN ('event','milestone','global'));
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_type_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_trigger_type_check CHECK (
  trigger_type IN (
    'event_checkin','distinct_checkins','total_checkins','profile_completion',
    'category_checkins','manual','none'
  )
);
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_trigger_target_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_trigger_target_check
  CHECK (trigger_target BETWEEN 1 AND 1000);
ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_feed_priority_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_feed_priority_check
  CHECK (feed_priority BETWEEN -100 AND 1000);

UPDATE public.campaigns
SET campaign_kind = CASE WHEN event_id IS NULL THEN 'global' ELSE 'event' END,
    trigger_type = CASE WHEN event_id IS NULL THEN 'none' ELSE 'event_checkin' END
WHERE campaign_kind = 'event' AND event_id IS NULL;

CREATE INDEX IF NOT EXISTS campaigns_feed_v19_idx
  ON public.campaigns (status, is_pinned DESC, feed_priority DESC, starts_at DESC)
  WHERE feed_visible;

-- ---------------------------------------------------------------------------
-- 4. Publicações oficiais para o feed
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feed_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_type text NOT NULL DEFAULT 'news'
    CHECK (post_type IN ('news','photo','notice','behind_scenes')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  body text CHECK (body IS NULL OR char_length(body) <= 1200),
  image_url text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  is_pinned boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0 CHECK (priority BETWEEN -100 AND 1000),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS feed_posts_active_v19_idx
  ON public.feed_posts (is_pinned DESC, priority DESC, starts_at DESC)
  WHERE status = 'published';

ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.feed_posts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.feed_posts TO authenticated;
GRANT ALL ON public.feed_posts TO service_role;

DROP POLICY IF EXISTS "Authenticated read active feed posts" ON public.feed_posts;
CREATE POLICY "Authenticated read active feed posts"
ON public.feed_posts FOR SELECT TO authenticated
USING (
  status = 'published'
  AND starts_at <= now()
  AND (ends_at IS NULL OR ends_at >= now())
);

DROP POLICY IF EXISTS "Admins manage feed posts" ON public.feed_posts;
CREATE POLICY "Admins manage feed posts"
ON public.feed_posts FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS feed_posts_updated_at_v19 ON public.feed_posts;
CREATE TRIGGER feed_posts_updated_at_v19
BEFORE UPDATE ON public.feed_posts
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. Progresso e concessão de missões
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.campaign_progress_for_user(
  _user_id uuid,
  _campaign_id uuid
)
RETURNS TABLE(progress_value integer, target_value integer, completed boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_progress integer := 0;
BEGIN
  -- Função interna: execução direta foi revogada de clientes.
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = _campaign_id;
  IF NOT FOUND THEN RETURN; END IF;

  CASE v_campaign.trigger_type
    WHEN 'distinct_checkins' THEN
      SELECT count(DISTINCT c.event_id)::integer INTO v_progress
      FROM public.checkins c
      WHERE c.user_id = _user_id
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr','manual','code','qr_confirmed')
        );
    WHEN 'total_checkins' THEN
      SELECT count(*)::integer INTO v_progress
      FROM public.checkins c
      WHERE c.user_id = _user_id
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr','manual','code','qr_confirmed')
        );
    WHEN 'profile_completion' THEN
      v_progress := public.calculate_profile_completeness(_user_id);
    WHEN 'category_checkins' THEN
      SELECT count(DISTINCT c.event_id)::integer INTO v_progress
      FROM public.checkins c
      JOIN public.events e ON e.id = c.event_id
      WHERE c.user_id = _user_id
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr','manual','code','qr_confirmed')
        )
        AND lower(e.category) = lower(coalesce(v_campaign.trigger_category, ''));
    WHEN 'event_checkin' THEN
      SELECT CASE WHEN EXISTS (
        SELECT 1 FROM public.checkins c
        WHERE c.user_id = _user_id AND c.event_id = v_campaign.event_id
          AND (
            NOT v_campaign.requires_staff_validation
            OR c.staff_id IS NOT NULL
            OR c.method IN ('qr','manual','code','qr_confirmed')
          )
      ) THEN 1 ELSE 0 END INTO v_progress;
    ELSE
      v_progress := 0;
  END CASE;

  RETURN QUERY SELECT
    LEAST(v_progress, v_campaign.trigger_target),
    v_campaign.trigger_target,
    v_progress >= v_campaign.trigger_target;
END;
$$;
REVOKE ALL ON FUNCTION public.campaign_progress_for_user(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_progress_for_user(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_user_milestone_rewards(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_progress record;
  v_total integer;
  v_user_total integer;
  v_expiration timestamptz;
  v_granted integer := 0;
BEGIN
  -- Função interna: execução direta foi revogada de clientes.
  FOR v_campaign IN
    SELECT c.* FROM public.campaigns c
    WHERE c.status = 'active'
      AND c.starts_at <= now()
      AND (c.ends_at IS NULL OR c.ends_at >= now())
      AND (
        (c.campaign_kind = 'milestone' AND c.trigger_type IN (
          'distinct_checkins','total_checkins','profile_completion','category_checkins'
        ))
        OR (c.campaign_kind = 'global' AND c.trigger_type = 'none')
      )
  LOOP
    IF v_campaign.campaign_kind = 'milestone' THEN
      SELECT * INTO v_progress
      FROM public.campaign_progress_for_user(_user_id, v_campaign.id);
      IF NOT coalesce(v_progress.completed, false) THEN CONTINUE; END IF;
    END IF;

    -- Campanhas gerais podem exigir qualquer presença confirmada durante o período,
    -- sem ficarem presas a um evento específico.
    IF v_campaign.requires_checkin AND NOT EXISTS (
      SELECT 1 FROM public.checkins ci
      WHERE ci.user_id = _user_id
        AND ci.created_at >= v_campaign.starts_at
        AND (v_campaign.ends_at IS NULL OR ci.created_at <= v_campaign.ends_at)
        AND (
          NOT v_campaign.requires_staff_validation
          OR ci.staff_id IS NOT NULL
          OR ci.method IN ('qr','manual','code','qr_confirmed')
        )
    ) THEN CONTINUE; END IF;

    IF v_campaign.requires_min_profile AND public.calculate_profile_completeness(_user_id) < 40 THEN CONTINUE; END IF;
    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = _user_id AND ub.badge_id = v_campaign.required_badge_id
    ) THEN CONTINUE; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || v_campaign.id::text, 0));
    SELECT count(*) INTO v_total FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.status <> 'revoked';
    SELECT count(*) INTO v_user_total FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.user_id = _user_id AND ur.status <> 'revoked';
    IF v_campaign.total_available IS NOT NULL AND v_total >= v_campaign.total_available THEN CONTINUE; END IF;
    IF v_user_total >= v_campaign.per_user_limit THEN CONTINUE; END IF;

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
    IF v_campaign.ends_at IS NOT NULL THEN
      v_expiration := least(v_expiration, v_campaign.ends_at);
    END IF;
    INSERT INTO public.user_rewards(user_id, campaign_id, event_id, expires_at)
    VALUES (_user_id, v_campaign.id, NULL, v_expiration);
    v_granted := v_granted + 1;
  END LOOP;

  RETURN v_granted;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_user_milestone_rewards(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_milestone_rewards(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.my_fofoquinhas()
RETURNS TABLE(
  campaign_id uuid,
  name text,
  description text,
  benefit_type text,
  discount_percent numeric,
  fixed_off_cents integer,
  product_name text,
  public_rules text,
  campaign_kind text,
  trigger_type text,
  trigger_target integer,
  progress_value integer,
  completed boolean,
  reward_id uuid,
  reward_status text,
  reward_expires_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  is_pinned boolean,
  feed_priority integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  PERFORM public.refresh_user_milestone_rewards(v_user);

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.description,
    c.benefit_type,
    c.discount_percent,
    c.fixed_off_cents,
    c.product_name,
    c.public_rules,
    c.campaign_kind,
    c.trigger_type,
    c.trigger_target,
    coalesce(p.progress_value, 0),
    coalesce(p.completed, false),
    r.id,
    r.status,
    r.expires_at,
    c.starts_at,
    c.ends_at,
    c.is_pinned,
    c.feed_priority
  FROM public.campaigns c
  LEFT JOIN LATERAL public.campaign_progress_for_user(v_user, c.id) p ON true
  LEFT JOIN LATERAL (
    SELECT ur.id, ur.status, ur.expires_at
    FROM public.user_rewards ur
    WHERE ur.user_id = v_user AND ur.campaign_id = c.id AND ur.status <> 'revoked'
    ORDER BY ur.created_at DESC LIMIT 1
  ) r ON true
  WHERE c.status = 'active'
    AND c.feed_visible
    AND c.starts_at <= now()
    AND (c.ends_at IS NULL OR c.ends_at >= now())
  ORDER BY c.is_pinned DESC, c.feed_priority DESC, c.starts_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.my_fofoquinhas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_fofoquinhas() TO authenticated, service_role;

-- Concessão de benefícios financeiros de evento é exclusivamente operacional.
CREATE OR REPLACE FUNCTION public.grant_event_campaign_rewards(
  _user_id uuid,
  _event_id uuid,
  _checkin_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_profile integer;
  v_expiration timestamptz;
  v_total integer;
  v_user_total integer;
  v_rows integer;
  v_granted integer := 0;
BEGIN
  v_profile := public.calculate_profile_completeness(_user_id);

  FOR v_campaign IN
    SELECT c.* FROM public.campaigns c
    WHERE c.event_id = _event_id
      AND c.campaign_kind = 'event'
      AND c.status = 'active'
      AND c.starts_at <= now()
      AND (c.ends_at IS NULL OR c.ends_at >= now())
  LOOP
    IF v_campaign.requires_min_profile AND v_profile < 40 THEN CONTINUE; END IF;
    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub
      WHERE ub.user_id = _user_id AND ub.badge_id = v_campaign.required_badge_id
    ) THEN CONTINUE; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(_user_id::text || v_campaign.id::text, 0));
    SELECT count(*) INTO v_total FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.status <> 'revoked';
    SELECT count(*) INTO v_user_total FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.user_id = _user_id AND ur.status <> 'revoked';
    IF v_campaign.total_available IS NOT NULL AND v_total >= v_campaign.total_available THEN CONTINUE; END IF;
    IF v_user_total >= v_campaign.per_user_limit THEN CONTINUE; END IF;

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
    IF v_campaign.ends_at IS NOT NULL THEN v_expiration := least(v_expiration, v_campaign.ends_at); END IF;

    INSERT INTO public.user_rewards(user_id, campaign_id, event_id, checkin_id, expires_at)
    VALUES(_user_id, v_campaign.id, _event_id, _checkin_id, v_expiration)
    ON CONFLICT (user_id, campaign_id) DO NOTHING;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_granted := v_granted + v_rows;
  END LOOP;

  RETURN v_granted;
END;
$$;
REVOKE ALL ON FUNCTION public.grant_event_campaign_rewards(uuid,uuid,uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_event_campaign_rewards(uuid,uuid,uuid) TO service_role;

-- Confirmação da equipe: transforma uma presença por geolocalização em presença
-- operacionalmente validada e somente então libera benefícios financeiros.
CREATE OR REPLACE FUNCTION public.validate_checkin_qr(
  _token text,
  _event_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_staff uuid := auth.uid();
  v_qr public.qr_tokens%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_existing public.checkins%ROWTYPE;
  v_checkin_id uuid;
  v_rewards integer := 0;
  v_milestone_rewards integer := 0;
  v_display_name text;
  v_input text := lower(trim(coalesce(_token, '')));
  v_digits text := regexp_replace(coalesce(_token, ''), '[^0-9]', '', 'g');
  v_selected_mismatch boolean := false;
  v_was_location_only boolean := false;
BEGIN
  IF v_staff IS NULL OR NOT (
    public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')
  ) THEN RAISE EXCEPTION 'Acesso restrito à equipe.'; END IF;
  IF v_input = '' THEN RAISE EXCEPTION 'Informe ou escaneie um código.'; END IF;

  SELECT qt.* INTO v_qr
  FROM public.qr_tokens qt
  WHERE qt.purpose = 'checkin'
    AND (qt.token::text = v_input OR (length(v_digits) = 6 AND qt.short_code = v_digits))
  ORDER BY qt.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado. Gere um novo código no celular do cliente.'; END IF;
  IF v_qr.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este código já foi utilizado. Gere um novo código.'; END IF;
  IF v_qr.expires_at <= now() THEN RAISE EXCEPTION 'Este código expirou. Gere um novo código e valide em seguida.'; END IF;
  IF v_qr.ref_id IS NULL THEN RAISE EXCEPTION 'Código sem evento associado. Gere um novo código.'; END IF;

  SELECT e.* INTO v_event FROM public.events e WHERE e.id = v_qr.ref_id FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'O evento associado ao código não existe mais.'; END IF;
  v_selected_mismatch := _event_id IS NOT NULL AND _event_id <> v_event.id;
  IF NOT v_event.checkin_enabled OR v_event.status NOT IN ('scheduled','published','ongoing') THEN
    RAISE EXCEPTION 'Check-in indisponível para o evento %.', v_event.name;
  END IF;
  IF now() < coalesce(v_event.checkin_opens_at, v_event.starts_at - interval '2 hours') THEN
    RAISE EXCEPTION 'A janela de check-in do evento % ainda não abriu.', v_event.name;
  END IF;
  IF now() > coalesce(v_event.checkin_closes_at, v_event.starts_at + interval '6 hours') THEN
    RAISE EXCEPTION 'A janela de check-in do evento % já encerrou.', v_event.name;
  END IF;

  SELECT c.* INTO v_existing
  FROM public.checkins c
  WHERE c.user_id = v_qr.user_id AND c.event_id = v_event.id
  FOR UPDATE;

  IF FOUND THEN
    v_checkin_id := v_existing.id;
    v_was_location_only := v_existing.staff_id IS NULL AND v_existing.method = 'geolocation';
    IF v_was_location_only THEN
      UPDATE public.checkins
      SET staff_id = v_staff,
          method = 'qr_confirmed',
          notes = concat_ws('; ', nullif(notes, ''), 'Presença confirmada pela equipe via QR')
      WHERE id = v_checkin_id;
    END IF;
  ELSE
    INSERT INTO public.checkins(user_id, event_id, staff_id, method)
    VALUES(v_qr.user_id, v_event.id, v_staff, 'qr')
    RETURNING id INTO v_checkin_id;
  END IF;

  UPDATE public.qr_tokens
  SET used_at = now(), used_by = v_staff
  WHERE token = v_qr.token;

  -- É idempotente: também corrige eventual benefício que não tenha sido liberado
  -- numa validação anterior, sem criar duplicidade.
  v_rewards := public.grant_event_campaign_rewards(v_qr.user_id, v_event.id, v_checkin_id);
  v_milestone_rewards := public.refresh_user_milestone_rewards(v_qr.user_id);

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(
    v_staff,
    CASE WHEN v_was_location_only THEN 'geolocation_checkin_confirmed' ELSE 'checkin_validated' END,
    'checkin',
    v_checkin_id::text,
    jsonb_build_object(
      'user_id', v_qr.user_id,
      'event_id', v_event.id,
      'selected_event_id', _event_id,
      'selected_event_mismatch', v_selected_mismatch,
      'location_presence_upgraded', v_was_location_only,
      'event_rewards_granted', v_rewards,
      'milestone_rewards_granted', v_milestone_rewards
    )
  );

  SELECT p.display_name INTO v_display_name FROM public.profiles p WHERE p.id = v_qr.user_id;
  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', v_existing.id IS NOT NULL,
    'location_presence_upgraded', v_was_location_only,
    'checkin_id', v_checkin_id,
    'user_id', v_qr.user_id,
    'display_name', coalesce(v_display_name, 'Bafafã'),
    'event_name', v_event.name,
    'event_id', v_event.id,
    'selected_event_mismatch', v_selected_mismatch,
    'rewards_granted', v_rewards + v_milestone_rewards
  );
END;
$$;
REVOKE ALL ON FUNCTION public.validate_checkin_qr(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_checkin_qr(text,uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Check-in por geolocalização
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.checkin_with_geolocation(
  _event_id uuid,
  _latitude double precision,
  _longitude double precision,
  _accuracy_m double precision
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_distance double precision;
  v_checkin_id uuid;
  v_existing uuid;
  v_rewards integer := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Localização inválida.';
  END IF;
  IF _accuracy_m IS NULL OR _accuracy_m <= 0 THEN
    RAISE EXCEPTION 'Não foi possível medir a precisão da localização.';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = _event_id FOR SHARE;
  IF NOT FOUND OR NOT v_event.checkin_enabled OR NOT v_event.geolocation_checkin_enabled THEN
    RAISE EXCEPTION 'Check-in por localização indisponível para este evento.';
  END IF;
  IF v_event.status NOT IN ('published','scheduled','ongoing') THEN
    RAISE EXCEPTION 'Evento indisponível para check-in.';
  END IF;
  IF now() < coalesce(v_event.checkin_opens_at, v_event.starts_at - interval '2 hours') THEN
    RAISE EXCEPTION 'A janela de check-in ainda não abriu.';
  END IF;
  IF now() > coalesce(v_event.checkin_closes_at, v_event.starts_at + interval '6 hours') THEN
    RAISE EXCEPTION 'A janela de check-in já encerrou.';
  END IF;
  IF v_event.venue_latitude IS NULL OR v_event.venue_longitude IS NULL THEN
    RAISE EXCEPTION 'A localização do evento ainda não foi configurada.';
  END IF;
  IF _accuracy_m > v_event.max_location_accuracy_m THEN
    RAISE EXCEPTION 'A localização está imprecisa. Aproxime-se da área aberta e tente novamente.';
  END IF;

  v_distance := 6371000 * 2 * asin(sqrt(
    power(sin(radians(_latitude - v_event.venue_latitude) / 2), 2) +
    cos(radians(v_event.venue_latitude)) * cos(radians(_latitude)) *
    power(sin(radians(_longitude - v_event.venue_longitude) / 2), 2)
  ));

  IF v_distance > v_event.geofence_radius_m THEN
    RAISE EXCEPTION 'Você ainda não está na área do Bafafá.';
  END IF;

  SELECT id INTO v_existing FROM public.checkins
  WHERE user_id = v_user AND event_id = _event_id;
  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true, 'duplicate', true, 'checkin_id', v_existing,
      'distance_m', round(v_distance::numeric, 1), 'rewards_granted', 0
    );
  END IF;

  INSERT INTO public.checkins(user_id, event_id, method, notes)
  VALUES (
    v_user,
    _event_id,
    'geolocation',
    format('Distância aproximada: %s m; precisão: %s m', round(v_distance), round(_accuracy_m))
  ) RETURNING id INTO v_checkin_id;

  -- A localização confirma presença e libera recursos sociais. Benefícios de
  -- valor financeiro dependem da confirmação da equipe via QR.
  v_rewards := public.refresh_user_milestone_rewards(v_user);

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'checkin_id', v_checkin_id,
    'distance_m', round(v_distance::numeric, 1),
    'accuracy_m', round(_accuracy_m::numeric, 1),
    'rewards_granted', v_rewards
  );
END;
$$;
REVOKE ALL ON FUNCTION public.checkin_with_geolocation(uuid,double precision,double precision,double precision)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_with_geolocation(uuid,double precision,double precision,double precision)
TO authenticated, service_role;

-- Reprocessa missões depois de qualquer novo check-in, inclusive QR.
CREATE OR REPLACE FUNCTION public.tg_refresh_milestones_after_checkin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.refresh_user_milestone_rewards(NEW.user_id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_refresh_milestones_after_checkin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_refresh_milestones_after_checkin() TO service_role;
DROP TRIGGER IF EXISTS checkins_refresh_milestones_v19 ON public.checkins;
CREATE TRIGGER checkins_refresh_milestones_v19
AFTER INSERT ON public.checkins
FOR EACH ROW EXECUTE FUNCTION public.tg_refresh_milestones_after_checkin();


-- Perfil público inclui identidade somente quando a própria pessoa autoriza.
CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_title text;
  v_badges jsonb;
  v_badge_count integer := 0;
  v_checkin_count integer;
  v_event_preferences jsonb := '[]'::jsonb;
  v_gender text;
BEGIN
  SELECT * INTO v_profile FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
    AND is_public = true AND deleted_at IS NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name INTO v_title FROM public.title_definitions
  WHERE id = v_profile.active_title_id AND is_active;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'slug', b.slug, 'name', b.name, 'description', b.description, 'icon', b.icon
    ) ORDER BY CASE WHEN b.slug = 'bafafa-fundador' THEN 0 ELSE 1 END, b.sort_order, ub.awarded_at), '[]'::jsonb),
    count(*)::integer
  INTO v_badges, v_badge_count
  FROM public.user_badges ub
  JOIN public.badge_definitions b ON b.id = ub.badge_id
  WHERE ub.user_id = v_profile.id AND ub.is_hidden = false AND b.is_active = true;

  IF v_profile.show_checkin_count THEN
    SELECT count(*)::integer INTO v_checkin_count FROM public.checkins c WHERE c.user_id = v_profile.id;
  ELSE v_checkin_count := NULL; END IF;

  IF v_profile.show_event_preferences THEN
    SELECT coalesce(to_jsonb(up.event_categories), '[]'::jsonb)
    INTO v_event_preferences FROM public.user_preferences up WHERE up.user_id = v_profile.id;
    v_event_preferences := coalesce(v_event_preferences, '[]'::jsonb);
  END IF;

  IF v_profile.show_gender THEN
    v_gender := CASE v_profile.gender_identity
      WHEN 'mulher' THEN 'Mulher'
      WHEN 'homem' THEN 'Homem'
      WHEN 'nao_binaria' THEN 'Pessoa não binária'
      WHEN 'outra' THEN 'Outra identidade'
      WHEN 'prefiro_descrever' THEN v_profile.gender_custom
      ELSE NULL
    END;
  END IF;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'bio', v_profile.bio,
    'city', CASE WHEN v_profile.show_city THEN v_profile.city ELSE NULL END,
    'member_since', v_profile.member_since,
    'active_title', v_title,
    'badges', v_badges,
    'badge_count', v_badge_count,
    'checkin_count', v_checkin_count,
    'event_preferences', v_event_preferences,
    'gender', v_gender,
    'pronouns', CASE WHEN v_profile.show_gender THEN v_profile.pronouns ELSE NULL END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated, service_role;

COMMIT;
NOTIFY pgrst, 'reload schema';
