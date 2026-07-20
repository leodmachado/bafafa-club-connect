-- BAFAFÁ CONNECT V20.5
-- Marcos de check-in passam a contar somente visitas ocorridas dentro da
-- janela da própria campanha. Uma campanha nova começa em zero, sem herdar
-- check-ins anteriores.

BEGIN;

CREATE OR REPLACE FUNCTION public.campaign_progress_for_user(
  _user_id uuid,
  _campaign_id uuid
)
RETURNS TABLE(
  progress_value integer,
  target_value integer,
  completed boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
  v_progress integer := 0;
BEGIN
  -- Função interna: execução direta permanece revogada dos clientes.
  SELECT * INTO v_campaign
  FROM public.campaigns
  WHERE id = _campaign_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  CASE v_campaign.trigger_type
    WHEN 'distinct_checkins' THEN
      SELECT count(DISTINCT c.event_id)::integer
      INTO v_progress
      FROM public.checkins c
      WHERE c.user_id = _user_id
        AND c.created_at >= v_campaign.starts_at
        AND (v_campaign.ends_at IS NULL OR c.created_at <= v_campaign.ends_at)
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr', 'manual', 'code', 'qr_confirmed')
        );

    WHEN 'total_checkins' THEN
      SELECT count(*)::integer
      INTO v_progress
      FROM public.checkins c
      WHERE c.user_id = _user_id
        AND c.created_at >= v_campaign.starts_at
        AND (v_campaign.ends_at IS NULL OR c.created_at <= v_campaign.ends_at)
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr', 'manual', 'code', 'qr_confirmed')
        );

    WHEN 'profile_completion' THEN
      v_progress := public.calculate_profile_completeness(_user_id);

    WHEN 'category_checkins' THEN
      SELECT count(DISTINCT c.event_id)::integer
      INTO v_progress
      FROM public.checkins c
      JOIN public.events e ON e.id = c.event_id
      WHERE c.user_id = _user_id
        AND c.created_at >= v_campaign.starts_at
        AND (v_campaign.ends_at IS NULL OR c.created_at <= v_campaign.ends_at)
        AND (
          NOT v_campaign.requires_staff_validation
          OR c.staff_id IS NOT NULL
          OR c.method IN ('qr', 'manual', 'code', 'qr_confirmed')
        )
        AND lower(e.category) = lower(coalesce(v_campaign.trigger_category, ''));

    WHEN 'event_checkin' THEN
      SELECT CASE WHEN EXISTS (
        SELECT 1
        FROM public.checkins c
        WHERE c.user_id = _user_id
          AND c.event_id = v_campaign.event_id
          AND c.created_at >= v_campaign.starts_at
          AND (v_campaign.ends_at IS NULL OR c.created_at <= v_campaign.ends_at)
          AND (
            NOT v_campaign.requires_staff_validation
            OR c.staff_id IS NOT NULL
            OR c.method IN ('qr', 'manual', 'code', 'qr_confirmed')
          )
      ) THEN 1 ELSE 0 END
      INTO v_progress;

    ELSE
      v_progress := 0;
  END CASE;

  RETURN QUERY
  SELECT
    LEAST(v_progress, v_campaign.trigger_target),
    v_campaign.trigger_target,
    v_progress >= v_campaign.trigger_target;
END;
$$;

REVOKE ALL ON FUNCTION public.campaign_progress_for_user(uuid, uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.campaign_progress_for_user(uuid, uuid)
TO service_role;

COMMENT ON FUNCTION public.campaign_progress_for_user(uuid, uuid) IS
  'Calcula o progresso de uma campanha usando somente check-ins dentro de starts_at/ends_at da própria campanha.';

NOTIFY pgrst, 'reload schema';

COMMIT;
