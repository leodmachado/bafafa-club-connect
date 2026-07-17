-- Verificação Bafafá Connect V20.2

SELECT
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='experience_type'
  ) AS sessao_da_casa_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='events' AND column_name='public_visible'
  ) AS eventos_ocultaveis_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns' AND column_name='home_sort_order'
  ) AS ordem_editorial_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns' AND column_name='home_visible'
  ) AS visibilidade_no_inicio_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='campaigns' AND column_name='external_url'
  ) AS link_externo_ok,
  to_regclass('public.campaign_link_clicks') IS NOT NULL AS rastreamento_cliques_ok,
  to_regprocedure('public.my_house_session()') IS NOT NULL AS sessao_atual_rpc_ok,
  to_regprocedure('public.track_campaign_external_click(uuid,text)') IS NOT NULL AS clique_rpc_ok,
  to_regprocedure('public.create_my_qr_token(text,uuid)') IS NOT NULL AS ativacao_qr_ok,
  EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname='events_prevent_house_session_overlap' AND NOT tgisinternal
  ) AS bloqueio_de_sessoes_sobrepostas_ok,
  position(
    'v_reward.expires_at' in pg_get_functiondef('public.create_my_qr_token(text,uuid)'::regprocedure)
  ) > 0 AS expires_at_ambiguo_corrigido,
  position(
    'experience_type = ''house_session''' in pg_get_functiondef(
      'public.checkin_with_geolocation(uuid,double precision,double precision,double precision)'::regprocedure
    )
  ) > 0 AS checkin_restrito_a_sessao_da_casa;

SELECT
  count(*) FILTER (WHERE experience_type='house_session') AS sessoes_da_casa,
  count(*) FILTER (WHERE experience_type='public_event' AND public_visible=true) AS eventos_publicos,
  count(*) FILTER (WHERE experience_type='public_event' AND public_visible=false) AS eventos_publicos_ocultos
FROM public.events;

SELECT
  count(*) FILTER (WHERE campaign_kind IN ('event','funnel') AND feed_visible=true) AS campanhas_de_evento_visiveis,
  count(*) FILTER (WHERE campaign_kind IN ('global','milestone') AND feed_visible=true) AS fofoquinhas_publicas,
  count(*) FILTER (WHERE campaign_kind IN ('global','milestone') AND feed_visible=true AND home_visible=true) AS fofoquinhas_no_inicio,
  count(*) FILTER (WHERE home_sort_order IS NOT NULL) AS fofoquinhas_com_ordem_manual,
  count(*) FILTER (WHERE redemption_mode IN ('external','both') AND external_url IS NOT NULL) AS fofoquinhas_com_link_externo
FROM public.campaigns;

SELECT
  id,
  name,
  starts_at,
  ends_at,
  status,
  checkin_enabled,
  chat_enabled,
  public_visible
FROM public.events
WHERE experience_type='house_session'
ORDER BY starts_at DESC
LIMIT 10;
