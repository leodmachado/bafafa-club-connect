-- BAFAFÁ CONNECT V20.0
-- Verificação sem alteração de dados.
-- Execute somente depois do BAFAFA_CRM_FUNIL_COMERCIAL_V20_SETUP.sql.

SELECT
  to_regclass('public.products') IS NOT NULL AS produtos_ok,
  to_regclass('public.product_change_history') IS NOT NULL AS historico_produtos_ok,
  to_regclass('public.campaign_change_history') IS NOT NULL AS historico_fofoquinhas_ok,
  to_regclass('public.customer_event_sessions') IS NOT NULL AS sessoes_cliente_ok,
  to_regclass('public.sales') IS NOT NULL AS vendas_ok,
  to_regclass('public.sale_items') IS NOT NULL AS itens_venda_ok,
  to_regclass('public.event_funnel_rules') IS NOT NULL AS regras_funil_ok,
  to_regclass('public.funnel_stages') IS NOT NULL AS etapas_funil_ok,
  to_regclass('public.event_funnel_progress') IS NOT NULL AS progresso_funil_ok,
  to_regclass('public.crm_segment_memberships') IS NOT NULL AS segmentos_crm_ok,
  to_regclass('public.collective_goals') IS NOT NULL AS fofocometro_ok,
  to_regclass('public.collective_goal_contributions') IS NOT NULL AS contribuicoes_fofocometro_ok,
  to_regclass('public.event_reviews') IS NOT NULL AS avaliacoes_ok,
  to_regclass('public.salve_requests') IS NOT NULL AS salves_ok,
  to_regclass('public.private_chat_threads') IS NOT NULL AS conversas_privadas_ok,
  to_regclass('public.private_chat_messages') IS NOT NULL AS mensagens_privadas_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'phone_e164'
  ) AS telefone_perfil_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'discount_type'
  ) AS desconto_real_fofoquinha_ok,
  EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_rewards' AND column_name = 'activated_at'
  ) AS ativacao_fofoquinha_ok,
  to_regprocedure('public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)') IS NOT NULL AS registrar_venda_ok,
  to_regprocedure('public.admin_change_sale_status(uuid,text,text)') IS NOT NULL AS estorno_recalculo_ok,
  to_regprocedure('public.my_event_journey()') IS NOT NULL AS jornada_cliente_ok,
  to_regprocedure('public.admin_configure_event_funnel(uuid,jsonb)') IS NOT NULL AS configurar_funil_ok,
  to_regprocedure('public.inspect_commercial_qr(text)') IS NOT NULL AS validar_qr_comercial_ok,
  to_regprocedure('public.event_fofocometro(uuid)') IS NOT NULL AS placar_publico_ok,
  to_regprocedure('public.send_salve_request(uuid,uuid,text)') IS NOT NULL AS enviar_salve_ok,
  to_regprocedure('public.respond_salve_request(uuid,boolean)') IS NOT NULL AS responder_salve_ok,
  to_regprocedure('public.send_private_message(uuid,text)') IS NOT NULL AS conversa_com_consentimento_ok;

SELECT
  count(*) AS produtos_cadastrados,
  count(*) FILTER (WHERE active) AS produtos_ativos,
  count(*) FILTER (WHERE counts_for_funnel) AS produtos_que_contam_no_funil,
  count(*) FILTER (WHERE discount_eligible) AS produtos_elegiveis_para_desconto,
  count(*) FILTER (WHERE counts_for_fofocometro) AS produtos_que_contam_no_fofocometro
FROM public.products;

SELECT
  e.name AS evento,
  r.name AS regra,
  r.active,
  count(s.id) AS etapas,
  string_agg(
    s.stage_order || ': ' || s.title || ' (' || s.trigger_type || ' ' || s.threshold_cents || ')',
    ' | ' ORDER BY s.stage_order
  ) AS configuracao
FROM public.event_funnel_rules r
LEFT JOIN public.events e ON e.id = r.event_id
LEFT JOIN public.funnel_stages s ON s.rule_id = r.id
GROUP BY e.name, r.id, r.name, r.active
ORDER BY max(r.created_at) DESC NULLS LAST;

SELECT
  status,
  count(*) AS vendas,
  coalesce(sum(gross_total_cents), 0) AS bruto_centavos,
  coalesce(sum(discount_total_cents), 0) AS desconto_centavos,
  coalesce(sum(net_total_cents), 0) AS liquido_centavos,
  coalesce(sum(margin_total_cents), 0) AS margem_centavos
FROM public.sales
GROUP BY status
ORDER BY status;

SELECT
  segment_key,
  count(*) AS clientes_ativos
FROM public.crm_segment_memberships
WHERE active
GROUP BY segment_key
ORDER BY clientes_ativos DESC, segment_key;

SELECT
  e.name AS evento,
  g.name AS meta,
  g.stage_order,
  g.current_count,
  g.target_count,
  g.status,
  g.reward_description
FROM public.collective_goals g
JOIN public.events e ON e.id = g.event_id
ORDER BY e.starts_at DESC, g.stage_order;

SELECT
  count(*) AS avaliacoes,
  round(avg(rating)::numeric, 2) AS nota_media,
  count(*) FILTER (WHERE would_return IS TRUE) AS disseram_que_voltariam
FROM public.event_reviews;
