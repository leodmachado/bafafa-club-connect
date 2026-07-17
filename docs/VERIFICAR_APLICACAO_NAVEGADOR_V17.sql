-- Verificação da V17 — execute após o setup.

select
  id,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id in ('avatars', 'event-images')
order by id;

select
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname in (
    'users_upload_own_avatar',
    'users_update_own_avatar',
    'admins_upload_event_images',
    'admins_update_event_images'
  )
order by policyname;

select
  tgrelid::regclass::text as tabela,
  tgname as trigger,
  tgenabled as ativo
from pg_trigger
where not tgisinternal
  and tgname in (
    'protect_profile_avatar_url_trigger',
    'protect_event_image_url_trigger',
    'protect_new_profile_media_trigger',
    'protect_new_event_media_trigger'
  )
order by tabela, trigger;

select
  to_regprocedure('public.protect_profile_avatar_url()') is not null as protege_avatar,
  to_regprocedure('public.protect_event_image_url()') is not null as protege_evento,
  to_regprocedure('public.protect_new_media_urls()') is not null as protege_novos_registros;
