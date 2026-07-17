-- Bafafá Connect V20.1
-- Feed resiliente, posicionamento editorial intuitivo e Fofocômetro público.

BEGIN;

-- 1. Posição editorial legível para publicações do feed.
ALTER TABLE public.feed_posts
  ADD COLUMN IF NOT EXISTS placement text;

UPDATE public.feed_posts
SET placement = CASE
  WHEN is_pinned THEN 'top'
  ELSE 'after_events'
END
WHERE placement IS NULL
   OR placement NOT IN ('top','after_promotions','after_current_event','after_events','bottom');

ALTER TABLE public.feed_posts
  ALTER COLUMN placement SET DEFAULT 'after_events',
  ALTER COLUMN placement SET NOT NULL;

ALTER TABLE public.feed_posts
  DROP CONSTRAINT IF EXISTS feed_posts_placement_check;

ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_placement_check
  CHECK (placement IN ('top','after_promotions','after_current_event','after_events','bottom'));

-- 2. Jornada segura mesmo quando o cliente ainda não fez check-in.
CREATE OR REPLACE FUNCTION public.my_event_journey()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_session public.customer_event_sessions%ROWTYPE;
  v_next_stage jsonb := NULL;
  v_pending_review jsonb := NULL;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Sessão inválida.';
  END IF;

  PERFORM public.sync_event_statuses();

  SELECT *
  INTO v_event
  FROM public.events
  WHERE status = 'ongoing'
    AND starts_at <= now()
    AND coalesce(ends_at, starts_at + interval '8 hours') >= now()
  ORDER BY starts_at
  LIMIT 1;

  IF v_event.id IS NOT NULL THEN
    SELECT *
    INTO v_session
    FROM public.customer_event_sessions
    WHERE user_id = v_user
      AND event_id = v_event.id
    LIMIT 1;
  END IF;

  IF v_session.id IS NOT NULL THEN
    SELECT jsonb_build_object(
      'stage_order', fs.stage_order,
      'trigger_type', fs.trigger_type,
      'threshold_cents', fs.threshold_cents,
      'title', fs.title,
      'progress_copy', fs.progress_copy,
      'unlocked_copy', fs.unlocked_copy,
      'completed', (efp.id IS NOT NULL AND efp.reversed_at IS NULL)
    )
    INTO v_next_stage
    FROM public.event_funnel_rules fr
    JOIN public.funnel_stages fs
      ON fs.rule_id = fr.id
     AND fs.active
    LEFT JOIN public.event_funnel_progress efp
      ON efp.session_id = v_session.id
     AND efp.stage_id = fs.id
    WHERE fr.active
      AND (fr.event_id = v_event.id OR fr.event_id IS NULL)
      AND (efp.id IS NULL OR efp.reversed_at IS NOT NULL)
    ORDER BY (fr.event_id IS NOT NULL) DESC, fs.stage_order
    LIMIT 1;
  END IF;

  SELECT jsonb_build_object(
    'event_id', e.id,
    'event_name', e.name,
    'ended_at', e.ends_at
  )
  INTO v_pending_review
  FROM public.checkins c
  JOIN public.events e ON e.id = c.event_id
  LEFT JOIN public.event_reviews r
    ON r.user_id = c.user_id
   AND r.event_id = c.event_id
  WHERE c.user_id = v_user
    AND e.status = 'ended'
    AND r.id IS NULL
  ORDER BY e.ends_at DESC NULLS LAST, e.starts_at DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'event', CASE
      WHEN v_event.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_event.id,
        'name', v_event.name,
        'starts_at', v_event.starts_at,
        'ends_at', v_event.ends_at,
        'chat_enabled', v_event.chat_enabled,
        'checkin_enabled', v_event.checkin_enabled
      )
    END,
    'checked_in', coalesce(v_session.checkin_id IS NOT NULL, false),
    'session', CASE
      WHEN v_session.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', v_session.id,
        'gross_total_cents', v_session.gross_total_cents,
        'discount_total_cents', v_session.discount_total_cents,
        'net_total_cents', v_session.net_total_cents,
        'funnel_net_total_cents', v_session.funnel_net_total_cents,
        'cost_total_cents', v_session.cost_total_cents,
        'margin_total_cents', v_session.margin_total_cents,
        'current_stage', v_session.current_stage
      )
    END,
    'next_stage', v_next_stage,
    'pending_review', v_pending_review
  );
END;
$$;

REVOKE ALL ON FUNCTION public.my_event_journey() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_journey() TO authenticated, service_role;

-- 3. O placar público passa a devolver todos os campos exigidos pelo frontend.
CREATE OR REPLACE FUNCTION public.event_fofocometro(_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'event_id', g.event_id,
        'event_name', e.name,
        'campaign_id', g.campaign_id,
        'name', g.name,
        'stage_order', g.stage_order,
        'target_count', g.target_count,
        'current_count', g.current_count,
        'remaining_count', greatest(g.target_count - g.current_count, 0),
        'status', g.status,
        'starts_at', g.starts_at,
        'completed_at', g.completed_at,
        'reward_description', g.reward_description
      )
      ORDER BY g.stage_order
    ),
    '[]'::jsonb
  )
  FROM public.collective_goals g
  JOIN public.events e ON e.id = g.event_id
  WHERE g.event_id = _event_id
    AND g.status IN ('scheduled','active','completed')
$$;

REVOKE ALL ON FUNCTION public.event_fofocometro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_fofocometro(uuid) TO anon, authenticated, service_role;

COMMIT;
