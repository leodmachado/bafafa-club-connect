BEGIN;

-- BAFAFÁ V14 — desbloqueio, perfis clicáveis na Resenha e perfil público social.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_checkin_count boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_event_preferences boolean NOT NULL DEFAULT true;

-- Lista segura de pessoas bloqueadas pelo usuário autenticado.
CREATE OR REPLACE FUNCTION public.my_event_chat_blocks()
RETURNS TABLE(
  blocked_user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  is_public boolean,
  blocked_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.blocked_user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    p.is_public,
    b.created_at
  FROM public.event_chat_blocks b
  JOIN public.profiles p ON p.id = b.blocked_user_id
  WHERE b.user_id = auth.uid()
    AND p.deleted_at IS NULL
  ORDER BY b.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.my_event_chat_blocks() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_chat_blocks() TO authenticated, service_role;

-- Perfil público com dados sociais agregados e controles de privacidade.
CREATE OR REPLACE FUNCTION public.get_public_profile(_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_title text;
  v_badges jsonb;
  v_badge_count integer := 0;
  v_checkin_count integer;
  v_event_preferences jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
    AND is_public = true
    AND deleted_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT name INTO v_title
  FROM public.title_definitions
  WHERE id = v_profile.active_title_id AND is_active;

  SELECT
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'slug', b.slug,
          'name', b.name,
          'description', b.description,
          'icon', b.icon
        )
        ORDER BY
          CASE WHEN b.slug = 'bafafa-fundador' THEN 0 ELSE 1 END,
          b.sort_order,
          ub.awarded_at
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  INTO v_badges, v_badge_count
  FROM public.user_badges ub
  JOIN public.badge_definitions b ON b.id = ub.badge_id
  WHERE ub.user_id = v_profile.id
    AND ub.is_hidden = false
    AND b.is_active = true;

  IF v_profile.show_checkin_count THEN
    SELECT count(*)::integer INTO v_checkin_count
    FROM public.checkins c
    WHERE c.user_id = v_profile.id;
  ELSE
    v_checkin_count := NULL;
  END IF;

  IF v_profile.show_event_preferences THEN
    SELECT coalesce(to_jsonb(up.event_categories), '[]'::jsonb)
    INTO v_event_preferences
    FROM public.user_preferences up
    WHERE up.user_id = v_profile.id;

    v_event_preferences := coalesce(v_event_preferences, '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'bio', v_profile.bio,
    'city', CASE WHEN v_profile.show_city THEN v_profile.city ELSE NULL END,
    'member_since', v_profile.member_since,
    'active_title', v_title,
    'badges', v_badges,
    'badge_count', v_badge_count,
    'checkin_count', v_checkin_count,
    'event_preferences', v_event_preferences
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated, service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
