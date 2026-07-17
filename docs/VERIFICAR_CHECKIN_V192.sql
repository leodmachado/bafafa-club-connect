-- BAFAFÁ V19.2 — verificação rápida
SELECT
  column_default AS events_accuracy_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'events'
  AND column_name = 'max_location_accuracy_m';

SELECT
  count(*) FILTER (WHERE geolocation_checkin_enabled) AS eventos_com_geo,
  count(*) FILTER (
    WHERE geolocation_checkin_enabled
      AND max_location_accuracy_m >= 250
  ) AS eventos_com_tolerancia_v192
FROM public.events;

SELECT
  to_regprocedure(
    'public.checkin_with_geolocation(uuid,double precision,double precision,double precision)'
  ) IS NOT NULL AS funcao_geolocalizacao_ok,
  has_function_privilege(
    'authenticated',
    'public.checkin_with_geolocation(uuid,double precision,double precision,double precision)',
    'EXECUTE'
  ) AS permissao_authenticated_ok;
