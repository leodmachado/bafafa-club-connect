select
  to_regclass('public.venues') is not null as venues_ok,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'venue_id'
  ) as event_venue_id_ok,
  to_regprocedure('public.tg_apply_event_venue_v191()') is not null as venue_trigger_function_ok,
  to_regprocedure('public.duplicate_event_with_campaigns(uuid)') is not null as duplicate_event_ok;

select
  count(*) filter (where campaign_kind = 'global' and trigger_target <> 1) as globais_meta_invalida,
  count(*) filter (where campaign_kind = 'global' and trigger_type <> 'none') as globais_gatilho_invalido,
  count(*) filter (where campaign_kind = 'global' and event_id is not null) as globais_com_evento;
