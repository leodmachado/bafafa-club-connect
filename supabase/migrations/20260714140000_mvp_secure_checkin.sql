-- =====================================================================
-- BAFAFÁ MVP — estabilização de RLS + códigos temporários de check-in
-- =====================================================================

-- RLS policies call has_role as the authenticated database role. The API
-- still cannot use it to grant roles; it only returns a boolean.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated, service_role;

-- A user may only display a title that was actually awarded to them.
CREATE OR REPLACE FUNCTION public.tg_validate_active_title()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.active_title_id IS NOT NULL
     AND NEW.active_title_id IS DISTINCT FROM OLD.active_title_id
     AND NOT EXISTS (
       SELECT 1 FROM public.user_titles
       WHERE user_id = NEW.id AND title_id = NEW.active_title_id
     )
  THEN
    RAISE EXCEPTION 'Título não desbloqueado para este usuário.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_active_title ON public.profiles;
CREATE TRIGGER profiles_validate_active_title
  BEFORE UPDATE OF active_title_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_validate_active_title();

REVOKE ALL ON FUNCTION public.tg_validate_active_title() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_validate_active_title() TO service_role;

-- Make the signup trigger compatible with both temporary e-mail auth and
-- future phone/OTP auth. Phone numbers remain private in profiles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display text;
  v_username text;
  v_whatsapp text;
  v_birth date;
  v_city text;
  v_over18 boolean;
  v_welcome_title uuid;
BEGIN
  v_display := coalesce(
    nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Bafafã'
  );
  v_username := nullif(new.raw_user_meta_data->>'username','');
  v_whatsapp := coalesce(nullif(new.raw_user_meta_data->>'whatsapp',''), nullif(new.phone,''));
  v_city := nullif(new.raw_user_meta_data->>'city','');
  v_over18 := coalesce((new.raw_user_meta_data->>'is_over_18')::boolean, false);
  BEGIN
    v_birth := (new.raw_user_meta_data->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    v_birth := null;
  END;

  INSERT INTO public.profiles (
    id, display_name, username, whatsapp, birth_date, city, is_over_18, phone_verified_at
  )
  VALUES (
    new.id,
    v_display,
    v_username,
    v_whatsapp,
    v_birth,
    v_city,
    v_over18,
    CASE WHEN new.phone_confirmed_at IS NOT NULL THEN new.phone_confirmed_at ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_verified_at = coalesce(public.profiles.phone_verified_at, excluded.phone_verified_at),
    whatsapp = coalesce(public.profiles.whatsapp, excluded.whatsapp);

  INSERT INTO public.user_preferences (user_id) VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'gratuito')
  ON CONFLICT DO NOTHING;

  SELECT id INTO v_welcome_title
  FROM public.title_definitions
  WHERE slug = 'cheguei-no-bafafa' AND is_active;

  IF v_welcome_title IS NOT NULL THEN
    INSERT INTO public.user_titles (user_id, title_id)
    VALUES (new.id, v_welcome_title)
    ON CONFLICT (user_id, title_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;

CREATE OR REPLACE FUNCTION public.grant_title_by_slug(_user_id uuid, _slug text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_title_id uuid;
BEGIN
  SELECT id INTO v_title_id
  FROM public.title_definitions
  WHERE slug = _slug AND is_active;

  IF v_title_id IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_titles (user_id, title_id)
  VALUES (_user_id, v_title_id)
  ON CONFLICT (user_id, title_id) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_title_by_slug(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_title_by_slug(uuid, text) TO service_role;

-- Profile fields and preferences can unlock progress badges without requiring
-- another check-in afterwards.
CREATE OR REPLACE FUNCTION public.award_profile_progress(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completeness integer;
  v_phone_verified boolean;
  v_minimum_profile boolean;
BEGIN
  v_completeness := public.calculate_profile_completeness(_user_id);

  SELECT
    phone_verified_at IS NOT NULL,
    coalesce(display_name,'') <> '' AND birth_date IS NOT NULL
  INTO v_phone_verified, v_minimum_profile
  FROM public.profiles
  WHERE id = _user_id;

  IF v_phone_verified AND v_minimum_profile THEN
    PERFORM public.grant_badge_by_slug(_user_id, 'bafafã-verificado');
  END IF;

  IF v_completeness >= 100 THEN
    PERFORM public.grant_badge_by_slug(_user_id, 'perfil-no-grau');
    PERFORM public.grant_title_by_slug(_user_id, 'perfil-no-grau');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_award_profile_progress_from_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_profile_progress(NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_award_profile_progress_from_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.award_profile_progress(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_award_progress ON public.profiles;
CREATE TRIGGER profiles_award_progress
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_profile_progress_from_profile();

DROP TRIGGER IF EXISTS preferences_award_progress ON public.user_preferences;
CREATE TRIGGER preferences_award_progress
  AFTER INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_award_profile_progress_from_preferences();

REVOKE ALL ON FUNCTION public.award_profile_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_profile_progress_from_profile() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_award_profile_progress_from_preferences() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.award_profile_progress(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_award_profile_progress_from_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.tg_award_profile_progress_from_preferences() TO service_role;

-- Replace the initial check-in trigger so badges and titles stay in sync.
CREATE OR REPLACE FUNCTION public.tg_checkin_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_category text;
BEGIN
  SELECT count(*) INTO v_count FROM public.checkins WHERE user_id = NEW.user_id;
  SELECT category INTO v_category FROM public.events WHERE id = NEW.event_id;

  IF v_count >= 1 THEN
    PERFORM public.grant_badge_by_slug(NEW.user_id, 'primeiro-bafafa');
    PERFORM public.grant_title_by_slug(NEW.user_id, 'primeiro-bafafa');
  END IF;
  IF v_count >= 3 THEN
    PERFORM public.grant_badge_by_slug(NEW.user_id, 'presenca-confirmada');
    PERFORM public.grant_title_by_slug(NEW.user_id, 'presenca-confirmada');
  END IF;
  IF v_count >= 5 THEN
    PERFORM public.grant_badge_by_slug(NEW.user_id, 'nao-perde-um-pagode');
    PERFORM public.grant_title_by_slug(NEW.user_id, 'nao-perde-um-pagode');
  END IF;
  IF lower(coalesce(v_category,'')) = 'feijoada' THEN
    PERFORM public.grant_badge_by_slug(NEW.user_id, 'sobreviveu-feijoada');
    PERFORM public.grant_title_by_slug(NEW.user_id, 'sobreviveu-feijoada');
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_checkin_after_insert() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_checkin_after_insert() TO service_role;

-- Existing accounts receive the basic welcome title too.
INSERT INTO public.user_titles (user_id, title_id)
SELECT p.id, t.id
FROM public.profiles p
JOIN public.title_definitions t ON t.slug = 'cheguei-no-bafafa' AND t.is_active
ON CONFLICT (user_id, title_id) DO NOTHING;

-- Creates a short-lived token for the signed-in user. This is safe to expose
-- because auth.uid() is the only user identifier accepted by the function.
CREATE OR REPLACE FUNCTION public.create_my_qr_token(
  _purpose text,
  _ref_id uuid DEFAULT NULL
)
RETURNS TABLE(token uuid, short_code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_token uuid;
  v_expires timestamptz := now() + interval '2 minutes';
  v_attempt integer := 0;
  v_event public.events%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  IF _purpose NOT IN ('checkin', 'redemption') THEN
    RAISE EXCEPTION 'Finalidade inválida.';
  END IF;

  IF _purpose = 'checkin' THEN
    IF _ref_id IS NULL THEN
      RAISE EXCEPTION 'Evento obrigatório.';
    END IF;

    SELECT * INTO v_event
    FROM public.events
    WHERE id = _ref_id
      AND checkin_enabled
      AND status IN ('scheduled', 'ongoing')
      AND now() >= coalesce(checkin_opens_at, starts_at - interval '2 hours')
      AND now() <= coalesce(checkin_closes_at, starts_at + interval '6 hours');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Check-in ainda não está disponível para este evento.';
    END IF;
  ELSE
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_rewards r
      WHERE r.id = _ref_id
        AND r.user_id = v_user
        AND r.status = 'available'
        AND (r.expires_at IS NULL OR r.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Mimo indisponível.';
    END IF;
  END IF;

  UPDATE public.qr_tokens
     SET used_at = now()
   WHERE user_id = v_user
     AND purpose = _purpose
     AND used_at IS NULL;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.qr_tokens
      WHERE short_code = v_code AND used_at IS NULL AND expires_at > now()
    );
    IF v_attempt >= 10 THEN
      RAISE EXCEPTION 'Não foi possível gerar o código. Tente novamente.';
    END IF;
  END LOOP;

  INSERT INTO public.qr_tokens (user_id, purpose, ref_id, short_code, expires_at)
  VALUES (v_user, _purpose, _ref_id, v_code, v_expires)
  RETURNING qr_tokens.token INTO v_token;

  RETURN QUERY SELECT v_token, v_code, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_qr_token(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_qr_token(text, uuid) TO authenticated, service_role;

-- Validates a check-in code. Only equipe/admin can run it.
CREATE OR REPLACE FUNCTION public.validate_checkin_qr(
  _token text,
  _event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff uuid := auth.uid();
  v_qr public.qr_tokens%ROWTYPE;
  v_event public.events%ROWTYPE;
  v_checkin_id uuid;
  v_existing_id uuid;
  v_rewards integer := 0;
  v_campaign public.campaigns%ROWTYPE;
  v_profile integer;
  v_expiration timestamptz;
  v_display_name text;
BEGIN
  IF v_staff IS NULL OR NOT (
    public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_tokens
  WHERE purpose = 'checkin'
    AND ref_id = _event_id
    AND used_at IS NULL
    AND expires_at > now()
    AND (token::text = lower(trim(_token)) OR short_code = regexp_replace(_token, '[^0-9]', '', 'g'))
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código inválido ou expirado.';
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = _event_id FOR SHARE;
  IF NOT FOUND OR NOT v_event.checkin_enabled OR v_event.status NOT IN ('scheduled', 'ongoing') THEN
    RAISE EXCEPTION 'Check-in indisponível para este evento.';
  END IF;
  IF v_event.checkin_opens_at IS NOT NULL AND now() < v_event.checkin_opens_at THEN
    RAISE EXCEPTION 'A janela de check-in ainda não abriu.';
  END IF;
  IF v_event.checkin_closes_at IS NOT NULL AND now() > v_event.checkin_closes_at THEN
    RAISE EXCEPTION 'A janela de check-in já encerrou.';
  END IF;

  SELECT id INTO v_existing_id
  FROM public.checkins
  WHERE user_id = v_qr.user_id AND event_id = _event_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;
    INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
    VALUES (
      v_staff,
      'checkin_duplicate_validation',
      'checkin',
      v_existing_id::text,
      jsonb_build_object('user_id', v_qr.user_id, 'event_id', _event_id)
    );
    SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_qr.user_id;
    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'checkin_id', v_existing_id,
      'user_id', v_qr.user_id,
      'display_name', coalesce(v_display_name, 'Bafafã'),
      'event_name', v_event.name,
      'rewards_granted', 0
    );
  END IF;

  INSERT INTO public.checkins (user_id, event_id, staff_id, method)
  VALUES (v_qr.user_id, _event_id, v_staff, 'code')
  RETURNING id INTO v_checkin_id;

  UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;

  v_profile := public.calculate_profile_completeness(v_qr.user_id);

  FOR v_campaign IN
    SELECT * FROM public.campaigns c
    WHERE c.event_id = _event_id
      AND c.status = 'active'
      AND c.starts_at <= now()
      AND (c.ends_at IS NULL OR c.ends_at >= now())
  LOOP
    IF v_campaign.requires_min_profile AND v_profile < 40 THEN
      CONTINUE;
    END IF;
    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_badges
      WHERE user_id = v_qr.user_id AND badge_id = v_campaign.required_badge_id
    ) THEN
      CONTINUE;
    END IF;
    IF v_campaign.total_available IS NOT NULL AND (
      SELECT count(*) FROM public.user_rewards WHERE campaign_id = v_campaign.id
    ) >= v_campaign.total_available THEN
      CONTINUE;
    END IF;

    v_expiration := now() + make_interval(hours => v_campaign.reward_valid_hours);
    IF v_campaign.ends_at IS NOT NULL THEN
      v_expiration := least(v_expiration, v_campaign.ends_at);
    END IF;

    INSERT INTO public.user_rewards (user_id, campaign_id, event_id, checkin_id, expires_at)
    VALUES (v_qr.user_id, v_campaign.id, _event_id, v_checkin_id, v_expiration)
    ON CONFLICT (user_id, campaign_id) DO NOTHING;

    IF FOUND THEN v_rewards := v_rewards + 1; END IF;
  END LOOP;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (
    v_staff,
    'checkin_validated',
    'checkin',
    v_checkin_id::text,
    jsonb_build_object(
      'user_id', v_qr.user_id,
      'event_id', _event_id,
      'rewards_granted', v_rewards
    )
  );

  SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_qr.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'checkin_id', v_checkin_id,
    'user_id', v_qr.user_id,
    'display_name', coalesce(v_display_name, 'Bafafã'),
    'event_name', v_event.name,
    'rewards_granted', v_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_checkin_qr(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_checkin_qr(text, uuid) TO authenticated, service_role;

-- Validates a reward token. Only equipe/admin can run it.
CREATE OR REPLACE FUNCTION public.redeem_reward_qr(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff uuid := auth.uid();
  v_qr public.qr_tokens%ROWTYPE;
  v_reward public.user_rewards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_name text;
BEGIN
  IF v_staff IS NULL OR NOT (
    public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  SELECT * INTO v_qr
  FROM public.qr_tokens
  WHERE purpose = 'redemption'
    AND used_at IS NULL
    AND expires_at > now()
    AND (token::text = lower(trim(_token)) OR short_code = regexp_replace(_token, '[^0-9]', '', 'g'))
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido ou expirado.'; END IF;

  SELECT * INTO v_reward FROM public.user_rewards WHERE id = v_qr.ref_id FOR UPDATE;
  IF NOT FOUND OR v_reward.user_id <> v_qr.user_id OR v_reward.status <> 'available'
     OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
    RAISE EXCEPTION 'Mimo indisponível.';
  END IF;

  INSERT INTO public.reward_redemptions (reward_id, user_id, staff_id)
  VALUES (v_reward.id, v_reward.user_id, v_staff);

  UPDATE public.user_rewards SET status = 'redeemed' WHERE id = v_reward.id;
  UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;

  INSERT INTO public.audit_logs (actor_id, action, entity, entity_id, details)
  VALUES (
    v_staff,
    'reward_redeemed',
    'user_reward',
    v_reward.id::text,
    jsonb_build_object('user_id', v_reward.user_id, 'campaign_id', v_reward.campaign_id)
  );

  SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_reward.campaign_id;
  SELECT display_name INTO v_name FROM public.profiles WHERE id = v_reward.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'display_name', coalesce(v_name, 'Bafafã'),
    'campaign_name', v_campaign.name,
    'product_name', v_campaign.product_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward_qr(text) TO authenticated, service_role;


-- Development flags: e-mail login remains available until the phone provider
-- is configured for the real pilot.
UPDATE public.app_settings
SET value = coalesce(value, '{}'::jsonb) ||
  '{"fofoquinhas":false,"reservas":false,"assinaturas":false,"indicacoes":false,"chat":false,"phone_auth":false,"email_auth_public":true}'::jsonb,
  updated_at = now()
WHERE key = 'feature_flags';

UPDATE public.app_settings
SET value = 'false'::jsonb, updated_at = now()
WHERE key = 'demo_mode';
