-- Relatório somente de leitura para a revisão trimestral de retenção.
-- Não exclui, altera nem anonimiza registros.

SELECT 'perfis_sem_atividade_24_meses' AS categoria, count(*)::bigint AS registros
FROM public.profiles
WHERE deleted_at IS NULL
  AND coalesce(last_seen_at, created_at) < now() - interval '24 months'

UNION ALL

SELECT 'mensagens_resenha_mais_180_dias', count(*)::bigint
FROM public.event_chat_messages
WHERE created_at < now() - interval '180 days'

UNION ALL

SELECT 'mensagens_privadas_mais_180_dias', count(*)::bigint
FROM public.private_chat_messages
WHERE created_at < now() - interval '180 days'

UNION ALL

SELECT 'eventos_seguranca_mais_180_dias', count(*)::bigint
FROM public.security_events
WHERE created_at < now() - interval '180 days'
  AND status = 'resolved'

UNION ALL

SELECT 'consentimentos_mais_5_anos', count(*)::bigint
FROM public.user_consents
WHERE created_at < now() - interval '5 years'

UNION ALL

SELECT 'auditoria_mais_5_anos', count(*)::bigint
FROM public.audit_logs
WHERE created_at < now() - interval '5 years'

ORDER BY categoria;
