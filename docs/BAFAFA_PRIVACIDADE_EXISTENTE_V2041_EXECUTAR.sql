-- BAFAFÁ CONNECT V20.4.1
-- Fecha os perfis legados que herdaram visibilidade pública antes da V20.4.
--
-- Impacto: banco/privacidade. Nenhum dado de perfil é apagado. As preferências
-- anteriores são registradas em audit_logs antes da alteração. Cada pessoa pode
-- publicar novamente o perfil e os campos desejados pelo próprio aplicativo.
--
-- Risco: um perfil que tenha sido publicado manualmente antes de existir um
-- consentimento específico também será fechado. A alternativa de preservar os
-- dez perfis manteria exposição sem prova de escolha explícita.
--
-- Rollback orientado: restaurar somente os registros capturados pela ação
-- legacy_profile_privacy_snapshot_v2041 em audit_logs. Não executar rollback
-- depois que usuários já tiverem feito novas escolhas no Perfil.

BEGIN;

DO $$
DECLARE
  v_changed integer := 0;
BEGIN
  IF to_regclass('public.profiles') IS NULL
     OR to_regclass('public.user_consents') IS NULL
     OR to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION 'Estrutura do Bafafá Connect não encontrada. Confirme o projeto Supabase.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.audit_logs
    WHERE action = 'legacy_profile_privacy_completed_v2041'
      AND entity = 'system'
      AND entity_id = 'v2041'
  ) THEN
    RAISE NOTICE 'A conciliação de privacidade V20.4.1 já foi executada.';
    RETURN;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  SELECT
    NULL,
    'legacy_profile_privacy_snapshot_v2041',
    'profile',
    p.id::text,
    jsonb_build_object(
      'is_public', p.is_public,
      'show_birth_month', p.show_birth_month,
      'show_city', p.show_city,
      'show_checkin_count', p.show_checkin_count,
      'show_event_preferences', p.show_event_preferences,
      'show_gender', p.show_gender,
      'reason', 'legacy_defaults_without_explicit_public_profile_consent'
    )
  FROM public.profiles p
  WHERE p.is_public
     OR p.show_birth_month
     OR p.show_city
     OR p.show_checkin_count
     OR p.show_event_preferences
     OR p.show_gender;

  UPDATE public.profiles
  SET is_public = false,
      show_birth_month = false,
      show_city = false,
      show_checkin_count = false,
      show_event_preferences = false,
      show_gender = false,
      updated_at = now()
  WHERE is_public
     OR show_birth_month
     OR show_city
     OR show_checkin_count
     OR show_event_preferences
     OR show_gender;

  GET DIAGNOSTICS v_changed = ROW_COUNT;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (
    NULL,
    'legacy_profile_privacy_completed_v2041',
    'system',
    'v2041',
    jsonb_build_object(
      'profiles_closed', v_changed,
      'consent_reference', 'public_profile_explicit_choice_not_available_in_v1.0',
      'executed_at', now()
    )
  );
END;
$$;

COMMIT;
