select
  to_regclass('public.feed_posts') is not null as feed_posts_ok,
  to_regprocedure('public.my_fofoquinhas()') is not null as fofoquinhas_ok,
  to_regprocedure('public.checkin_with_geolocation(uuid,double precision,double precision,double precision)') is not null as geolocalizacao_ok,
  to_regprocedure('public.grant_event_campaign_rewards(uuid,uuid,uuid)') is not null as recompensa_operacional_ok,
  to_regprocedure('public.validate_checkin_qr(text,uuid)') is not null as validacao_qr_atualizada_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='profiles' and column_name='gender_identity'
  ) as genero_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='events' and column_name='geolocation_checkin_enabled'
  ) as evento_geo_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='campaigns' and column_name='campaign_kind'
  ) as missoes_ok,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='campaigns' and column_name='requires_staff_validation'
  ) as validacao_operacional_ok,
  not has_function_privilege('authenticated', 'public.grant_event_campaign_rewards(uuid,uuid,uuid)', 'EXECUTE')
    as cliente_nao_concede_recompensa_ok,
  has_function_privilege('authenticated', 'public.checkin_with_geolocation(uuid,double precision,double precision,double precision)', 'EXECUTE')
    as cliente_pode_checkin_geo_ok;
