-- BAFAFÁ CONNECT V20.5 — VERIFICAÇÃO DO RESET OPERACIONAL
-- Somente leitura.

WITH reset_summary AS (
  SELECT
    (SELECT count(*) FROM auth.users) AS auth_users,
    (SELECT count(*) FROM public.profiles) AS profiles,
    (SELECT count(*) FROM public.user_roles WHERE role = 'admin') AS admins,
    (SELECT count(*) FROM public.user_roles WHERE role = 'equipe') AS staff,
    (SELECT count(*) FROM public.products) AS products,
    (SELECT count(*) FROM public.venues) AS venues,
    (SELECT count(*) FROM public.events) AS events,
    (SELECT count(*) FROM public.campaigns) AS campaigns,
    (SELECT count(*) FROM public.checkins) AS checkins,
    (SELECT count(*) FROM public.user_rewards) AS rewards,
    (SELECT count(*) FROM public.reward_redemptions) AS redemptions,
    (SELECT count(*) FROM public.qr_tokens) AS qr_tokens,
    (SELECT count(*) FROM public.event_chat_messages) AS public_messages,
    (SELECT count(*) FROM public.event_chat_reports) AS public_reports,
    (SELECT count(*) FROM public.event_chat_blocks) AS chat_blocks,
    (SELECT count(*) FROM public.salve_requests) AS salves,
    (SELECT count(*) FROM public.private_chat_threads) AS private_threads,
    (SELECT count(*) FROM public.private_chat_messages) AS private_messages,
    (SELECT count(*) FROM public.private_chat_reports) AS private_reports,
    (SELECT count(*) FROM public.customer_event_sessions) AS event_sessions,
    (SELECT count(*) FROM public.event_funnel_progress) AS funnel_progress,
    (SELECT count(*) FROM public.event_funnel_rules) AS funnel_rules,
    (SELECT count(*) FROM public.funnel_stages) AS funnel_stages,
    (SELECT count(*) FROM public.sales) AS sales,
    (SELECT count(*) FROM public.sale_items) AS sale_items,
    (SELECT count(*) FROM public.collective_goals) AS collective_goals,
    (SELECT count(*) FROM public.collective_goal_contributions) AS goal_contributions,
    (SELECT count(*) FROM public.feed_posts) AS feed_posts,
    (SELECT count(*) FROM public.pilot_runs) AS pilot_runs,
    (SELECT count(*) FROM public.crm_segment_memberships) AS crm_memberships,
    (SELECT count(*) FROM public.user_badges) AS user_badges,
    (SELECT count(*) FROM public.user_titles) AS user_titles,
    (
      SELECT count(*)
      FROM public.profiles
      WHERE active_title_id IS NOT NULL
         OR first_checkin_at IS NOT NULL
         OR last_checkin_at IS NOT NULL
         OR visit_count <> 0
         OR lifetime_net_spend_cents <> 0
         OR last_purchase_at IS NOT NULL
         OR last_reward_at IS NOT NULL
         OR last_review_at IS NOT NULL
         OR current_segment <> 'bafafa_novo'
    ) AS profiles_with_operational_state
)
SELECT
  *,
  auth_users > 0
  AND profiles > 0
  AND admins >= 1
  AND events = 0
  AND campaigns = 0
  AND checkins = 0
  AND rewards = 0
  AND redemptions = 0
  AND qr_tokens = 0
  AND public_messages = 0
  AND public_reports = 0
  AND chat_blocks = 0
  AND salves = 0
  AND private_threads = 0
  AND private_messages = 0
  AND private_reports = 0
  AND event_sessions = 0
  AND funnel_progress = 0
  AND funnel_rules = 0
  AND funnel_stages = 0
  AND sales = 0
  AND sale_items = 0
  AND collective_goals = 0
  AND goal_contributions = 0
  AND feed_posts = 0
  AND pilot_runs = 0
  AND crm_memberships = 0
  AND user_badges = 0
  AND user_titles = 0
  AND profiles_with_operational_state = 0 AS verificacao_ok
FROM reset_summary;
