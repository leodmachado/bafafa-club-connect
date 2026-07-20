-- BAFAFÁ CONNECT V20.5 — RESET OPERACIONAL PARA O PILOTO
-- ATENÇÃO: apaga conteúdo e histórico operacional de teste.
-- PRESERVA: auth.users, profiles, user_roles, preferências, consentimentos,
-- produtos, locais, definições de selos/títulos, planos, configurações,
-- controles e histórico de segurança.
--
-- Antes de executar:
-- 1. faça backup do Supabase;
-- 2. execute BAFAFA_RESET_OPERACIONAL_PILOTO_V205_PREVIEW.sql;
-- 3. altere a confirmação abaixo exatamente para APAGAR_DADOS_DE_TESTE;
-- 4. execute este arquivo inteiro;
-- 5. execute BAFAFA_RESET_OPERACIONAL_PILOTO_V205_VERIFICAR.sql.

BEGIN;

DO $$
DECLARE
  v_confirmacao text := 'DIGITE_A_CONFIRMACAO_AQUI';
BEGIN
  IF v_confirmacao <> 'APAGAR_DADOS_DE_TESTE' THEN
    RAISE EXCEPTION
      'Reset cancelado. Altere v_confirmacao para APAGAR_DADOS_DE_TESTE somente depois do backup e da prévia.';
  END IF;
END;
$$;

CREATE TEMP TABLE v205_preserved_counts (
  auth_users bigint,
  profiles bigint,
  roles bigint,
  admins bigint,
  staff bigint,
  products bigint,
  venues bigint,
  badge_definitions bigint,
  title_definitions bigint
) ON COMMIT DROP;

INSERT INTO v205_preserved_counts
SELECT
  (SELECT count(*) FROM auth.users),
  (SELECT count(*) FROM public.profiles),
  (SELECT count(*) FROM public.user_roles),
  (SELECT count(*) FROM public.user_roles WHERE role = 'admin'),
  (SELECT count(*) FROM public.user_roles WHERE role = 'equipe'),
  (SELECT count(*) FROM public.products),
  (SELECT count(*) FROM public.venues),
  (SELECT count(*) FROM public.badge_definitions),
  (SELECT count(*) FROM public.title_definitions);

-- Dependências comerciais e de recompensa.
DELETE FROM public.collective_goal_contributions;
DELETE FROM public.reward_redemptions;
DELETE FROM public.sale_items;
DELETE FROM public.sales;
DELETE FROM public.event_funnel_progress;
DELETE FROM public.customer_event_sessions;
DELETE FROM public.user_rewards;
DELETE FROM public.qr_tokens;

-- Conversas, denúncias e interações sociais.
DELETE FROM public.private_chat_reports;
DELETE FROM public.private_chat_messages;
DELETE FROM public.private_chat_threads;
DELETE FROM public.salve_requests;
DELETE FROM public.event_chat_reports;
DELETE FROM public.event_chat_messages;
DELETE FROM public.event_chat_blocks;
DELETE FROM public.event_reviews;

-- Funis, metas, pilotos e conteúdo editorial.
DELETE FROM public.funnel_stages;
DELETE FROM public.event_funnel_rules;
DELETE FROM public.collective_goals;
DELETE FROM public.pilot_runs;
DELETE FROM public.feed_posts;

-- Histórico de visita e campanhas.
DELETE FROM public.checkins;
DELETE FROM public.campaigns;
DELETE FROM public.events;

-- Progresso derivado do usuário. As definições são preservadas.
DELETE FROM public.crm_segment_memberships;
DELETE FROM public.user_badges;
DELETE FROM public.user_titles;

UPDATE public.profiles
SET active_title_id = NULL,
    first_checkin_at = NULL,
    last_checkin_at = NULL,
    visit_count = 0,
    lifetime_net_spend_cents = 0,
    last_purchase_at = NULL,
    last_reward_at = NULL,
    last_review_at = NULL,
    current_segment = 'bafafa_novo',
    updated_at = now();

-- Verificações de preservação antes do COMMIT.
DO $$
DECLARE
  v_before v205_preserved_counts%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM v205_preserved_counts;

  IF (SELECT count(*) FROM auth.users) <> v_before.auth_users
     OR (SELECT count(*) FROM public.profiles) <> v_before.profiles
     OR (SELECT count(*) FROM public.user_roles) <> v_before.roles
     OR (SELECT count(*) FROM public.user_roles WHERE role = 'admin') <> v_before.admins
     OR (SELECT count(*) FROM public.user_roles WHERE role = 'equipe') <> v_before.staff
     OR (SELECT count(*) FROM public.products) <> v_before.products
     OR (SELECT count(*) FROM public.venues) <> v_before.venues
     OR (SELECT count(*) FROM public.badge_definitions) <> v_before.badge_definitions
     OR (SELECT count(*) FROM public.title_definitions) <> v_before.title_definitions THEN
    RAISE EXCEPTION 'Reset cancelado: algum dado que deveria ser preservado foi alterado.';
  END IF;

  IF (SELECT count(*) FROM public.user_roles WHERE role = 'admin') < 1 THEN
    RAISE EXCEPTION 'Reset cancelado: nenhuma conta administradora seria preservada.';
  END IF;
END;
$$;

SELECT
  (SELECT count(*) FROM auth.users) AS usuarios_preservados,
  (SELECT count(*) FROM public.user_roles WHERE role = 'admin') AS admins_preservados,
  (SELECT count(*) FROM public.user_roles WHERE role = 'equipe') AS equipe_preservada,
  (SELECT count(*) FROM public.events) AS eventos_restantes,
  (SELECT count(*) FROM public.campaigns) AS campanhas_restantes,
  (SELECT count(*) FROM public.checkins) AS checkins_restantes,
  (SELECT count(*) FROM public.user_rewards) AS recompensas_restantes,
  (SELECT count(*) FROM public.event_chat_messages) AS mensagens_restantes;

COMMIT;
