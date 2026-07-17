BEGIN;

-- V10 / Bloco 2: operação de eventos, campanhas, QR por câmera e histórico.

-- 1) Eventos em rascunho não aparecem para clientes. Mantém "scheduled" por compatibilidade.
DROP POLICY IF EXISTS "Everyone reads active events" ON public.events;
CREATE POLICY "Everyone reads active events" ON public.events
  FOR SELECT
  USING (status IN ('scheduled', 'published', 'ongoing', 'ended'));

-- 2) Validação centralizada de datas e limites.
CREATE OR REPLACE FUNCTION public.tg_validate_event_operation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'O fim do evento precisa ser depois do início.';
  END IF;
  IF NEW.checkin_opens_at IS NOT NULL AND NEW.checkin_closes_at IS NOT NULL
     AND NEW.checkin_closes_at <= NEW.checkin_opens_at THEN
    RAISE EXCEPTION 'O encerramento do check-in precisa ser depois da abertura.';
  END IF;
  IF NEW.chat_opens_at IS NOT NULL AND NEW.chat_closes_at IS NOT NULL
     AND NEW.chat_closes_at <= NEW.chat_opens_at THEN
    RAISE EXCEPTION 'O encerramento da Resenha precisa ser depois da abertura.';
  END IF;
  IF NEW.status NOT IN ('draft','published','scheduled','ongoing','ended','cancelled') THEN
    RAISE EXCEPTION 'Status de evento inválido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_event_operation ON public.events;
CREATE TRIGGER trg_validate_event_operation
BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_event_operation();

CREATE OR REPLACE FUNCTION public.tg_validate_campaign_operation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at <= NEW.starts_at THEN
    RAISE EXCEPTION 'O fim da campanha precisa ser depois do início.';
  END IF;
  IF NEW.reward_valid_hours <= 0 THEN
    RAISE EXCEPTION 'A validade do mimo precisa ser maior que zero.';
  END IF;
  IF NEW.total_available IS NOT NULL AND NEW.total_available < 1 THEN
    RAISE EXCEPTION 'O limite total precisa ser maior que zero.';
  END IF;
  IF NEW.per_user_limit < 1 THEN
    RAISE EXCEPTION 'O limite por cliente precisa ser maior que zero.';
  END IF;
  IF NEW.total_available IS NOT NULL AND NEW.per_user_limit > NEW.total_available THEN
    RAISE EXCEPTION 'O limite por cliente não pode ser maior que o limite total.';
  END IF;
  IF NEW.status NOT IN ('active','paused','ended') THEN
    RAISE EXCEPTION 'Status de campanha inválido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_campaign_operation ON public.campaigns;
CREATE TRIGGER trg_validate_campaign_operation
BEFORE INSERT OR UPDATE ON public.campaigns
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_campaign_operation();

-- 3) Permite o limite por cliente ser maior que um sem duplicação acidental por concorrência.
DROP INDEX IF EXISTS public.uq_user_rewards_user_campaign;
CREATE INDEX IF NOT EXISTS idx_user_rewards_user_campaign
  ON public.user_rewards(user_id, campaign_id);

-- 4) Duplicar evento com as campanhas pausadas. Somente admin.
CREATE OR REPLACE FUNCTION public.duplicate_event_with_campaigns(_event_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    chat_enabled, chat_opens_at, chat_closes_at
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
    CASE WHEN v_source.chat_closes_at IS NULL THEN NULL ELSE v_source.chat_closes_at + interval '7 days' END
  ) RETURNING id INTO v_new_id;

  INSERT INTO public.campaigns (
    event_id, name, description, benefit_type, discount_percent,
    discount_max_cents, fixed_off_cents, product_name, instructions,
    starts_at, ends_at, reward_valid_hours, total_available,
    per_user_limit, requires_checkin, requires_min_profile,
    required_badge_id, status, public_rules, internal_rules
  )
  SELECT
    v_new_id, name || ' — cópia', description, benefit_type, discount_percent,
    discount_max_cents, fixed_off_cents, product_name, instructions,
    starts_at + interval '7 days',
    CASE WHEN ends_at IS NULL THEN NULL ELSE ends_at + interval '7 days' END,
    reward_valid_hours, total_available, per_user_limit, requires_checkin,
    requires_min_profile, required_badge_id, 'paused', public_rules, internal_rules
  FROM public.campaigns
  WHERE event_id = _event_id AND status <> 'ended';

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (v_actor, 'event_duplicated', 'event', v_new_id::text,
    jsonb_build_object('source_event_id', _event_id));

  RETURN v_new_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_event_with_campaigns(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_event_with_campaigns(uuid) TO authenticated, service_role;

-- 5) Encerramento operacional imediato do check-in.
CREATE OR REPLACE FUNCTION public.close_event_checkin(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;
  UPDATE public.events
  SET checkin_enabled = false,
      checkin_closes_at = CASE
        WHEN checkin_opens_at IS NULL OR checkin_opens_at < now() THEN now()
        ELSE checkin_closes_at
      END,
      updated_at = now()
  WHERE id = _event_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (v_actor, 'event_checkin_closed', 'event', _event_id::text, jsonb_build_object('closed_at', now()));
END;
$$;
REVOKE ALL ON FUNCTION public.close_event_checkin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.close_event_checkin(uuid) TO authenticated, service_role;

-- 6) Atualiza a situação dos mimos vencidos do próprio usuário.
CREATE OR REPLACE FUNCTION public.refresh_my_reward_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  UPDATE public.user_rewards
  SET status = 'expired', updated_at = now()
  WHERE user_id = v_user
    AND status = 'available'
    AND expires_at IS NOT NULL
    AND expires_at <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_my_reward_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_my_reward_statuses() TO authenticated, service_role;

-- 7) Geração de QR aceita eventos publicados e mantém código temporário sem dados pessoais.
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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _purpose NOT IN ('checkin', 'redemption') THEN RAISE EXCEPTION 'Finalidade inválida.'; END IF;

  IF _purpose = 'checkin' THEN
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = _ref_id
        AND e.checkin_enabled
        AND e.status IN ('scheduled','published','ongoing')
        AND now() >= coalesce(e.checkin_opens_at, e.starts_at - interval '2 hours')
        AND now() <= coalesce(e.checkin_closes_at, e.starts_at + interval '6 hours')
    ) THEN
      RAISE EXCEPTION 'Check-in ainda não está disponível para este evento.';
    END IF;
  ELSE
    PERFORM public.refresh_my_reward_statuses();
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.user_rewards r
      WHERE r.id = _ref_id AND r.user_id = v_user AND r.status = 'available'
        AND (r.expires_at IS NULL OR r.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Mimo indisponível.';
    END IF;
  END IF;

  UPDATE public.qr_tokens AS qt SET used_at = now()
  WHERE qt.user_id = v_user AND qt.purpose = _purpose AND qt.used_at IS NULL;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.qr_tokens AS qt
      WHERE qt.short_code = v_code AND qt.used_at IS NULL AND qt.expires_at > now()
    );
    IF v_attempt >= 10 THEN RAISE EXCEPTION 'Não foi possível gerar o código. Tente novamente.'; END IF;
  END LOOP;

  INSERT INTO public.qr_tokens(user_id, purpose, ref_id, short_code, expires_at)
  VALUES (v_user, _purpose, _ref_id, v_code, v_expires)
  RETURNING qr_tokens.token INTO v_token;

  RETURN QUERY SELECT v_token, v_code, v_expires;
END;
$$;
REVOKE ALL ON FUNCTION public.create_my_qr_token(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_qr_token(text, uuid) TO authenticated, service_role;

-- 8) Validação de check-in com limites reais de campanhas.
CREATE OR REPLACE FUNCTION public.validate_checkin_qr(_token text, _event_id uuid)
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
BEGIN
  IF v_staff IS NULL OR NOT (public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;

  SELECT * INTO v_qr FROM public.qr_tokens qt
  WHERE qt.purpose = 'checkin' AND qt.ref_id = _event_id AND qt.used_at IS NULL
    AND qt.expires_at > now()
    AND (qt.token::text = lower(trim(_token)) OR qt.short_code = regexp_replace(_token, '[^0-9]', '', 'g'))
  ORDER BY qt.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código inválido ou expirado.'; END IF;

  SELECT * INTO v_event FROM public.events WHERE id = _event_id FOR SHARE;
  IF NOT FOUND OR NOT v_event.checkin_enabled OR v_event.status NOT IN ('scheduled','published','ongoing') THEN
    RAISE EXCEPTION 'Check-in indisponível para este evento.';
  END IF;
  IF now() < coalesce(v_event.checkin_opens_at, v_event.starts_at - interval '2 hours') THEN RAISE EXCEPTION 'A janela de check-in ainda não abriu.'; END IF;
  IF now() > coalesce(v_event.checkin_closes_at, v_event.starts_at + interval '6 hours') THEN RAISE EXCEPTION 'A janela de check-in já encerrou.'; END IF;

  SELECT id INTO v_existing_id FROM public.checkins WHERE user_id = v_qr.user_id AND event_id = _event_id;
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;
    SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_qr.user_id;
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'checkin_id', v_existing_id,
      'user_id', v_qr.user_id, 'display_name', coalesce(v_display_name,'Bafafã'),
      'event_name', v_event.name, 'rewards_granted', 0);
  END IF;

  INSERT INTO public.checkins(user_id, event_id, staff_id, method)
  VALUES(v_qr.user_id, _event_id, v_staff, 'qr') RETURNING id INTO v_checkin_id;
  UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;
  v_profile := public.calculate_profile_completeness(v_qr.user_id);

  FOR v_campaign IN
    SELECT * FROM public.campaigns c
    WHERE c.event_id = _event_id AND c.status = 'active'
      AND c.starts_at <= now() AND (c.ends_at IS NULL OR c.ends_at >= now())
  LOOP
    IF v_campaign.requires_min_profile AND v_profile < 40 THEN CONTINUE; END IF;
    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.user_badges ub WHERE ub.user_id = v_qr.user_id AND ub.badge_id = v_campaign.required_badge_id
    ) THEN CONTINUE; END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(v_qr.user_id::text || v_campaign.id::text, 0));
    SELECT count(*) INTO v_total_count FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.status <> 'revoked';
    SELECT count(*) INTO v_user_count FROM public.user_rewards ur
      WHERE ur.campaign_id = v_campaign.id AND ur.user_id = v_qr.user_id AND ur.status <> 'revoked';
    IF v_campaign.total_available IS NOT NULL AND v_total_count >= v_campaign.total_available THEN CONTINUE; END IF;
    IF v_user_count >= v_campaign.per_user_limit THEN CONTINUE; END IF;

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
    IF v_campaign.ends_at IS NOT NULL THEN v_expiration := least(v_expiration, v_campaign.ends_at); END IF;
    INSERT INTO public.user_rewards(user_id, campaign_id, event_id, checkin_id, expires_at)
    VALUES(v_qr.user_id, v_campaign.id, _event_id, v_checkin_id, v_expiration);
    v_rewards := v_rewards + 1;
  END LOOP;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES(v_staff, 'checkin_validated', 'checkin', v_checkin_id::text,
    jsonb_build_object('user_id',v_qr.user_id,'event_id',_event_id,'rewards_granted',v_rewards));
  SELECT display_name INTO v_display_name FROM public.profiles WHERE id = v_qr.user_id;
  RETURN jsonb_build_object('ok',true,'duplicate',false,'checkin_id',v_checkin_id,
    'user_id',v_qr.user_id,'display_name',coalesce(v_display_name,'Bafafã'),
    'event_name',v_event.name,'rewards_granted',v_rewards);
END;
$$;
REVOKE ALL ON FUNCTION public.validate_checkin_qr(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_checkin_qr(text, uuid) TO authenticated, service_role;

COMMIT;
