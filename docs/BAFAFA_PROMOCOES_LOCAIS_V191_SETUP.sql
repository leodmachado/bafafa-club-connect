-- ============================================================================
-- BAFAFÁ V19.1 — Correção de promoções gerais e locais reutilizáveis
-- ============================================================================
BEGIN;

-- 1) Locais cadastrados: o administrador escolhe o local uma vez e reutiliza.
CREATE TABLE IF NOT EXISTS public.venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  google_place_id text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  default_geofence_radius_m integer NOT NULL DEFAULT 80,
  default_max_accuracy_m integer NOT NULL DEFAULT 80,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT venues_name_length_check CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT venues_address_length_check CHECK (char_length(address) BETWEEN 1 AND 300),
  CONSTRAINT venues_latitude_check CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT venues_longitude_check CHECK (longitude BETWEEN -180 AND 180),
  CONSTRAINT venues_radius_check CHECK (default_geofence_radius_m BETWEEN 20 AND 500),
  CONSTRAINT venues_accuracy_check CHECK (default_max_accuracy_m BETWEEN 20 AND 500)
);

CREATE UNIQUE INDEX IF NOT EXISTS venues_google_place_id_unique
  ON public.venues (google_place_id)
  WHERE google_place_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS venues_active_name_idx ON public.venues (is_active, name);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.venues TO authenticated;
GRANT ALL ON public.venues TO service_role;

DROP POLICY IF EXISTS "Authenticated read venues" ON public.venues;
CREATE POLICY "Authenticated read venues"
ON public.venues FOR SELECT TO authenticated
USING (is_active OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage venues" ON public.venues;
CREATE POLICY "Admins manage venues"
ON public.venues FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS venues_updated_at_v191 ON public.venues;
CREATE TRIGGER venues_updated_at_v191
BEFORE UPDATE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2) O evento guarda uma fotografia do local usado naquele dia.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS venue_google_place_id text;

ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_name_length_check;
ALTER TABLE public.events ADD CONSTRAINT events_venue_name_length_check
  CHECK (venue_name IS NULL OR char_length(venue_name) <= 120);
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_venue_address_length_check;
ALTER TABLE public.events ADD CONSTRAINT events_venue_address_length_check
  CHECK (venue_address IS NULL OR char_length(venue_address) <= 300);

CREATE INDEX IF NOT EXISTS events_venue_id_idx ON public.events (venue_id);

CREATE OR REPLACE FUNCTION public.tg_apply_event_venue_v191()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_venue public.venues%ROWTYPE;
BEGIN
  IF NEW.venue_id IS NOT NULL THEN
    SELECT * INTO v_venue FROM public.venues WHERE id = NEW.venue_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Local cadastrado não encontrado.';
    END IF;

    NEW.venue_name := v_venue.name;
    NEW.venue_address := v_venue.address;
    NEW.venue_google_place_id := v_venue.google_place_id;
    NEW.venue_latitude := v_venue.latitude;
    NEW.venue_longitude := v_venue.longitude;
    NEW.geofence_radius_m := v_venue.default_geofence_radius_m;
    NEW.max_location_accuracy_m := v_venue.default_max_accuracy_m;
  END IF;

  IF NEW.geolocation_checkin_enabled AND
     (NEW.venue_latitude IS NULL OR NEW.venue_longitude IS NULL) THEN
    RAISE EXCEPTION 'Escolha um local válido para ativar o check-in por localização.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_apply_venue_v191 ON public.events;
CREATE TRIGGER events_apply_venue_v191
BEFORE INSERT OR UPDATE OF venue_id, venue_latitude, venue_longitude,
  geofence_radius_m, max_location_accuracy_m, geolocation_checkin_enabled
ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_apply_event_venue_v191();

-- 3) Normaliza campanhas gerais já criadas ou parcialmente salvas.
UPDATE public.campaigns
SET trigger_type = 'none',
    trigger_target = 1,
    event_id = NULL
WHERE campaign_kind = 'global';

-- Uma promoção geral sem exigência de presença não precisa de validação da equipe.
UPDATE public.campaigns
SET requires_staff_validation = false
WHERE campaign_kind = 'global' AND NOT requires_checkin;

-- 4) Duplicação passa a preservar local, geolocalização e campos da V19.
CREATE OR REPLACE FUNCTION public.duplicate_event_with_campaigns(_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_source public.events%ROWTYPE;
  v_new_id uuid;
  v_suffix text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS');
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  SELECT * INTO v_source FROM public.events WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;

  INSERT INTO public.events (
    name, slug, description, image_url, category, attraction,
    starts_at, ends_at, checkin_opens_at, checkin_closes_at,
    checkin_enabled, status, instructions, created_by,
    chat_enabled, chat_opens_at, chat_closes_at,
    geolocation_checkin_enabled, venue_id, venue_name, venue_address,
    venue_google_place_id, venue_latitude, venue_longitude,
    geofence_radius_m, max_location_accuracy_m
  ) VALUES (
    v_source.name || ' — cópia',
    left(v_source.slug || '-copia-' || v_suffix, 120),
    v_source.description, v_source.image_url, v_source.category, v_source.attraction,
    v_source.starts_at + interval '7 days',
    CASE WHEN v_source.ends_at IS NULL THEN NULL ELSE v_source.ends_at + interval '7 days' END,
    CASE WHEN v_source.checkin_opens_at IS NULL THEN NULL ELSE v_source.checkin_opens_at + interval '7 days' END,
    CASE WHEN v_source.checkin_closes_at IS NULL THEN NULL ELSE v_source.checkin_closes_at + interval '7 days' END,
    v_source.checkin_enabled, 'draft', v_source.instructions, v_actor,
    v_source.chat_enabled,
    CASE WHEN v_source.chat_opens_at IS NULL THEN NULL ELSE v_source.chat_opens_at + interval '7 days' END,
    CASE WHEN v_source.chat_closes_at IS NULL THEN NULL ELSE v_source.chat_closes_at + interval '7 days' END,
    v_source.geolocation_checkin_enabled, v_source.venue_id, v_source.venue_name,
    v_source.venue_address, v_source.venue_google_place_id,
    v_source.venue_latitude, v_source.venue_longitude,
    v_source.geofence_radius_m, v_source.max_location_accuracy_m
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.campaigns (
    event_id, name, description, benefit_type, discount_percent,
    discount_max_cents, fixed_off_cents, product_name, instructions,
    starts_at, ends_at, reward_valid_hours, total_available,
    per_user_limit, requires_checkin, requires_min_profile,
    required_badge_id, status, public_rules, internal_rules,
    campaign_kind, trigger_type, trigger_target, trigger_category,
    feed_priority, is_pinned, feed_visible, requires_staff_validation
  )
  SELECT
    v_new_id, name || ' — cópia', description, benefit_type, discount_percent,
    discount_max_cents, fixed_off_cents, product_name, instructions,
    starts_at + interval '7 days',
    CASE WHEN ends_at IS NULL THEN NULL ELSE ends_at + interval '7 days' END,
    reward_valid_hours, total_available, per_user_limit, requires_checkin,
    requires_min_profile, required_badge_id, 'paused', public_rules, internal_rules,
    'event', 'event_checkin', 1, NULL,
    feed_priority, false, feed_visible, true
  FROM public.campaigns
  WHERE event_id = _event_id AND status <> 'ended';

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (
    v_actor,
    'event_duplicated',
    'event',
    v_new_id::text,
    jsonb_build_object('source_event_id', _event_id, 'venue_id', v_source.venue_id)
  );

  RETURN v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.duplicate_event_with_campaigns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_event_with_campaigns(uuid)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
