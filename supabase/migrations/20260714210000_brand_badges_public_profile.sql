-- =====================================================================
-- BAFAFÁ V4 — identidade, selo Sócio Fundador e perfil público seguro
-- =====================================================================

-- O nome público segue a decisão de marca desta versão.
UPDATE public.badge_definitions
SET name = 'Sócio Fundador',
    description = 'Selo especial concedido manualmente pela administração do Bafafá.',
    icon = 'crown',
    auto_rule = 'manual',
    updated_at = now()
WHERE slug = 'bafafa-fundador';

UPDATE public.title_definitions
SET name = 'Sócio Fundador',
    description = 'Título especial concedido manualmente pela administração do Bafafá.',
    auto_rule = 'manual',
    updated_at = now()
WHERE slug = 'bafafa-fundador';

-- O painel administrativo precisa enxergar a coleção para atribuir o selo.
DROP POLICY IF EXISTS "Admins read all user badges" ON public.user_badges;
CREATE POLICY "Admins read all user badges"
ON public.user_badges FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Concede ou remove apenas selos explicitamente manuais. O cliente nunca
-- recebe permissão direta de INSERT/DELETE em user_badges.
CREATE OR REPLACE FUNCTION public.admin_set_manual_badge(
  _user_id uuid,
  _badge_slug text,
  _enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_badge_id uuid;
  v_title_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar selos manuais.';
  END IF;

  SELECT id INTO v_badge_id
  FROM public.badge_definitions
  WHERE slug = _badge_slug
    AND is_active
    AND auto_rule = 'manual';

  IF v_badge_id IS NULL THEN
    RAISE EXCEPTION 'Selo manual não encontrado.';
  END IF;

  SELECT id INTO v_title_id
  FROM public.title_definitions
  WHERE slug = _badge_slug AND is_active;

  IF _enabled THEN
    INSERT INTO public.user_badges (user_id, badge_id, awarded_by, is_featured)
    VALUES (_user_id, v_badge_id, auth.uid(), true)
    ON CONFLICT (user_id, badge_id) DO UPDATE SET
      awarded_by = EXCLUDED.awarded_by,
      is_featured = true,
      is_hidden = false;

    IF v_title_id IS NOT NULL THEN
      INSERT INTO public.user_titles (user_id, title_id)
      VALUES (_user_id, v_title_id)
      ON CONFLICT (user_id, title_id) DO NOTHING;
    END IF;
  ELSE
    DELETE FROM public.user_badges
    WHERE user_id = _user_id AND badge_id = v_badge_id;

    IF v_title_id IS NOT NULL THEN
      UPDATE public.profiles
      SET active_title_id = NULL
      WHERE id = _user_id AND active_title_id = v_title_id;

      DELETE FROM public.user_titles
      WHERE user_id = _user_id AND title_id = v_title_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN _enabled THEN 'grant_manual_badge' ELSE 'revoke_manual_badge' END,
    'user_badges',
    _user_id::text,
    jsonb_build_object('badge_slug', _badge_slug, 'enabled', _enabled)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_manual_badge(uuid, text, boolean)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_manual_badge(uuid, text, boolean)
TO authenticated, service_role;

-- Retorna somente o que pode aparecer na carteirinha pública. Telefone,
-- nascimento, bairro, preferências, check-ins e mimos ficam de fora.
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

  SELECT coalesce(
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
  ) INTO v_badges
  FROM public.user_badges ub
  JOIN public.badge_definitions b ON b.id = ub.badge_id
  WHERE ub.user_id = v_profile.id
    AND ub.is_hidden = false
    AND b.is_active = true;

  RETURN jsonb_build_object(
    'id', v_profile.id,
    'display_name', v_profile.display_name,
    'username', v_profile.username,
    'avatar_url', v_profile.avatar_url,
    'bio', v_profile.bio,
    'city', CASE WHEN v_profile.show_city THEN v_profile.city ELSE NULL END,
    'member_since', v_profile.member_since,
    'active_title', v_title,
    'badges', v_badges
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_profile(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile(text) TO anon, authenticated, service_role;
