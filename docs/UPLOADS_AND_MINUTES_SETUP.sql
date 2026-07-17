-- Upload de imagens e validade de campanhas em minutos/horas.
BEGIN;

ALTER TABLE public.campaigns
  ALTER COLUMN reward_valid_hours TYPE numeric(10,4)
  USING reward_valid_hours::numeric;

ALTER TABLE public.campaigns
  DROP CONSTRAINT IF EXISTS campaigns_reward_valid_hours_positive;

ALTER TABLE public.campaigns
  ADD CONSTRAINT campaigns_reward_valid_hours_positive
  CHECK (reward_valid_hours > 0);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('event-images', 'event-images', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif']),
  ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public_read_event_images" ON storage.objects;
CREATE POLICY "public_read_event_images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "admins_upload_event_images" ON storage.objects;
CREATE POLICY "admins_upload_event_images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "admins_update_event_images" ON storage.objects;
CREATE POLICY "admins_update_event_images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'event-images'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "admins_delete_event_images" ON storage.objects;
CREATE POLICY "admins_delete_event_images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-images'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "public_read_avatars" ON storage.objects;
CREATE POLICY "public_read_avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "users_upload_own_avatar" ON storage.objects;
CREATE POLICY "users_upload_own_avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects;
CREATE POLICY "users_update_own_avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "users_delete_own_avatar" ON storage.objects;
CREATE POLICY "users_delete_own_avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

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

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
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


COMMIT;
