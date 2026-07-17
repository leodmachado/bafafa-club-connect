-- Bafafá Connect V20.1, verificação pós-instalação.

SELECT
  EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'feed_posts'
      AND column_name = 'placement'
      AND is_nullable = 'NO'
  ) AS posicionamento_feed_ok,
  to_regprocedure('public.my_event_journey()') IS NOT NULL AS jornada_cliente_ok,
  position('v_next_stage jsonb := NULL' in pg_get_functiondef('public.my_event_journey()'::regprocedure)) > 0
    AS jornada_sem_checkin_corrigida,
  to_regprocedure('public.event_fofocometro(uuid)') IS NOT NULL AS fofocometro_publico_ok,
  position('event_id' in pg_get_functiondef('public.event_fofocometro(uuid)'::regprocedure)) > 0
    AS retorno_fofocometro_completo;

SELECT
  count(*) AS publicacoes_com_posicao_invalida
FROM public.feed_posts
WHERE placement NOT IN ('top','after_promotions','after_current_event','after_events','bottom');

SELECT
  id,
  title,
  placement,
  is_pinned,
  status,
  starts_at
FROM public.feed_posts
ORDER BY created_at DESC
LIMIT 20;

SELECT
  g.id,
  e.name AS evento,
  g.name AS meta,
  g.current_count,
  g.target_count,
  g.status,
  g.reward_description
FROM public.collective_goals g
JOIN public.events e ON e.id = g.event_id
WHERE g.status IN ('scheduled','active','completed')
ORDER BY e.starts_at DESC, g.stage_order;
