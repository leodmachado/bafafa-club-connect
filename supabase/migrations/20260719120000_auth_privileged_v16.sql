-- ============================================================================
-- BAFAFÁ V16 — Autenticação e contas privilegiadas
-- Escopo: MFA obrigatório para admin/equipe/moderador, consentimentos seguros
-- no cadastro e funções de diagnóstico da sessão.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Papéis privilegiados exigem sessão AAL2.
-- A leitura do próprio papel continua disponível por RLS em user_roles, para
-- que a interface consiga orientar o usuário a configurar ou confirmar MFA.
-- Todas as policies e RPCs que usam has_role passam a exigir MFA de verdade.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT (
      (auth.uid() IS NOT NULL AND _user_id = auth.uid())
      OR auth.role() = 'service_role'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id AND ur.role = _role
    )
    AND (
      _role NOT IN ('admin'::public.app_role, 'moderador'::public.app_role, 'equipe'::public.app_role)
      OR auth.role() = 'service_role'
      OR coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_auth_security_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT jsonb_build_object(
    'user_id', auth.uid(),
    'aal', coalesce(auth.jwt()->>'aal', 'aal1'),
    'roles', coalesce(
      (SELECT jsonb_agg(ur.role ORDER BY ur.role::text)
       FROM public.user_roles ur
       WHERE ur.user_id = auth.uid()),
      '[]'::jsonb
    ),
    'privileged', EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('admin','moderador','equipe')
    ),
    'privileged_access_granted', (
      coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
      OR NOT EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('admin','moderador','equipe')
      )
    )
  );
$$;

REVOKE ALL ON FUNCTION public.my_auth_security_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_auth_security_status() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Cadastro funciona mesmo com confirmação de e-mail ativa.
-- Consentimentos e preferências são gravados pelo trigger protegido, sem
-- depender de uma sessão autenticada imediatamente após signUp().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_display text;
  v_username text;
  v_whatsapp text;
  v_birth date;
  v_city text;
  v_over18 boolean;
  v_marketing boolean;
  v_consent_version text;
  v_welcome_title uuid;
BEGIN
  v_display := coalesce(
    nullif(new.raw_user_meta_data->>'display_name',''),
    nullif(new.raw_user_meta_data->>'full_name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''),
    'Bafafã'
  );
  v_username := nullif(new.raw_user_meta_data->>'username','');
  v_whatsapp := coalesce(nullif(new.raw_user_meta_data->>'whatsapp',''), nullif(new.phone,''));
  v_city := nullif(new.raw_user_meta_data->>'city','');
  v_over18 := lower(coalesce(new.raw_user_meta_data->>'is_over_18', 'false')) IN ('true','1','yes','on');
  v_marketing := lower(coalesce(new.raw_user_meta_data->>'marketing_opt_in', 'false')) IN ('true','1','yes','on');
  v_consent_version := left(coalesce(nullif(new.raw_user_meta_data->>'consent_version',''), '1.0'), 32);
  BEGIN
    v_birth := (new.raw_user_meta_data->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    v_birth := null;
  END;

  INSERT INTO public.profiles (
    id, display_name, username, whatsapp, birth_date, city, is_over_18, phone_verified_at
  )
  VALUES (
    new.id,
    v_display,
    v_username,
    v_whatsapp,
    v_birth,
    v_city,
    v_over18,
    CASE WHEN new.phone_confirmed_at IS NOT NULL THEN new.phone_confirmed_at ELSE NULL END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone_verified_at = coalesce(public.profiles.phone_verified_at, excluded.phone_verified_at),
    whatsapp = coalesce(public.profiles.whatsapp, excluded.whatsapp);

  INSERT INTO public.user_preferences (user_id, marketing_opt_in)
  VALUES (new.id, v_marketing)
  ON CONFLICT (user_id) DO UPDATE SET
    marketing_opt_in = excluded.marketing_opt_in;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'gratuito')
  ON CONFLICT DO NOTHING;

  -- Os aceites obrigatórios só são registrados quando vieram explicitamente
  -- do formulário. O marketing permanece separado e pode ser falso.
  IF lower(coalesce(new.raw_user_meta_data->>'accept_terms', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES (new.id, 'termos', true, v_consent_version);
  END IF;
  IF lower(coalesce(new.raw_user_meta_data->>'accept_privacy', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES (new.id, 'privacidade', true, v_consent_version);
  END IF;
  IF lower(coalesce(new.raw_user_meta_data->>'accept_community', 'false')) IN ('true','1','yes','on') THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES (new.id, 'comunidade', true, v_consent_version);
  END IF;
  IF v_over18 THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES (new.id, 'maioridade', true, v_consent_version);
  END IF;
  INSERT INTO public.user_consents(user_id, kind, accepted, version)
  VALUES (new.id, 'marketing', v_marketing, v_consent_version);

  SELECT id INTO v_welcome_title
  FROM public.title_definitions
  WHERE slug = 'cheguei-no-bafafa' AND is_active;

  IF v_welcome_title IS NOT NULL THEN
    INSERT INTO public.user_titles (user_id, title_id)
    VALUES (new.id, v_welcome_title)
    ON CONFLICT (user_id, title_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;


-- ---------------------------------------------------------------------------
-- 3. Preferências e consentimento de marketing são alterados por uma RPC.
-- O navegador não recebe INSERT/UPDATE bruto nessas tabelas. A função limita
-- os valores, mantém o usuário fixado em auth.uid() e registra o histórico
-- do consentimento apenas quando a escolha muda.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert their own consents" ON public.user_consents;
REVOKE INSERT, UPDATE, DELETE ON public.user_consents FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_preferences FROM authenticated;
GRANT SELECT ON public.user_preferences TO authenticated;

CREATE OR REPLACE FUNCTION public.set_my_preferences(
  _event_categories text[] DEFAULT '{}',
  _drink_preferences text[] DEFAULT '{}',
  _food_preferences text[] DEFAULT '{}',
  _notify_in_app boolean DEFAULT true,
  _notify_email boolean DEFAULT false,
  _notify_whatsapp boolean DEFAULT false,
  _notify_push boolean DEFAULT false,
  _marketing_opt_in boolean DEFAULT false,
  _consent_version text DEFAULT '1.0'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_previous_marketing boolean;
  v_existed boolean := false;
  v_event_categories text[];
  v_drink_preferences text[];
  v_food_preferences text[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Autenticação obrigatória';
  END IF;

  IF cardinality(coalesce(_event_categories, '{}')) > 20
     OR cardinality(coalesce(_drink_preferences, '{}')) > 20
     OR cardinality(coalesce(_food_preferences, '{}')) > 20 THEN
    RAISE EXCEPTION 'Quantidade de preferências acima do permitido';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(
      coalesce(_event_categories, '{}')
      || coalesce(_drink_preferences, '{}')
      || coalesce(_food_preferences, '{}')
    ) AS item(value)
    WHERE length(btrim(item.value)) > 80
  ) THEN
    RAISE EXCEPTION 'Preferência acima do tamanho permitido';
  END IF;

  SELECT up.marketing_opt_in
  INTO v_previous_marketing
  FROM public.user_preferences up
  WHERE up.user_id = auth.uid();
  v_existed := FOUND;

  SELECT coalesce(array_agg(DISTINCT value ORDER BY value), '{}')
  INTO v_event_categories
  FROM (
    SELECT btrim(item.value) AS value
    FROM unnest(coalesce(_event_categories, '{}')) AS item(value)
    WHERE btrim(item.value) <> ''
  ) normalized;

  SELECT coalesce(array_agg(DISTINCT value ORDER BY value), '{}')
  INTO v_drink_preferences
  FROM (
    SELECT btrim(item.value) AS value
    FROM unnest(coalesce(_drink_preferences, '{}')) AS item(value)
    WHERE btrim(item.value) <> ''
  ) normalized;

  SELECT coalesce(array_agg(DISTINCT value ORDER BY value), '{}')
  INTO v_food_preferences
  FROM (
    SELECT btrim(item.value) AS value
    FROM unnest(coalesce(_food_preferences, '{}')) AS item(value)
    WHERE btrim(item.value) <> ''
  ) normalized;

  INSERT INTO public.user_preferences (
    user_id,
    event_categories,
    drink_preferences,
    food_preferences,
    notify_in_app,
    notify_email,
    notify_whatsapp,
    notify_push,
    marketing_opt_in
  )
  VALUES (
    auth.uid(),
    v_event_categories,
    v_drink_preferences,
    v_food_preferences,
    _notify_in_app,
    _notify_email,
    _notify_whatsapp,
    _notify_push,
    _marketing_opt_in
  )
  ON CONFLICT (user_id) DO UPDATE SET
    event_categories = excluded.event_categories,
    drink_preferences = excluded.drink_preferences,
    food_preferences = excluded.food_preferences,
    notify_in_app = excluded.notify_in_app,
    notify_email = excluded.notify_email,
    notify_whatsapp = excluded.notify_whatsapp,
    notify_push = excluded.notify_push,
    marketing_opt_in = excluded.marketing_opt_in,
    updated_at = now();

  IF NOT v_existed OR v_previous_marketing IS DISTINCT FROM _marketing_opt_in THEN
    INSERT INTO public.user_consents(user_id, kind, accepted, version)
    VALUES (
      auth.uid(),
      'marketing',
      _marketing_opt_in,
      left(coalesce(nullif(_consent_version,''), '1.0'), 32)
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_preferences(text[], text[], text[], boolean, boolean, boolean, boolean, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_preferences(text[], text[], text[], boolean, boolean, boolean, boolean, boolean, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
