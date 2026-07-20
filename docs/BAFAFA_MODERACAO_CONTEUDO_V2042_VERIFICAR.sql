-- BAFAFÁ CONNECT V20.4.2 — VERIFICAÇÃO SOMENTE LEITURA
-- Execute depois da migration content_moderation_v2042.

WITH moderation_summary AS (
  SELECT
    (SELECT count(*) FROM private.content_moderation_terms WHERE active) AS active_terms,
    (SELECT count(DISTINCT category) FROM private.content_moderation_terms WHERE active) AS categories,
    (
      SELECT count(*)
      FROM pg_trigger
      WHERE NOT tgisinternal
        AND tgname IN (
          'profiles_moderate_insert_v2042',
          'profiles_moderate_update_v2042',
          'event_chat_moderate_content_v2042',
          'private_chat_moderate_content_v2042',
          'salve_moderate_content_v2042'
        )
    ) AS moderation_triggers,
    (
      SELECT count(*)
      FROM public.profiles
      WHERE NOT (public.check_content_allowed(display_name, 'display_name')->>'allowed')::boolean
         OR (
           username IS NOT NULL
           AND NOT (public.check_content_allowed(username, 'username')->>'allowed')::boolean
         )
    ) AS existing_profile_matches,
    (
      SELECT count(*)
      FROM public.event_chat_messages
      WHERE status = 'visible'
        AND deleted_at IS NULL
        AND NOT (public.check_content_allowed(body, 'chat')->>'allowed')::boolean
    ) AS existing_public_message_matches,
    (
      SELECT count(*)
      FROM public.private_chat_messages
      WHERE deleted_at IS NULL
        AND NOT (public.check_content_allowed(body, 'chat')->>'allowed')::boolean
    ) AS existing_private_message_matches,
    (
      SELECT count(*)
      FROM public.salve_requests
      WHERE opener IS NOT NULL
        AND NOT (public.check_content_allowed(opener, 'chat')->>'allowed')::boolean
    ) AS existing_salve_matches,
    (public.check_content_allowed('Pagode na praça', 'chat')->>'allowed')::boolean
      AS legitimate_content_allowed,
    NOT (public.check_content_allowed('p.u.t.a', 'chat')->>'allowed')::boolean
      AS separated_term_blocked,
    NOT (public.check_content_allowed('v14d0', 'username')->>'allowed')::boolean
      AS leetspeak_blocked,
    (public.check_content_allowed('computador', 'username')->>'allowed')::boolean
      AS false_positive_avoided,
    has_function_privilege(
      'anon',
      'public.check_content_allowed(text,text)',
      'EXECUTE'
    ) AS signup_check_available,
    has_function_privilege(
      'authenticated',
      'public.check_content_allowed(text,text)',
      'EXECUTE'
    ) AS authenticated_check_available,
    NOT has_schema_privilege('anon', 'private', 'USAGE') AS private_schema_closed_to_anon,
    NOT has_schema_privilege('authenticated', 'private', 'USAGE')
      AS private_schema_closed_to_authenticated,
    NOT has_table_privilege(
      'anon',
      'private.content_moderation_terms',
      'SELECT'
    ) AS terms_closed_to_anon,
    NOT has_table_privilege(
      'authenticated',
      'private.content_moderation_terms',
      'SELECT'
    ) AS terms_closed_to_authenticated
)
SELECT
  *,
  active_terms >= 40
  AND categories = 5
  AND moderation_triggers = 5
  AND existing_profile_matches = 0
  AND existing_public_message_matches = 0
  AND existing_private_message_matches = 0
  AND existing_salve_matches = 0
  AND legitimate_content_allowed
  AND separated_term_blocked
  AND leetspeak_blocked
  AND false_positive_avoided
  AND signup_check_available
  AND authenticated_check_available
  AND private_schema_closed_to_anon
  AND private_schema_closed_to_authenticated
  AND terms_closed_to_anon
  AND terms_closed_to_authenticated AS verificacao_ok
FROM moderation_summary;
