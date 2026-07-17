-- BAFAFÁ — correção do erro:
-- column reference "short_code" is ambiguous

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

    SELECT e.* INTO v_event
    FROM public.events AS e
    WHERE e.id = _ref_id
      AND e.checkin_enabled
      AND e.status IN ('scheduled', 'ongoing')
      AND now() >= coalesce(e.checkin_opens_at, e.starts_at - interval '2 hours')
      AND now() <= coalesce(e.checkin_closes_at, e.starts_at + interval '6 hours');

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Check-in ainda não está disponível para este evento.';
    END IF;
  ELSE
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM public.user_rewards AS r
      WHERE r.id = _ref_id
        AND r.user_id = v_user
        AND r.status = 'available'
        AND (r.expires_at IS NULL OR r.expires_at > now())
    ) THEN
      RAISE EXCEPTION 'Mimo indisponível.';
    END IF;
  END IF;

  UPDATE public.qr_tokens AS qt
     SET used_at = now()
   WHERE qt.user_id = v_user
     AND qt.purpose = _purpose
     AND qt.used_at IS NULL;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.qr_tokens AS qt
      WHERE qt.short_code = v_code
        AND qt.used_at IS NULL
        AND qt.expires_at > now()
    );

    IF v_attempt >= 10 THEN
      RAISE EXCEPTION 'Não foi possível gerar o código. Tente novamente.';
    END IF;
  END LOOP;

  INSERT INTO public.qr_tokens AS qt (
    user_id,
    purpose,
    ref_id,
    short_code,
    expires_at
  )
  VALUES (
    v_user,
    _purpose,
    _ref_id,
    v_code,
    v_expires
  )
  RETURNING qt.token INTO v_token;

  RETURN QUERY
  SELECT v_token, v_code, v_expires;
END;
$$;

REVOKE ALL ON FUNCTION public.create_my_qr_token(text, uuid)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.create_my_qr_token(text, uuid)
TO authenticated, service_role;
