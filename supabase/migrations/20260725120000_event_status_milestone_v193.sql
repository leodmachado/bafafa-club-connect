-- Bafafá Connect V19.3.1 — correção do conflito em user_rewards
-- 1) Status automático de eventos pela data/hora.
-- 2) Marcos de check-in passam a contar, por padrão, os mesmos check-ins exibidos no perfil.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Status automático de eventos
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.event_status_from_schedule(
  _current_status text,
  _starts_at timestamptz,
  _ends_at timestamptz,
  _reference_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_end timestamptz;
BEGIN
  IF _current_status IN ('draft', 'cancelled') THEN
    RETURN _current_status;
  END IF;

  IF _starts_at IS NULL THEN
    RETURN coalesce(_current_status, 'draft');
  END IF;

  v_end := coalesce(_ends_at, _starts_at + interval '8 hours');

  IF _reference_at < _starts_at THEN
    RETURN 'scheduled';
  ELSIF _reference_at <= v_end THEN
    RETURN 'ongoing';
  ELSE
    RETURN 'ended';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.event_status_from_schedule(text,timestamptz,timestamptz,timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.event_status_from_schedule(text,timestamptz,timestamptz,timestamptz)
TO service_role;

CREATE OR REPLACE FUNCTION public.tg_auto_event_status_v193()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_effective_status text;
  v_effective_end timestamptz;
BEGIN
  v_effective_status := public.event_status_from_schedule(
    NEW.status,
    NEW.starts_at,
    NEW.ends_at,
    now()
  );
  NEW.status := v_effective_status;

  IF v_effective_status = 'ended' THEN
    v_effective_end := coalesce(NEW.ends_at, NEW.starts_at + interval '8 hours');
    NEW.checkin_closes_at := coalesce(NEW.checkin_closes_at, v_effective_end);
    NEW.chat_closes_at := coalesce(NEW.chat_closes_at, v_effective_end);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS events_auto_status_v193 ON public.events;
CREATE TRIGGER events_auto_status_v193
BEFORE INSERT OR UPDATE OF status, starts_at, ends_at
ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.tg_auto_event_status_v193();

CREATE OR REPLACE FUNCTION public.sync_event_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rows integer := 0;
BEGIN
  UPDATE public.events e
  SET status = public.event_status_from_schedule(e.status, e.starts_at, e.ends_at, now()),
      updated_at = now()
  WHERE e.status NOT IN ('draft', 'cancelled')
    AND e.status IS DISTINCT FROM public.event_status_from_schedule(
      e.status,
      e.starts_at,
      e.ends_at,
      now()
    );

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_event_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_event_statuses() TO authenticated, service_role;

-- Corrige imediatamente os eventos que já estavam com status atrasado.
SELECT public.sync_event_statuses();

-- ---------------------------------------------------------------------------
-- 2. Marcos de check-in coerentes com o contador do perfil
-- ---------------------------------------------------------------------------
-- Durante o MVP, marcos já cadastrados passam a contar todos os check-ins que
-- aparecem no perfil e deixam de exigir, silenciosamente, 40% de perfil.
UPDATE public.campaigns
SET requires_staff_validation = false,
    requires_min_profile = false,
    updated_at = now()
WHERE campaign_kind = 'milestone'
  AND trigger_type IN ('distinct_checkins', 'total_checkins', 'category_checkins')
  AND status IN ('active', 'paused');

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

    -- A tabela user_rewards permite mais de uma recompensa por campanha quando
    -- per_user_limit > 1. Por isso não existe uma restrição UNIQUE em
    -- (user_id, campaign_id). A trava transacional e as contagens acima evitam
    -- concessões concorrentes acima dos limites definidos na campanha.
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

-- Atualiza o benefício assim que um check-in é criado ou confirmado pela equipe.
CREATE OR REPLACE FUNCTION public.tg_refresh_milestone_rewards_v193()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.refresh_user_milestone_rewards(NEW.user_id);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Uma falha de campanha nunca deve invalidar o check-in do cliente.
  RAISE WARNING 'Não foi possível recalcular marcos do usuário %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS checkins_refresh_milestones_v193 ON public.checkins;
CREATE TRIGGER checkins_refresh_milestones_v193
AFTER INSERT OR UPDATE OF staff_id, method, event_id, user_id
ON public.checkins
FOR EACH ROW
EXECUTE FUNCTION public.tg_refresh_milestone_rewards_v193();

-- Reprocessa usuários que já tinham check-ins antes desta correção.
DO $$
DECLARE
  v_user record;
BEGIN
  FOR v_user IN SELECT DISTINCT c.user_id FROM public.checkins c LOOP
    PERFORM public.refresh_user_milestone_rewards(v_user.user_id);
  END LOOP;
END;
$$;

COMMIT;
