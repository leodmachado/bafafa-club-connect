BEGIN;
-- BAFAFÁ v9 — Bloco 1
-- Mantém a Resenha disponível em modo somente leitura por 48h após o encerramento.

CREATE OR REPLACE FUNCTION public.can_read_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
  v_read_until timestamptz;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(_user_id, 'admin')
     OR public.has_role(_user_id, 'moderador')
     OR public.has_role(_user_id, 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c WHERE c.user_id = _user_id AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  v_read_until := v_close + interval '48 hours';

  RETURN now() BETWEEN v_open AND v_read_until;
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_event_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_event_chat(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_event_chat_rooms()
RETURNS TABLE(
  event_id uuid,
  event_name text,
  starts_at timestamptz,
  ends_at timestamptz,
  image_url text,
  category text,
  chat_closes_at timestamptz,
  message_count bigint,
  last_message_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.name,
    e.starts_at,
    e.ends_at,
    e.image_url,
    e.category,
    coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours'),
    count(m.id) FILTER (WHERE m.status = 'visible'),
    max(m.created_at) FILTER (WHERE m.status = 'visible')
  FROM public.events e
  LEFT JOIN public.event_chat_messages m ON m.event_id = e.id
  WHERE public.can_read_event_chat(auth.uid(), e.id)
  GROUP BY e.id
  ORDER BY e.starts_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.my_event_chat_rooms() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_chat_rooms() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_event_chat_feed(_event_id uuid, _limit integer DEFAULT 80)
RETURNS TABLE(
  message_id uuid,
  event_id uuid,
  author_id uuid,
  body text,
  reply_to uuid,
  created_at timestamptz,
  author_name text,
  author_username text,
  author_avatar_url text,
  author_title text,
  author_badges jsonb,
  is_mine boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer := greatest(1, least(coalesce(_limit, 80), 150));
BEGIN
  IF NOT public.can_read_event_chat(v_user, _event_id) THEN
    RAISE EXCEPTION 'Faça check-in neste evento para entrar na Resenha.';
  END IF;

  RETURN QUERY
  SELECT q.id, q.event_id, q.user_id, q.body, q.reply_to, q.created_at,
         coalesce(p.display_name, 'Bafafã'), p.username, p.avatar_url,
         td.name,
         coalesce((
           SELECT jsonb_agg(jsonb_build_object(
             'slug', bd.slug,
             'name', bd.name,
             'description', bd.description,
             'icon', bd.icon
           ) ORDER BY CASE WHEN bd.slug = 'bafafa-fundador' THEN 0 ELSE 1 END, bd.sort_order)
           FROM public.user_badges ub
           JOIN public.badge_definitions bd ON bd.id = ub.badge_id
           WHERE ub.user_id = q.user_id AND ub.is_hidden = false AND bd.is_active = true
         ), '[]'::jsonb),
         q.user_id = v_user
  FROM (
    SELECT m.*
    FROM public.event_chat_messages m
    WHERE m.event_id = _event_id
      AND m.status = 'visible'
      AND NOT EXISTS (
        SELECT 1 FROM public.event_chat_blocks b
        WHERE (b.user_id = v_user AND b.blocked_user_id = m.user_id)
           OR (b.user_id = m.user_id AND b.blocked_user_id = v_user)
      )
    ORDER BY m.created_at DESC
    LIMIT v_limit
  ) q
  JOIN public.profiles p ON p.id = q.user_id
  LEFT JOIN public.title_definitions td ON td.id = p.active_title_id AND td.is_active
  ORDER BY q.created_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_event_chat_feed(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_chat_feed(uuid, integer) TO authenticated, service_role;
COMMIT;
