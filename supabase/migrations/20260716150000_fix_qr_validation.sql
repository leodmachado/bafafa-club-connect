BEGIN;

-- Corrige a validação operacional dos códigos do Bafafá.
-- A função passa a localizar primeiro o token e somente depois validar
-- uso, expiração e evento. Isso evita que evento selecionado incorretamente
-- seja exibido como um genérico "Código inválido ou expirado".

CREATE OR REPLACE FUNCTION public.validate_checkin_qr(
  _token text,
  _event_id uuid DEFAULT NULL
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
  v_total_count integer;
  v_user_count integer;
  v_input text := lower(trim(coalesce(_token, '')));
  v_digits text := regexp_replace(coalesce(_token, ''), '[^0-9]', '', 'g');
  v_selected_mismatch boolean := false;
BEGIN
  IF v_staff IS NULL OR NOT (
    public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  IF v_input = '' THEN
    RAISE EXCEPTION 'Informe ou escaneie um código.';
  END IF;

  -- Localiza o código independentemente do evento selecionado na tela.
  -- O próprio QR já contém a referência segura do evento.
  SELECT qt.*
  INTO v_qr
  FROM public.qr_tokens AS qt
  WHERE qt.purpose = 'checkin'
    AND (
      qt.token::text = v_input
      OR (length(v_digits) = 6 AND qt.short_code = v_digits)
    )
  ORDER BY qt.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código não encontrado. Gere um novo código no celular do cliente.';
  END IF;

  IF v_qr.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este código já foi utilizado. Gere um novo código.';
  END IF;

  IF v_qr.expires_at <= now() THEN
    RAISE EXCEPTION 'Este código expirou. Gere um novo código e valide em seguida.';
  END IF;

  IF v_qr.ref_id IS NULL THEN
    RAISE EXCEPTION 'Código sem evento associado. Gere um novo código.';
  END IF;

  SELECT e.*
  INTO v_event
  FROM public.events AS e
  WHERE e.id = v_qr.ref_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'O evento associado ao código não existe mais.';
  END IF;

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

  SELECT c.id
  INTO v_existing_id
  FROM public.checkins AS c
  WHERE c.user_id = v_qr.user_id
    AND c.event_id = v_event.id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.qr_tokens AS qt
    SET used_at = now(), used_by = v_staff
    WHERE qt.token = v_qr.token;

    SELECT p.display_name
    INTO v_display_name
    FROM public.profiles AS p
    WHERE p.id = v_qr.user_id;

    RETURN jsonb_build_object(
      'ok', true,
      'duplicate', true,
      'checkin_id', v_existing_id,
      'user_id', v_qr.user_id,
      'display_name', coalesce(v_display_name, 'Bafafã'),
      'event_name', v_event.name,
      'event_id', v_event.id,
      'selected_event_mismatch', v_selected_mismatch,
      'rewards_granted', 0
    );
  END IF;

  INSERT INTO public.checkins(user_id, event_id, staff_id, method)
  VALUES(v_qr.user_id, v_event.id, v_staff, 'qr')
  RETURNING id INTO v_checkin_id;

  UPDATE public.qr_tokens AS qt
  SET used_at = now(), used_by = v_staff
  WHERE qt.token = v_qr.token;

  v_profile := public.calculate_profile_completeness(v_qr.user_id);

  FOR v_campaign IN
    SELECT c.*
    FROM public.campaigns AS c
    WHERE c.event_id = v_event.id
      AND c.status = 'active'
      AND c.starts_at <= now()
      AND (c.ends_at IS NULL OR c.ends_at >= now())
  LOOP
    IF v_campaign.requires_min_profile AND v_profile < 40 THEN
      CONTINUE;
    END IF;

    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.user_badges AS ub
      WHERE ub.user_id = v_qr.user_id
        AND ub.badge_id = v_campaign.required_badge_id
    ) THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(v_qr.user_id::text || v_campaign.id::text, 0)
    );

    SELECT count(*)
    INTO v_total_count
    FROM public.user_rewards AS ur
    WHERE ur.campaign_id = v_campaign.id
      AND ur.status <> 'revoked';

    SELECT count(*)
    INTO v_user_count
    FROM public.user_rewards AS ur
    WHERE ur.campaign_id = v_campaign.id
      AND ur.user_id = v_qr.user_id
      AND ur.status <> 'revoked';

    IF v_campaign.total_available IS NOT NULL
       AND v_total_count >= v_campaign.total_available THEN
      CONTINUE;
    END IF;

    IF v_user_count >= v_campaign.per_user_limit THEN
      CONTINUE;
    END IF;

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
    IF v_campaign.ends_at IS NOT NULL THEN
      v_expiration := least(v_expiration, v_campaign.ends_at);
    END IF;

    INSERT INTO public.user_rewards(
      user_id, campaign_id, event_id, checkin_id, expires_at
    )
    VALUES(
      v_qr.user_id, v_campaign.id, v_event.id, v_checkin_id, v_expiration
    )
    ON CONFLICT (user_id, campaign_id) DO NOTHING;

    IF FOUND THEN
      v_rewards := v_rewards + 1;
    END IF;
  END LOOP;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(
    v_staff,
    'checkin_validated',
    'checkin',
    v_checkin_id::text,
    jsonb_build_object(
      'user_id', v_qr.user_id,
      'event_id', v_event.id,
      'selected_event_id', _event_id,
      'selected_event_mismatch', v_selected_mismatch,
      'rewards_granted', v_rewards
    )
  );

  SELECT p.display_name
  INTO v_display_name
  FROM public.profiles AS p
  WHERE p.id = v_qr.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'checkin_id', v_checkin_id,
    'user_id', v_qr.user_id,
    'display_name', coalesce(v_display_name, 'Bafafã'),
    'event_name', v_event.name,
    'event_id', v_event.id,
    'selected_event_mismatch', v_selected_mismatch,
    'rewards_granted', v_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.validate_checkin_qr(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_checkin_qr(text, uuid)
TO authenticated, service_role;

-- Torna também as mensagens de resgate de mimo específicas.
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
  v_input text := lower(trim(coalesce(_token, '')));
  v_digits text := regexp_replace(coalesce(_token, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_staff IS NULL OR NOT (
    public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')
  ) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  IF v_input = '' THEN
    RAISE EXCEPTION 'Informe ou escaneie um código.';
  END IF;

  SELECT qt.*
  INTO v_qr
  FROM public.qr_tokens AS qt
  WHERE qt.purpose = 'redemption'
    AND (
      qt.token::text = v_input
      OR (length(v_digits) = 6 AND qt.short_code = v_digits)
    )
  ORDER BY qt.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de mimo não encontrado. Gere um novo na carteira do cliente.';
  END IF;

  IF v_qr.used_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este código de mimo já foi utilizado.';
  END IF;

  IF v_qr.expires_at <= now() THEN
    RAISE EXCEPTION 'Este código de mimo expirou. Gere um novo código.';
  END IF;

  SELECT ur.*
  INTO v_reward
  FROM public.user_rewards AS ur
  WHERE ur.id = v_qr.ref_id
  FOR UPDATE;

  IF NOT FOUND OR v_reward.user_id <> v_qr.user_id THEN
    RAISE EXCEPTION 'Mimo não encontrado para este usuário.';
  END IF;

  IF v_reward.status <> 'available' THEN
    RAISE EXCEPTION 'Este mimo não está mais disponível.';
  END IF;

  IF v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now() THEN
    UPDATE public.user_rewards
    SET status = 'expired', updated_at = now()
    WHERE id = v_reward.id;
    RAISE EXCEPTION 'Este mimo expirou.';
  END IF;

  INSERT INTO public.reward_redemptions(reward_id, user_id, staff_id)
  VALUES(v_reward.id, v_reward.user_id, v_staff)
  ON CONFLICT (reward_id) DO NOTHING;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Este mimo já foi utilizado.';
  END IF;

  UPDATE public.user_rewards
  SET status = 'redeemed', updated_at = now()
  WHERE id = v_reward.id;

  UPDATE public.qr_tokens AS qt
  SET used_at = now(), used_by = v_staff
  WHERE qt.token = v_qr.token;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(
    v_staff,
    'reward_redeemed',
    'user_reward',
    v_reward.id::text,
    jsonb_build_object(
      'user_id', v_reward.user_id,
      'campaign_id', v_reward.campaign_id
    )
  );

  SELECT c.* INTO v_campaign
  FROM public.campaigns AS c
  WHERE c.id = v_reward.campaign_id;

  SELECT p.display_name INTO v_name
  FROM public.profiles AS p
  WHERE p.id = v_reward.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'display_name', coalesce(v_name, 'Bafafã'),
    'campaign_name', v_campaign.name,
    'product_name', v_campaign.product_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.redeem_reward_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_reward_qr(text)
TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
