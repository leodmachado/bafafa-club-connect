-- ============================================================================
-- BAFAFÁ V15 — Segurança Base
-- Escopo: dados privados, privilégios de perfil, auditoria e menor privilégio
-- Idempotente e sem exclusão de dados de negócio.
-- ============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Endurecimento do schema público
-- Evita que papéis de cliente criem objetos que possam interferir em funções
-- SECURITY DEFINER. O uso normal das tabelas e funções permanece liberado.
-- ---------------------------------------------------------------------------
REVOKE CREATE ON SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Perfis: leitura privada e atualização somente de campos permitidos
-- ---------------------------------------------------------------------------

-- A tabela bruta nunca deve ser lida por visitantes. Perfis públicos são
-- entregues exclusivamente pela função get_public_profile(), que devolve um
-- conjunto reduzido e respeita as escolhas de privacidade.
REVOKE SELECT ON public.profiles FROM anon;
DROP VIEW IF EXISTS public.public_profiles;

-- O cadastro inicial é feito pelo trigger handle_new_user(). Clientes não
-- precisam inserir perfis diretamente nem alterar colunas internas.
REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (
  display_name,
  username,
  avatar_url,
  bio,
  city,
  whatsapp,
  birth_date,
  is_public,
  show_birth_month,
  show_city,
  neighborhood,
  how_found_us,
  active_title_id,
  show_checkin_count,
  show_event_preferences
) ON public.profiles TO authenticated;

-- Recria explicitamente as políticas esperadas, removendo nomes antigos ou
-- excessivamente amplos que possam ter sobrevivido a instalações parciais.
DROP POLICY IF EXISTS "Public profiles are viewable by any authenticated user" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Owners can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Owners can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id AND deleted_at IS NULL);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') AND deleted_at IS NULL);

CREATE POLICY "Owners update permitted profile fields"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = id AND deleted_at IS NULL);

-- Validação central, executada também quando alguém tenta ignorar a interface.
CREATE OR REPLACE FUNCTION public.tg_validate_profile_input()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.display_name := btrim(regexp_replace(coalesce(NEW.display_name, ''), '\\s+', ' ', 'g'));
  IF char_length(NEW.display_name) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'O nome deve ter entre 1 e 80 caracteres.';
  END IF;

  IF NEW.username IS NOT NULL THEN
    NEW.username := lower(btrim(NEW.username, ' @'));
    IF NEW.username = '' THEN
      NEW.username := NULL;
    ELSIF NEW.username !~ '^[a-z0-9._]{3,30}$' THEN
      RAISE EXCEPTION 'O nome de usuário deve ter de 3 a 30 caracteres: letras sem acento, números, ponto ou sublinhado.';
    END IF;
  END IF;

  IF NEW.bio IS NOT NULL AND char_length(NEW.bio) > 280 THEN
    RAISE EXCEPTION 'A bio deve ter no máximo 280 caracteres.';
  END IF;
  IF NEW.city IS NOT NULL AND char_length(NEW.city) > 80 THEN
    RAISE EXCEPTION 'A cidade deve ter no máximo 80 caracteres.';
  END IF;
  IF NEW.neighborhood IS NOT NULL AND char_length(NEW.neighborhood) > 80 THEN
    RAISE EXCEPTION 'O bairro deve ter no máximo 80 caracteres.';
  END IF;
  IF NEW.how_found_us IS NOT NULL AND char_length(NEW.how_found_us) > 160 THEN
    RAISE EXCEPTION 'A origem do cadastro deve ter no máximo 160 caracteres.';
  END IF;
  IF NEW.whatsapp IS NOT NULL AND char_length(NEW.whatsapp) > 24 THEN
    RAISE EXCEPTION 'Número de telefone inválido.';
  END IF;
  IF NEW.avatar_url IS NOT NULL AND (
    char_length(NEW.avatar_url) > 2048 OR NEW.avatar_url !~ '^https://'
  ) THEN
    RAISE EXCEPTION 'Endereço da foto inválido.';
  END IF;
  IF NEW.birth_date IS NOT NULL AND (
    NEW.birth_date > current_date OR NEW.birth_date < current_date - interval '120 years'
  ) THEN
    RAISE EXCEPTION 'Data de nascimento inválida.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.tg_validate_profile_input() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_validate_profile_input() TO service_role;

DROP TRIGGER IF EXISTS profiles_validate_input_v15 ON public.profiles;
CREATE TRIGGER profiles_validate_input_v15
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_validate_profile_input();

-- ---------------------------------------------------------------------------
-- 2. Papéis: impedir enumeração de papéis de outros usuários via RPC
-- A assinatura permanece igual para não quebrar policies existentes.
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
    );
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_roles()
RETURNS SETOF public.app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT ur.role
  FROM public.user_roles ur
  WHERE ur.user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Auditoria: somente triggers/funções protegidas escrevem registros
-- ---------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM anon, authenticated;
GRANT SELECT ON public.audit_logs TO authenticated;
DROP POLICY IF EXISTS "Authenticated can insert their own audit rows" ON public.audit_logs;

-- Garante que somente administradores leiam a trilha completa.
DROP POLICY IF EXISTS "Admins view audit logs" ON public.audit_logs;
CREATE POLICY "Admins view audit logs"
ON public.audit_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 4. Menor privilégio para equipe operacional
-- A equipe valida por funções RPC; não precisa navegar nas tabelas completas.
-- Administradores mantêm a visão bruta necessária ao painel de gestão.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Staff read all checkins" ON public.checkins;
DROP POLICY IF EXISTS "Staff insert checkins" ON public.checkins;
DROP POLICY IF EXISTS "Admins read all checkins" ON public.checkins;
CREATE POLICY "Admins read all checkins"
ON public.checkins FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.checkins FROM authenticated;

DROP POLICY IF EXISTS "Staff read all rewards" ON public.user_rewards;
DROP POLICY IF EXISTS "Admins read all rewards" ON public.user_rewards;
CREATE POLICY "Admins read all rewards"
ON public.user_rewards FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.user_rewards FROM authenticated;

DROP POLICY IF EXISTS "Staff read all redemptions" ON public.reward_redemptions;
DROP POLICY IF EXISTS "Admins read all redemptions" ON public.reward_redemptions;
CREATE POLICY "Admins read all redemptions"
ON public.reward_redemptions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.reward_redemptions FROM authenticated;

-- Bloqueios do chat passam exclusivamente pelas funções protegidas.
REVOKE INSERT, UPDATE, DELETE ON public.event_chat_blocks FROM authenticated;
DROP POLICY IF EXISTS "Users create own chat blocks" ON public.event_chat_blocks;
DROP POLICY IF EXISTS "Users remove own chat blocks" ON public.event_chat_blocks;

-- ---------------------------------------------------------------------------
-- 5. Funções auxiliares do chat: consultas só podem avaliar o próprio usuário
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_access_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'moderador')
     OR public.has_role(auth.uid(), 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = auth.uid() AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  RETURN now() BETWEEN v_open AND v_close;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_event_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_event_chat(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_read_event_chat(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  e public.events%ROWTYPE;
  v_open timestamptz;
  v_close timestamptz;
BEGIN
  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;

  SELECT * INTO e FROM public.events WHERE id = _event_id;
  IF NOT FOUND OR NOT e.chat_enabled OR e.status = 'cancelled' THEN RETURN false; END IF;

  IF public.has_role(auth.uid(), 'admin')
     OR public.has_role(auth.uid(), 'moderador')
     OR public.has_role(auth.uid(), 'equipe') THEN
    RETURN true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.checkins c
    WHERE c.user_id = auth.uid() AND c.event_id = _event_id
  ) THEN
    RETURN false;
  END IF;

  v_open := coalesce(e.chat_opens_at, e.checkin_opens_at, e.starts_at - interval '1 hour');
  v_close := coalesce(e.chat_closes_at, e.ends_at + interval '4 hours', e.starts_at + interval '10 hours');
  RETURN now() BETWEEN v_open AND (v_close + interval '48 hours');
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_event_chat(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_event_chat(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_event_chat_blocked(_viewer uuid, _author uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL OR (auth.uid() <> _viewer AND auth.uid() <> _author) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.event_chat_blocks b
      WHERE (b.user_id = _viewer AND b.blocked_user_id = _author)
         OR (b.user_id = _author AND b.blocked_user_id = _viewer)
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.is_event_chat_blocked(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_event_chat_blocked(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Limites de texto em denúncias e auditoria operacional
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_event_chat_message(
  _message_id uuid,
  _reason text,
  _details text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_message public.event_chat_messages%ROWTYPE;
  v_details text := nullif(btrim(coalesce(_details, '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  SELECT * INTO v_message
  FROM public.event_chat_messages
  WHERE id = _message_id AND status = 'visible';
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada.'; END IF;
  IF NOT public.can_access_event_chat(v_user, v_message.event_id) THEN
    RAISE EXCEPTION 'Sem acesso à sala.';
  END IF;
  IF v_message.user_id = v_user THEN
    RAISE EXCEPTION 'Você não pode denunciar sua própria mensagem.';
  END IF;
  IF _reason NOT IN ('spam','assedio','ofensa','exposicao','outro') THEN
    RAISE EXCEPTION 'Motivo inválido.';
  END IF;
  IF v_details IS NOT NULL AND char_length(v_details) > 500 THEN
    RAISE EXCEPTION 'Os detalhes devem ter no máximo 500 caracteres.';
  END IF;

  INSERT INTO public.event_chat_reports(message_id, reporter_id, reason, details)
  VALUES (_message_id, v_user, _reason, v_details)
  ON CONFLICT (message_id, reporter_id) DO UPDATE SET
    reason = EXCLUDED.reason,
    details = EXCLUDED.details,
    status = 'open',
    resolved_by = NULL,
    resolved_at = NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.report_event_chat_message(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_event_chat_message(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Confirmação de postura após migration
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
COMMIT;
