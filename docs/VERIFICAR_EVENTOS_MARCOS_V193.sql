-- Bafafá Connect V19.3.1 — verificação após executar a correção

SELECT
  to_regprocedure('public.sync_event_statuses()') IS NOT NULL AS sincronizacao_eventos_ok,
  to_regprocedure('public.event_status_from_schedule(text,timestamptz,timestamptz,timestamptz)') IS NOT NULL AS regra_status_ok,
  to_regprocedure('public.refresh_user_milestone_rewards(uuid)') IS NOT NULL AS marcos_ok,
  position(
    'ON CONFLICT (user_id, campaign_id)'
    IN pg_get_functiondef(to_regprocedure('public.refresh_user_milestone_rewards(uuid)'))
  ) = 0 AS conflito_corrigido;

SELECT
  tgname AS gatilho,
  tgrelid::regclass AS tabela,
  tgenabled AS ativo
FROM pg_trigger
WHERE NOT tgisinternal
  AND tgname IN ('events_auto_status_v193', 'checkins_refresh_milestones_v193')
ORDER BY tgname;

SELECT public.sync_event_statuses() AS eventos_atualizados_agora;

SELECT
  id,
  name,
  starts_at,
  ends_at,
  status,
  public.event_status_from_schedule(status, starts_at, ends_at, now()) AS status_esperado
FROM public.events
ORDER BY starts_at DESC
LIMIT 30;

SELECT
  c.id,
  c.name,
  c.trigger_type,
  c.trigger_target,
  c.per_user_limit,
  c.requires_staff_validation,
  c.requires_min_profile,
  c.status,
  count(ur.id) FILTER (WHERE ur.status <> 'revoked') AS recompensas_concedidas
FROM public.campaigns c
LEFT JOIN public.user_rewards ur ON ur.campaign_id = c.id
WHERE c.campaign_kind = 'milestone'
GROUP BY c.id, c.name, c.trigger_type, c.trigger_target, c.per_user_limit,
         c.requires_staff_validation, c.requires_min_profile, c.status
ORDER BY c.created_at DESC;
