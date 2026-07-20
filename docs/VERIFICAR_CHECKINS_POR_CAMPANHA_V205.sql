-- BAFAFÁ CONNECT V20.5 — VERIFICAÇÃO CONTROLADA
-- Cria dados sintéticos dentro de uma transação e executa ROLLBACK no fim.
-- Nenhum evento, check-in, campanha ou recompensa de teste permanece salvo.

BEGIN;

CREATE TEMP TABLE v205_test_context (
  user_id uuid NOT NULL,
  campaign_distinct_id uuid NOT NULL,
  campaign_total_id uuid NOT NULL,
  campaign_category_id uuid NOT NULL,
  campaign_new_cycle_id uuid NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
  v_user uuid;
  v_old_event_ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_new_event_ids uuid[] := ARRAY[gen_random_uuid(), gen_random_uuid(), gen_random_uuid()];
  v_campaign_distinct uuid := gen_random_uuid();
  v_campaign_total uuid := gen_random_uuid();
  v_campaign_category uuid := gen_random_uuid();
  v_campaign_new_cycle uuid := gen_random_uuid();
  v_now timestamptz := now();
BEGIN
  SELECT p.id INTO v_user
  FROM public.profiles p
  WHERE p.deleted_at IS NULL
  ORDER BY p.created_at
  LIMIT 1;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'A verificação V20.5 precisa de ao menos um perfil existente.';
  END IF;

  INSERT INTO public.events (
    id, name, slug, category, starts_at, ends_at, status,
    checkin_enabled, chat_enabled, public_visible
  )
  SELECT
    event_id,
    'V20.5 teste antigo ' || ordinal,
    'v205-antigo-' || replace(event_id::text, '-', ''),
    'pagode',
    v_now - interval '12 days' + (ordinal * interval '1 day'),
    v_now - interval '12 days' + (ordinal * interval '1 day') + interval '6 hours',
    'ended', true, false, false
  FROM unnest(v_old_event_ids) WITH ORDINALITY AS old_events(event_id, ordinal);

  INSERT INTO public.events (
    id, name, slug, category, starts_at, ends_at, status,
    checkin_enabled, chat_enabled, public_visible
  )
  SELECT
    event_id,
    'V20.5 teste novo ' || ordinal,
    'v205-novo-' || replace(event_id::text, '-', ''),
    'pagode',
    v_now - interval '30 hours' + (ordinal * interval '8 hours'),
    v_now - interval '30 hours' + (ordinal * interval '8 hours') + interval '6 hours',
    'ended', true, false, false
  FROM unnest(v_new_event_ids) WITH ORDINALITY AS new_events(event_id, ordinal);

  -- Três visitas antigas, fora da janela das campanhas principais.
  INSERT INTO public.checkins(user_id, event_id, method, created_at)
  VALUES
    (v_user, v_old_event_ids[1], 'manual', v_now - interval '11 days'),
    (v_user, v_old_event_ids[2], 'manual', v_now - interval '10 days'),
    (v_user, v_old_event_ids[3], 'manual', v_now - interval '9 days');

  -- Três novas visitas. Apenas a última ocorreu depois do início do novo ciclo.
  INSERT INTO public.checkins(user_id, event_id, method, created_at)
  VALUES
    (v_user, v_new_event_ids[1], 'manual', v_now - interval '22 hours'),
    (v_user, v_new_event_ids[2], 'manual', v_now - interval '14 hours'),
    (v_user, v_new_event_ids[3], 'manual', v_now - interval '6 hours');

  INSERT INTO public.campaigns (
    id, name, benefit_type, starts_at, ends_at, status, campaign_kind,
    trigger_type, trigger_target, trigger_category, requires_checkin,
    requires_min_profile, requires_staff_validation, feed_visible,
    public_title, public_copy
  )
  VALUES
    (
      v_campaign_distinct, 'V20.5 teste check-ins distintos', 'discount',
      v_now - interval '2 days', v_now + interval '2 days', 'active', 'milestone',
      'distinct_checkins', 3, NULL, false, false, false, false,
      'Teste distinto', 'Teste interno temporário'
    ),
    (
      v_campaign_total, 'V20.5 teste check-ins totais', 'discount',
      v_now - interval '2 days', v_now + interval '2 days', 'active', 'milestone',
      'total_checkins', 3, NULL, false, false, false, false,
      'Teste total', 'Teste interno temporário'
    ),
    (
      v_campaign_category, 'V20.5 teste categoria', 'discount',
      v_now - interval '2 days', v_now + interval '2 days', 'active', 'milestone',
      'category_checkins', 3, 'pagode', false, false, false, false,
      'Teste categoria', 'Teste interno temporário'
    ),
    (
      v_campaign_new_cycle, 'V20.5 teste novo ciclo', 'discount',
      v_now - interval '8 hours', v_now + interval '2 days', 'active', 'milestone',
      'distinct_checkins', 3, NULL, false, false, false, false,
      'Teste novo ciclo', 'Teste interno temporário'
    );

  INSERT INTO v205_test_context(
    user_id, campaign_distinct_id, campaign_total_id,
    campaign_category_id, campaign_new_cycle_id
  )
  VALUES(
    v_user, v_campaign_distinct, v_campaign_total,
    v_campaign_category, v_campaign_new_cycle
  );
END;
$$;

WITH context AS (
  SELECT * FROM v205_test_context
), results AS (
  SELECT
    (SELECT progress_value FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_distinct_id
    )) AS distinct_progress,
    (SELECT completed FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_distinct_id
    )) AS distinct_completed,
    (SELECT progress_value FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_total_id
    )) AS total_progress,
    (SELECT completed FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_total_id
    )) AS total_completed,
    (SELECT progress_value FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_category_id
    )) AS category_progress,
    (SELECT completed FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_category_id
    )) AS category_completed,
    (SELECT progress_value FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_new_cycle_id
    )) AS new_cycle_progress,
    (SELECT completed FROM public.campaign_progress_for_user(
      context.user_id, context.campaign_new_cycle_id
    )) AS new_cycle_completed,
    position(
      'c.created_at >= v_campaign.starts_at'
      IN pg_get_functiondef('public.campaign_progress_for_user(uuid,uuid)'::regprocedure)
    ) > 0 AS starts_at_filter_present,
    position(
      'v_campaign.ends_at IS NULL OR c.created_at <= v_campaign.ends_at'
      IN pg_get_functiondef('public.campaign_progress_for_user(uuid,uuid)'::regprocedure)
    ) > 0 AS ends_at_filter_present
  FROM context
)
SELECT
  *,
  distinct_progress = 3
  AND distinct_completed
  AND total_progress = 3
  AND total_completed
  AND category_progress = 3
  AND category_completed
  AND new_cycle_progress = 1
  AND NOT new_cycle_completed
  AND starts_at_filter_present
  AND ends_at_filter_present AS verificacao_ok
FROM results;

ROLLBACK;
