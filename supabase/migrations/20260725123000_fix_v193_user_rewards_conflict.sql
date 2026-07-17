-- Bafafá Connect V19.3.1
-- Registra no histórico de migrations a correção do ON CONFLICT incompatível
-- com a estrutura atual de public.user_rewards.
--
-- IMPORTANTE: este arquivo pressupõe que a migration V19.3 corrigida já criou
-- public.refresh_user_milestone_rewards(uuid). Para a instalação manual no
-- Supabase, execute 02-SUPABASE-EXECUTAR/BAFAFA_V1931_CORRECAO_COMPLETA.sql.

BEGIN;

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
  v_rows integer;
  v_granted integer := 0;
BEGIN
  FOR v_campaign IN
    SELECT c.*
    FROM public.campaigns c
    WHERE c.status = 'active'
      AND c.starts_at <= now()
      AND (c.ends_at IS NULL OR c.ends_at >= now())
      AND (
        (c.campaign_kind = 'milestone' AND c.trigger_type IN (
          'distinct_checkins', 'total_checkins', 'profile_completion', 'category_checkins'
        ))
        OR (c.campaign_kind = 'global' AND c.trigger_type = 'none')
      )
  LOOP
    IF v_campaign.campaign_kind = 'milestone' THEN
      SELECT * INTO v_progress
      FROM public.campaign_progress_for_user(_user_id, v_campaign.id);
      IF NOT coalesce(v_progress.completed, false) THEN
        CONTINUE;
      END IF;
    END IF;

    IF v_campaign.requires_checkin AND NOT EXISTS (
      SELECT 1
      FROM public.checkins ci
      WHERE ci.user_id = _user_id
        AND ci.created_at >= v_campaign.starts_at
        AND (v_campaign.ends_at IS NULL OR ci.created_at <= v_campaign.ends_at)
        AND (
          NOT v_campaign.requires_staff_validation
          OR ci.staff_id IS NOT NULL
          OR ci.method IN ('qr', 'manual', 'code', 'qr_confirmed')
        )
    ) THEN
      CONTINUE;
    END IF;

    IF v_campaign.requires_min_profile
      AND public.calculate_profile_completeness(_user_id) < 40 THEN
      CONTINUE;
    END IF;

    IF v_campaign.required_badge_id IS NOT NULL AND NOT EXISTS (
      SELECT 1
      FROM public.user_badges ub
      WHERE ub.user_id = _user_id
        AND ub.badge_id = v_campaign.required_badge_id
    ) THEN
      CONTINUE;
    END IF;

    PERFORM pg_advisory_xact_lock(
      hashtextextended(_user_id::text || v_campaign.id::text, 0)
    );

    SELECT count(*) INTO v_total
    FROM public.user_rewards ur
    WHERE ur.campaign_id = v_campaign.id
      AND ur.status <> 'revoked';

    SELECT count(*) INTO v_user_total
    FROM public.user_rewards ur
    WHERE ur.campaign_id = v_campaign.id
      AND ur.user_id = _user_id
      AND ur.status <> 'revoked';

    IF v_campaign.total_available IS NOT NULL
      AND v_total >= v_campaign.total_available THEN
      CONTINUE;
    END IF;

    IF v_user_total >= v_campaign.per_user_limit THEN
      CONTINUE;
    END IF;

    v_expiration := now() + (v_campaign.reward_valid_hours * interval '1 hour');
    IF v_campaign.ends_at IS NOT NULL THEN
      v_expiration := least(v_expiration, v_campaign.ends_at);
    END IF;

    INSERT INTO public.user_rewards(user_id, campaign_id, event_id, expires_at)
    VALUES (_user_id, v_campaign.id, NULL, v_expiration);

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_granted := v_granted + v_rows;
  END LOOP;

  RETURN v_granted;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_user_milestone_rewards(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_user_milestone_rewards(uuid)
TO service_role;

COMMIT;
