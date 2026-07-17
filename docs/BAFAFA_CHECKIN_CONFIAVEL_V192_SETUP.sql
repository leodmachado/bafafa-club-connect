-- ==========================================================================
-- BAFAFÁ V19.2 — Check-in mais confiável + tolerância de GPS para celulares
-- Execute no SQL Editor do Supabase antes de testar a nova versão do app.
-- ==========================================================================
BEGIN;

-- A primeira leitura do navegador pode vir do Wi-Fi/rede e ser menos precisa.
-- Como benefícios financeiros continuam exigindo validação da equipe por QR,
-- o check-in social pode trabalhar com uma margem realista para celulares.
ALTER TABLE public.events
  ALTER COLUMN max_location_accuracy_m SET DEFAULT 250;

ALTER TABLE IF EXISTS public.venues
  ALTER COLUMN default_max_accuracy_m SET DEFAULT 250;

UPDATE public.events
SET max_location_accuracy_m = 250
WHERE geolocation_checkin_enabled
  AND max_location_accuracy_m < 250;

UPDATE public.venues
SET default_max_accuracy_m = 250
WHERE default_max_accuracy_m < 250;

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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF _latitude NOT BETWEEN -90 AND 90 OR _longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'Localização inválida.';
  END IF;

  IF _accuracy_m IS NULL OR _accuracy_m <= 0 THEN
    RAISE EXCEPTION 'Não foi possível medir a precisão da localização.';
  END IF;

  SELECT * INTO v_event
  FROM public.events
  WHERE id = _event_id
  FOR SHARE;

  IF NOT FOUND OR NOT v_event.checkin_enabled OR NOT v_event.geolocation_checkin_enabled THEN
    RAISE EXCEPTION 'Check-in por localização indisponível para este evento.';
  END IF;

  IF v_event.status NOT IN ('published', 'scheduled', 'ongoing') THEN
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
    RAISE EXCEPTION
      'A localização ainda está imprecisa (% m). Ative a localização precisa, vá para uma área aberta ou use o QR alternativo.',
      round(_accuracy_m);
  END IF;

  v_distance := 6371000 * 2 * asin(sqrt(
    power(sin(radians(_latitude - v_event.venue_latitude) / 2), 2) +
    cos(radians(v_event.venue_latitude)) * cos(radians(_latitude)) *
    power(sin(radians(_longitude - v_event.venue_longitude) / 2), 2)
  ));

  -- Compensa parcialmente a incerteza informada pelo aparelho, sem transformar
  -- uma leitura distante em presença. A tolerância extra é limitada a 120 m.
  v_effective_radius := v_event.geofence_radius_m + least(_accuracy_m * 0.5, 120);

  IF v_distance > v_effective_radius THEN
    RAISE EXCEPTION 'Você ainda não está na área do Bafafá.';
  END IF;

  SELECT id INTO v_existing
  FROM public.checkins
  WHERE user_id = v_user
    AND event_id = _event_id;

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
    _event_id,
    'geolocation',
    format(
      'Distância aproximada: %s m; precisão: %s m; raio efetivo: %s m',
      round(v_distance),
      round(_accuracy_m),
      round(v_effective_radius)
    )
  )
  RETURNING id INTO v_checkin_id;

  -- A geolocalização confirma presença e libera recursos sociais. Promoções de
  -- valor financeiro continuam dependendo da validação operacional via QR.
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
  uuid,
  double precision,
  double precision,
  double precision
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.checkin_with_geolocation(
  uuid,
  double precision,
  double precision,
  double precision
) TO authenticated, service_role;

COMMIT;
