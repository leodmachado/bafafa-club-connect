-- V17 — segurança da aplicação, navegador e uploads.
BEGIN;

-- Arquivos pequenos, formatos estritamente necessários e sem GIF/SVG.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('avatars', 'avatars', true, 1572864, ARRAY['image/webp']),
  ('event-images', 'event-images', true, 3145728, ARRAY['image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- O app gera nomes aleatórios e converte toda imagem nova para WEBP.
DROP POLICY IF EXISTS "users_upload_own_avatar" ON storage.objects;
CREATE POLICY "users_upload_own_avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
);

DROP POLICY IF EXISTS "users_update_own_avatar" ON storage.objects;
CREATE POLICY "users_update_own_avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
)
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
);

DROP POLICY IF EXISTS "admins_upload_event_images" ON storage.objects;
CREATE POLICY "admins_upload_event_images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = 'events'
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
  AND public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "admins_update_event_images" ON storage.objects;
CREATE POLICY "admins_update_event_images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = 'events'
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
  AND public.has_role(auth.uid(), 'admin')
)
WITH CHECK (
  bucket_id = 'event-images'
  AND (storage.foldername(name))[1] = 'events'
  AND array_length(storage.foldername(name), 1) = 1
  AND lower(storage.extension(name)) = 'webp'
  AND public.has_role(auth.uid(), 'admin')
);

-- Impede que chamadas diretas à API gravem URLs externas no perfil ou no evento.
-- URLs antigas continuam válidas; a regra é aplicada somente quando o campo muda.
CREATE OR REPLACE FUNCTION public.protect_profile_avatar_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.avatar_url IS DISTINCT FROM OLD.avatar_url
     AND NEW.avatar_url IS NOT NULL
     AND NEW.avatar_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpe?g|png)$'
  THEN
    RAISE EXCEPTION 'Imagem de perfil inválida.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_avatar_url_trigger ON public.profiles;
CREATE TRIGGER protect_profile_avatar_url_trigger
BEFORE UPDATE OF avatar_url ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_avatar_url();

CREATE OR REPLACE FUNCTION public.protect_event_image_url()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.image_url IS DISTINCT FROM OLD.image_url
     AND NEW.image_url IS NOT NULL
     AND NEW.image_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/event-images/events/[0-9a-f-]{36}\.(webp|jpe?g|png)$'
  THEN
    RAISE EXCEPTION 'Imagem de evento inválida.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_event_image_url_trigger ON public.events;
CREATE TRIGGER protect_event_image_url_trigger
BEFORE UPDATE OF image_url ON public.events
FOR EACH ROW EXECUTE FUNCTION public.protect_event_image_url();

-- Novos registros também precisam obedecer ao padrão seguro.
CREATE OR REPLACE FUNCTION public.protect_new_media_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'profiles' AND NEW.avatar_url IS NOT NULL
     AND NEW.avatar_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpe?g|png)$'
  THEN
    RAISE EXCEPTION 'Imagem de perfil inválida.';
  END IF;
  IF TG_TABLE_NAME = 'events' AND NEW.image_url IS NOT NULL
     AND NEW.image_url !~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/event-images/events/[0-9a-f-]{36}\.(webp|jpe?g|png)$'
  THEN
    RAISE EXCEPTION 'Imagem de evento inválida.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_new_profile_media_trigger ON public.profiles;
CREATE TRIGGER protect_new_profile_media_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_new_media_urls();

DROP TRIGGER IF EXISTS protect_new_event_media_trigger ON public.events;
CREATE TRIGGER protect_new_event_media_trigger
BEFORE INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION public.protect_new_media_urls();

REVOKE ALL ON FUNCTION public.protect_profile_avatar_url() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_event_image_url() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_new_media_urls() FROM PUBLIC, anon, authenticated;

COMMIT;
