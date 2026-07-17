BEGIN;

-- BAFAFÁ — correção pontual do cálculo de conclusão do perfil
-- Cria/recria as funções exigidas pela Home e atualiza a permissão do usuário autenticado.

CREATE OR REPLACE FUNCTION public.profile_completion_details(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.profiles%ROWTYPE;
  prefs public.user_preferences%ROWTYPE;
  v_total integer := 0;
  v_items jsonb := '[]'::jsonb;
  v_complete boolean;
BEGIN
  SELECT * INTO p
  FROM public.profiles
  WHERE id = _user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'percentage', 0,
      'items', '[]'::jsonb,
      'next_key', NULL
    );
  END IF;

  SELECT * INTO prefs
  FROM public.user_preferences
  WHERE user_id = _user_id;

  v_complete := coalesce(trim(p.display_name), '') <> '' AND p.birth_date IS NOT NULL;
  IF v_complete THEN v_total := v_total + 20; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','identity','label','Nome e nascimento','weight',20,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.city), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','city','label','Cidade','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.neighborhood), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','neighborhood','label','Bairro','weight',10,'complete',v_complete
  ));

  v_complete := prefs.event_categories IS NOT NULL
    AND coalesce(array_length(prefs.event_categories, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 15; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','events','label','Preferências de eventos','weight',15,'complete',v_complete
  ));

  v_complete := prefs.drink_preferences IS NOT NULL
    AND coalesce(array_length(prefs.drink_preferences, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','drinks','label','Preferências de bebidas','weight',10,'complete',v_complete
  ));

  v_complete := prefs.food_preferences IS NOT NULL
    AND coalesce(array_length(prefs.food_preferences, 1), 0) > 0;
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','foods','label','Preferências de comidas','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.how_found_us), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','origin','label','Como conheceu o Bafafá','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.avatar_url), '') <> '';
  IF v_complete THEN v_total := v_total + 10; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','avatar','label','Foto do perfil','weight',10,'complete',v_complete
  ));

  v_complete := coalesce(trim(p.username), '') <> '';
  IF v_complete THEN v_total := v_total + 5; END IF;
  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'key','username','label','Nome de usuário','weight',5,'complete',v_complete
  ));

  RETURN jsonb_build_object(
    'percentage', least(v_total, 100),
    'items', v_items,
    'next_key', (
      SELECT item->>'key'
      FROM jsonb_array_elements(v_items) item
      WHERE coalesce((item->>'complete')::boolean, false) = false
      LIMIT 1
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (public.profile_completion_details(_user_id)->>'percentage')::integer,
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.my_profile_completion_details()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.profile_completion_details(auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.my_profile_completeness()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.calculate_profile_completeness(auth.uid());
$$;

REVOKE ALL ON FUNCTION public.profile_completion_details(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.calculate_profile_completeness(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_profile_completion_details()
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_profile_completeness()
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.profile_completion_details(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_profile_completeness(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.my_profile_completion_details()
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_profile_completeness()
  TO authenticated;

COMMIT;

-- Atualiza imediatamente o cache de funções usado pela API do Supabase/PostgREST.
NOTIFY pgrst, 'reload schema';

-- Diagnóstico final: as quatro colunas devem retornar true.
SELECT
  to_regprocedure('public.profile_completion_details(uuid)') IS NOT NULL
    AS profile_details_ok,
  to_regprocedure('public.calculate_profile_completeness(uuid)') IS NOT NULL
    AS calculate_profile_ok,
  to_regprocedure('public.my_profile_completion_details()') IS NOT NULL
    AS my_profile_details_ok,
  to_regprocedure('public.my_profile_completeness()') IS NOT NULL
    AS my_profile_percentage_ok;
