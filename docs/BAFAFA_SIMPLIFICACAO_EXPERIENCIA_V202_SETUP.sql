-- Bafafá Connect V20.2
-- Simplificação da experiência pública, Sessão da Casa, ordem editorial das
-- Fofoquinhas, links externos e correção da ativação por QR.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Eventos públicos e Sessões da Casa internas
-- ---------------------------------------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS experience_type text NOT NULL DEFAULT 'public_event',
  ADD COLUMN IF NOT EXISTS public_visible boolean NOT NULL DEFAULT true;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_experience_type_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_experience_type_check
  CHECK (experience_type IN ('public_event', 'house_session'));

UPDATE public.events
SET experience_type = coalesce(experience_type, 'public_event'),
    public_visible = coalesce(public_visible, true)
WHERE experience_type IS NULL OR public_visible IS NULL;

CREATE INDEX IF NOT EXISTS events_house_session_schedule_idx
  ON public.events(experience_type, starts_at DESC)
  WHERE experience_type = 'house_session' AND status NOT IN ('draft', 'cancelled');

CREATE INDEX IF NOT EXISTS events_public_schedule_idx
  ON public.events(public_visible, starts_at DESC)
  WHERE experience_type = 'public_event' AND public_visible = true;

-- Evita duas Sessões da Casa concorrentes. O aplicativo sempre precisa ter uma
-- única referência para presença, Resenha e métricas operacionais.
CREATE OR REPLACE FUNCTION public.prevent_house_session_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_new_start timestamptz;
  v_new_end timestamptz;
BEGIN
  IF NEW.experience_type <> 'house_session'
     OR NEW.status IN ('draft', 'cancelled', 'ended') THEN
    RETURN NEW;
  END IF;

  v_new_start := least(
    coalesce(NEW.checkin_opens_at, NEW.starts_at),
    coalesce(NEW.chat_opens_at, NEW.starts_at)
  );
  v_new_end := greatest(
    coalesce(NEW.checkin_closes_at, NEW.ends_at, NEW.starts_at + interval '8 hours'),
    coalesce(NEW.chat_closes_at, NEW.ends_at, NEW.starts_at + interval '8 hours')
  );

  IF v_new_end <= v_new_start THEN
    RAISE EXCEPTION 'O encerramento da Sessão da Casa precisa ser depois da abertura.';
  END IF;

  IF v_new_start < NEW.starts_at
     OR v_new_end > coalesce(NEW.ends_at, NEW.starts_at + interval '8 hours') THEN
    RAISE EXCEPTION 'Check-in e Resenha precisam ficar dentro do período da Sessão da Casa.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id IS DISTINCT FROM NEW.id
      AND e.experience_type = 'house_session'
      AND e.status NOT IN ('draft', 'cancelled', 'ended')
      AND tstzrange(
        least(
          coalesce(e.checkin_opens_at, e.starts_at),
          coalesce(e.chat_opens_at, e.starts_at)
        ),
        greatest(
          coalesce(e.checkin_closes_at, e.ends_at, e.starts_at + interval '8 hours'),
          coalesce(e.chat_closes_at, e.ends_at, e.starts_at + interval '8 hours')
        ),
        '[)'
      ) && tstzrange(v_new_start, v_new_end, '[)')
  ) THEN
    RAISE EXCEPTION 'Já existe uma Sessão da Casa nesse período.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_prevent_house_session_overlap ON public.events;
CREATE TRIGGER events_prevent_house_session_overlap
BEFORE INSERT OR UPDATE OF experience_type, status, starts_at, ends_at,
  checkin_opens_at, checkin_closes_at, chat_opens_at, chat_closes_at
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.prevent_house_session_overlap();

-- ---------------------------------------------------------------------------
-- 2. Ordem editorial e uso externo das Fofoquinhas
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS home_sort_order integer,
  ADD COLUMN IF NOT EXISTS home_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS redemption_mode text NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS external_button_label text NOT NULL DEFAULT 'Garantir minha promoção',
  ADD COLUMN IF NOT EXISTS external_open_new_tab boolean NOT NULL DEFAULT true;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_redemption_mode_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_redemption_mode_check
  CHECK (redemption_mode IN ('app', 'external', 'both'));

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_external_url_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_external_url_check
  CHECK (
    external_url IS NULL
    OR external_url ~* '^https?://[^[:space:]]+$'
  );

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_home_sort_order_check;
ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_home_sort_order_check
  CHECK (home_sort_order IS NULL OR home_sort_order BETWEEN 1 AND 9999);

CREATE INDEX IF NOT EXISTS campaigns_home_editorial_idx
  ON public.campaigns(feed_visible, home_visible, home_sort_order, campaign_kind, starts_at DESC)
  WHERE status = 'active';

-- Valores antigos continuam válidos. A prioridade numérica anterior deixa de
-- ser exibida, mas é convertida em ordem editorial quando havia uma escolha.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           ORDER BY is_pinned DESC, feed_priority DESC, starts_at DESC, id
         )::integer AS position
  FROM public.campaigns
  WHERE feed_visible = true
    AND campaign_kind IN ('global', 'milestone')
    AND (is_pinned = true OR feed_priority <> 0)
)
UPDATE public.campaigns c
SET home_sort_order = ranked.position
FROM ranked
WHERE c.id = ranked.id
  AND c.home_sort_order IS NULL;

-- ---------------------------------------------------------------------------
-- 3. Rastreamento seguro de cliques em links externos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'home',
  clicked_at timestamptz NOT NULL DEFAULT now(),
  user_agent text
);

CREATE INDEX IF NOT EXISTS campaign_link_clicks_campaign_idx
  ON public.campaign_link_clicks(campaign_id, clicked_at DESC);
CREATE INDEX IF NOT EXISTS campaign_link_clicks_user_idx
  ON public.campaign_link_clicks(user_id, clicked_at DESC);

ALTER TABLE public.campaign_link_clicks ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.campaign_link_clicks TO authenticated;
GRANT ALL ON public.campaign_link_clicks TO service_role;

DROP POLICY IF EXISTS "Admins read campaign link clicks" ON public.campaign_link_clicks;
CREATE POLICY "Admins read campaign link clicks"
ON public.campaign_link_clicks FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.track_campaign_external_click(
  _campaign_id uuid,
  _source text DEFAULT 'home'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_campaign public.campaigns%ROWTYPE;
  v_source text := left(coalesce(nullif(trim(_source), ''), 'home'), 40);
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT * INTO v_campaign
  FROM public.campaigns c
  WHERE c.id = _campaign_id
    AND c.status = 'active'
    AND c.redemption_mode IN ('external', 'both')
    AND c.external_url IS NOT NULL
    AND c.external_url ~* '^https?://[^[:space:]]+$';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este link não está disponível.';
  END IF;

  INSERT INTO public.campaign_link_clicks(campaign_id, user_id, source)
  VALUES(v_campaign.id, v_user, v_source);

  RETURN v_campaign.external_url;
END;
$$;

REVOKE ALL ON FUNCTION public.track_campaign_external_click(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.track_campaign_external_click(uuid,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Sessão da Casa atual, invisível como evento para o cliente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_house_session()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_checkin_open timestamptz;
  v_checkin_close timestamptz;
  v_chat_open timestamptz;
  v_chat_close timestamptz;
  v_checked_in boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  SELECT e.* INTO v_event
  FROM public.events e
  WHERE e.experience_type = 'house_session'
    AND e.status NOT IN ('draft', 'cancelled', 'ended')
    AND now() BETWEEN
      least(
        coalesce(e.checkin_opens_at, e.starts_at),
        coalesce(e.chat_opens_at, e.starts_at)
      )
      AND greatest(
        coalesce(e.checkin_closes_at, e.ends_at, e.starts_at + interval '8 hours'),
        coalesce(e.chat_closes_at, e.ends_at, e.starts_at + interval '8 hours')
      )
  ORDER BY
    CASE WHEN now() BETWEEN e.starts_at AND coalesce(e.ends_at, e.starts_at + interval '8 hours')
      THEN 0 ELSE 1 END,
    e.starts_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_checkin_open := coalesce(v_event.checkin_opens_at, v_event.starts_at);
  v_checkin_close := coalesce(v_event.checkin_closes_at, v_event.ends_at, v_event.starts_at + interval '8 hours');
  v_chat_open := coalesce(v_event.chat_opens_at, v_event.starts_at);
  v_chat_close := coalesce(v_event.chat_closes_at, v_event.ends_at, v_event.starts_at + interval '8 hours');

  SELECT EXISTS(
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = v_user AND c.event_id = v_event.id
  ) INTO v_checked_in;

  RETURN jsonb_build_object(
    'id', v_event.id,
    'name', v_event.name,
    'starts_at', v_event.starts_at,
    'ends_at', v_event.ends_at,
    'checkin_opens_at', v_checkin_open,
    'checkin_closes_at', v_checkin_close,
    'chat_opens_at', v_chat_open,
    'chat_closes_at', v_chat_close,
    'checkin_enabled', v_event.checkin_enabled,
    'chat_enabled', v_event.chat_enabled,
    'geolocation_checkin_enabled', v_event.geolocation_checkin_enabled,
    'geofence_radius_m', v_event.geofence_radius_m,
    'max_location_accuracy_m', v_event.max_location_accuracy_m,
    'venue_address', v_event.venue_address,
    'checked_in', v_checked_in,
    'checkin_open', v_event.checkin_enabled AND now() BETWEEN v_checkin_open AND v_checkin_close,
    'chat_open', v_event.chat_enabled AND now() BETWEEN v_chat_open AND v_chat_close,
    'status', v_event.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_house_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_house_session() TO authenticated, service_role;

-- A Resenha pública passa a listar somente a Sessão da Casa atual para quem
-- já confirmou presença. A estrutura interna continua usando event_id.
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
SET search_path = pg_catalog, public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    'Resenha do Bafas'::text,
    e.starts_at,
    e.ends_at,
    e.image_url,
    'Resenha'::text,
    coalesce(e.chat_closes_at, e.ends_at, e.starts_at + interval '8 hours'),
    count(m.id) FILTER (WHERE m.status = 'visible'),
    max(m.created_at) FILTER (WHERE m.status = 'visible')
  FROM public.events e
  LEFT JOIN public.event_chat_messages m ON m.event_id = e.id
  WHERE e.experience_type = 'house_session'
    AND public.can_access_event_chat(auth.uid(), e.id)
  GROUP BY e.id
  ORDER BY e.starts_at DESC
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.my_event_chat_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_chat_rooms() TO authenticated, service_role;

-- O check-in público aceita somente a Sessão da Casa atual e evita expor
-- mensagens técnicas sobre eventos que estão ocultos do aplicativo.
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
  v_effective_radius double precision;
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

  SELECT * INTO v_event
  FROM public.events e
  WHERE e.id = _event_id
    AND e.experience_type = 'house_session'
  FOR SHARE;

  IF NOT FOUND OR NOT v_event.checkin_enabled OR NOT v_event.geolocation_checkin_enabled THEN
    RAISE EXCEPTION 'O check-in não está disponível agora.';
  END IF;
  IF v_event.status NOT IN ('published', 'scheduled', 'ongoing') THEN
    RAISE EXCEPTION 'A Sessão da Casa não está disponível agora.';
  END IF;
  IF now() < coalesce(v_event.checkin_opens_at, v_event.starts_at) THEN
    RAISE EXCEPTION 'O check-in ainda não abriu.';
  END IF;
  IF now() > coalesce(v_event.checkin_closes_at, v_event.ends_at, v_event.starts_at + interval '8 hours') THEN
    RAISE EXCEPTION 'O check-in já encerrou por hoje.';
  END IF;
  IF v_event.venue_latitude IS NULL OR v_event.venue_longitude IS NULL THEN
    RAISE EXCEPTION 'A localização do Bafafá ainda não foi configurada.';
  END IF;
  IF _accuracy_m > v_event.max_location_accuracy_m THEN
    RAISE EXCEPTION
      'A localização ainda está imprecisa (% m). Ative a localização precisa, vá para uma área aberta ou use o QR alternativo.',
      round(_accuracy_m);
  END IF;

  v_distance := 6371000 * 2 * asin(sqrt(
    power(sin(radians(_latitude - v_event.venue_latitude) / 2), 2) +
    cos(radians(v_event.venue_latitude)) * cos(radians(_latitude)) *
    power(sin(radians(_longitude - v_event.venue_longitude) / 2), 2)
  ));
  v_effective_radius := v_event.geofence_radius_m + least(_accuracy_m * 0.5, 120);

  IF v_distance > v_effective_radius THEN
    RAISE EXCEPTION 'Você ainda não está na área do Bafafá.';
  END IF;

  SELECT c.id INTO v_existing
  FROM public.checkins c
  WHERE c.user_id = v_user AND c.event_id = v_event.id;

  IF v_existing IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'checkin_id', v_existing,
      'distance_m', round(v_distance::numeric, 1),
      'accuracy_m', round(_accuracy_m::numeric, 1),
      'effective_radius_m', round(v_effective_radius::numeric, 1),
      'rewards_granted', 0
    );
  END IF;

  INSERT INTO public.checkins(user_id, event_id, method, notes)
  VALUES (
    v_user,
    v_event.id,
    'geolocation',
    format(
      'Distância aproximada: %s m; precisão: %s m; raio efetivo: %s m',
      round(v_distance), round(_accuracy_m), round(v_effective_radius)
    )
  )
  RETURNING id INTO v_checkin_id;

  v_rewards := public.refresh_user_milestone_rewards(v_user);

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'checkin_id', v_checkin_id,
    'distance_m', round(v_distance::numeric, 1),
    'accuracy_m', round(_accuracy_m::numeric, 1),
    'effective_radius_m', round(v_effective_radius::numeric, 1),
    'rewards_granted', v_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.checkin_with_geolocation(
  uuid, double precision, double precision, double precision
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkin_with_geolocation(
  uuid, double precision, double precision, double precision
) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Fofoquinhas públicas sem dependência de eventos
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.my_fofoquinhas();
CREATE FUNCTION public.my_fofoquinhas()
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
  feed_priority integer,
  public_title text,
  public_copy text,
  product_id uuid,
  product_category text,
  activation_expires_at timestamptz,
  visit_scope text,
  home_sort_order integer,
  home_visible boolean,
  redemption_mode text,
  external_url text,
  external_button_label text,
  external_open_new_tab boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  PERFORM public.refresh_user_milestone_rewards(v_user);
  PERFORM public.refresh_my_reward_statuses();

  RETURN QUERY
  SELECT
    c.id,
    coalesce(c.public_title,c.name),
    coalesce(c.public_copy,c.description),
    c.benefit_type,
    c.discount_percent,
    c.fixed_off_cents,
    coalesce(p.original_name,c.product_name),
    c.public_rules,
    c.campaign_kind,
    c.trigger_type,
    c.trigger_target,
    coalesce(cp.progress_value,0),
    coalesce(cp.completed,false),
    r.id,
    r.status,
    r.expires_at,
    c.starts_at,
    c.ends_at,
    c.is_pinned,
    c.feed_priority,
    coalesce(c.public_title,c.name),
    coalesce(c.public_copy,c.description),
    c.product_id,
    c.product_category,
    r.activation_expires_at,
    coalesce(r.visit_scope,c.visit_scope),
    c.home_sort_order,
    c.home_visible,
    c.redemption_mode,
    c.external_url,
    c.external_button_label,
    c.external_open_new_tab
  FROM public.campaigns c
  LEFT JOIN public.products p ON p.id=c.product_id
  LEFT JOIN LATERAL public.campaign_progress_for_user(v_user,c.id) cp ON true
  LEFT JOIN LATERAL (
    SELECT ur.id,ur.status,ur.expires_at,ur.activation_expires_at,ur.visit_scope
    FROM public.user_rewards ur
    WHERE ur.user_id=v_user AND ur.campaign_id=c.id AND ur.status<>'revoked'
    ORDER BY ur.created_at DESC LIMIT 1
  ) r ON true
  WHERE c.status='active'
    AND c.feed_visible
    AND c.campaign_kind IN ('global','milestone')
    AND c.starts_at<=now()
    AND (c.ends_at IS NULL OR c.ends_at>=now() OR r.id IS NOT NULL)
  ORDER BY
    CASE WHEN c.home_sort_order IS NULL THEN 1 ELSE 0 END,
    c.home_sort_order ASC NULLS LAST,
    CASE c.campaign_kind WHEN 'global' THEN 0 WHEN 'milestone' THEN 1 ELSE 2 END,
    (r.status='available') DESC,
    c.starts_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.my_fofoquinhas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_fofoquinhas() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Correção da ambiguidade de expires_at na ativação da Fofoquinha
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_my_qr_token(
  _purpose text,
  _ref_id uuid DEFAULT NULL
)
RETURNS TABLE(token uuid, short_code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_token uuid;
  v_expires timestamptz;
  v_attempt integer := 0;
  v_reward public.user_rewards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _purpose NOT IN ('checkin', 'redemption', 'customer') THEN RAISE EXCEPTION 'Finalidade inválida.'; END IF;

  IF _purpose = 'checkin' THEN
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = _ref_id
        AND e.experience_type = 'house_session'
        AND e.checkin_enabled
        AND e.status IN ('scheduled','published','ongoing')
        AND now() >= coalesce(e.checkin_opens_at, e.starts_at)
        AND now() <= coalesce(e.checkin_closes_at, e.ends_at, e.starts_at + interval '8 hours')
    ) THEN RAISE EXCEPTION 'O check-in não está disponível agora.'; END IF;
    v_expires := now() + interval '5 minutes';
  ELSIF _purpose = 'customer' THEN
    v_expires := now() + interval '10 minutes';
  ELSE
    PERFORM public.refresh_my_reward_statuses();
    SELECT * INTO v_reward FROM public.user_rewards ur
    WHERE ur.id = _ref_id AND ur.user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_reward.status <> 'available' OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
      RAISE EXCEPTION 'Fofoquinha indisponível.';
    END IF;
    SELECT * INTO v_campaign FROM public.campaigns c WHERE c.id = v_reward.campaign_id;
    IF v_campaign.redemption_mode = 'external' THEN
      RAISE EXCEPTION 'Esta Fofoquinha deve ser utilizada no site indicado.';
    END IF;
    IF v_reward.activated_at IS NULL THEN
      UPDATE public.user_rewards AS ur
      SET activated_at = now(),
          activation_expires_at = least(
            coalesce(v_reward.expires_at, now() + interval '24 hours'),
            now() + greatest(coalesce(v_campaign.redemption_window_minutes, 20), 1) * interval '1 minute'
          ),
          updated_at = now()
      WHERE ur.id = v_reward.id
      RETURNING ur.* INTO v_reward;
    ELSIF v_reward.activation_expires_at IS NOT NULL AND v_reward.activation_expires_at <= now() THEN
      UPDATE public.user_rewards AS ur
      SET status = 'expired', updated_at = now()
      WHERE ur.id = v_reward.id;
      RAISE EXCEPTION 'O prazo desta Fofoquinha terminou.';
    END IF;
    v_expires := least(
      coalesce(v_reward.activation_expires_at, now() + interval '2 minutes'),
      now() + interval '2 minutes'
    );
  END IF;

  UPDATE public.qr_tokens AS qt SET used_at = now()
  WHERE qt.user_id = v_user AND qt.purpose = _purpose AND qt.used_at IS NULL;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.qr_tokens qt
      WHERE qt.short_code = v_code AND qt.used_at IS NULL AND qt.expires_at > now()
    );
    IF v_attempt >= 15 THEN RAISE EXCEPTION 'Não foi possível gerar o código. Tente novamente.'; END IF;
  END LOOP;

  INSERT INTO public.qr_tokens(user_id, purpose, ref_id, short_code, expires_at)
  VALUES(v_user, _purpose, _ref_id, v_code, v_expires)
  RETURNING qr_tokens.token INTO v_token;

  RETURN QUERY SELECT v_token, v_code, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_qr_token(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_qr_token(text,uuid) TO authenticated, service_role;

-- Oculta as campanhas ligadas a eventos enquanto a Agenda pública estiver fora do ar.
UPDATE public.campaigns
SET feed_visible = false,
    home_visible = false,
    updated_at = now()
WHERE campaign_kind IN ('event','funnel')
  AND feed_visible = true;

COMMIT;
