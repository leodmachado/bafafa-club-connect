-- BAFAFÁ CONNECT V20.5 — PRÉVIA DO RESET OPERACIONAL
-- Somente leitura. Mostra o que seria apagado e o que seria preservado.

WITH operational_counts AS (
  SELECT 'eventos' AS item, count(*)::bigint AS total FROM public.events
  UNION ALL SELECT 'campanhas_fofoquinhas', count(*) FROM public.campaigns
  UNION ALL SELECT 'checkins', count(*) FROM public.checkins
  UNION ALL SELECT 'recompensas', count(*) FROM public.user_rewards
  UNION ALL SELECT 'resgates', count(*) FROM public.reward_redemptions
  UNION ALL SELECT 'qr_temporarios', count(*) FROM public.qr_tokens
  UNION ALL SELECT 'mensagens_resenha', count(*) FROM public.event_chat_messages
  UNION ALL SELECT 'denuncias_resenha', count(*) FROM public.event_chat_reports
  UNION ALL SELECT 'bloqueios_chat', count(*) FROM public.event_chat_blocks
  UNION ALL SELECT 'salves', count(*) FROM public.salve_requests
  UNION ALL SELECT 'conversas_privadas', count(*) FROM public.private_chat_threads
  UNION ALL SELECT 'mensagens_privadas', count(*) FROM public.private_chat_messages
  UNION ALL SELECT 'denuncias_privadas', count(*) FROM public.private_chat_reports
  UNION ALL SELECT 'sessoes_cliente_evento', count(*) FROM public.customer_event_sessions
  UNION ALL SELECT 'progresso_funil', count(*) FROM public.event_funnel_progress
  UNION ALL SELECT 'regras_funil', count(*) FROM public.event_funnel_rules
  UNION ALL SELECT 'etapas_funil', count(*) FROM public.funnel_stages
  UNION ALL SELECT 'vendas', count(*) FROM public.sales
  UNION ALL SELECT 'itens_venda', count(*) FROM public.sale_items
  UNION ALL SELECT 'metas_coletivas', count(*) FROM public.collective_goals
  UNION ALL SELECT 'contribuicoes_meta', count(*) FROM public.collective_goal_contributions
  UNION ALL SELECT 'posts_feed', count(*) FROM public.feed_posts
  UNION ALL SELECT 'execucoes_piloto', count(*) FROM public.pilot_runs
  UNION ALL SELECT 'segmentos_crm', count(*) FROM public.crm_segment_memberships
  UNION ALL SELECT 'selos_concedidos', count(*) FROM public.user_badges
  UNION ALL SELECT 'titulos_concedidos', count(*) FROM public.user_titles
), preserved_counts AS (
  SELECT 'usuarios_auth_preservados' AS item, count(*)::bigint AS total FROM auth.users
  UNION ALL SELECT 'perfis_preservados', count(*) FROM public.profiles
  UNION ALL SELECT 'papeis_preservados', count(*) FROM public.user_roles
  UNION ALL SELECT 'administradores_preservados', count(*) FROM public.user_roles WHERE role = 'admin'
  UNION ALL SELECT 'equipe_preservada', count(*) FROM public.user_roles WHERE role = 'equipe'
  UNION ALL SELECT 'produtos_preservados', count(*) FROM public.products
  UNION ALL SELECT 'locais_preservados', count(*) FROM public.venues
  UNION ALL SELECT 'definicoes_selos_preservadas', count(*) FROM public.badge_definitions
  UNION ALL SELECT 'definicoes_titulos_preservadas', count(*) FROM public.title_definitions
  UNION ALL SELECT 'configuracoes_preservadas', count(*) FROM public.app_settings
  UNION ALL SELECT 'controles_seguranca_preservados', count(*) FROM public.security_controls
)
SELECT 'APAGAR' AS acao, item, total
FROM operational_counts
UNION ALL
SELECT 'PRESERVAR' AS acao, item, total
FROM preserved_counts
ORDER BY acao, item;
