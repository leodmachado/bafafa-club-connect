-- Execute somente no projeto xijjohgokwfkqfkkhsyn (bafafa-club-connect).
-- Resultado esperado imediato: verificacao_ok = true.

WITH migration_record AS (
  SELECT details
  FROM public.audit_logs
  WHERE action = 'legacy_profile_privacy_completed_v2041'
    AND entity = 'system'
    AND entity_id = 'v2041'
  ORDER BY created_at DESC
  LIMIT 1
),
snapshot_count AS (
  SELECT count(*)::integer AS total
  FROM public.audit_logs
  WHERE action = 'legacy_profile_privacy_snapshot_v2041'
    AND entity = 'profile'
),
current_exposure AS (
  SELECT count(*)::integer AS total
  FROM public.profiles
  WHERE is_public
     OR show_birth_month
     OR show_city
     OR show_checkin_count
     OR show_event_preferences
     OR show_gender
)
SELECT
  EXISTS (SELECT 1 FROM migration_record) AS migration_registered,
  coalesce((SELECT (details ->> 'profiles_closed')::integer FROM migration_record), 0)
    AS profiles_closed,
  (SELECT total FROM snapshot_count) AS snapshots_preserved,
  (SELECT total FROM current_exposure) AS profiles_currently_opted_in,
  EXISTS (SELECT 1 FROM migration_record)
    AND coalesce((SELECT (details ->> 'profiles_closed')::integer FROM migration_record), 0)
      = (SELECT total FROM snapshot_count)
    AND (SELECT total FROM current_exposure) = 0
    AS verificacao_ok;
