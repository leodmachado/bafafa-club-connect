-- BAFAFÁ CONNECT V20.6
-- Bloqueio obrigatório de privilégios sem MFA/AAL2.
--
-- Objetivo: impedir que admin, moderador ou equipe usem permissões privilegiadas
-- com uma sessão AAL1, inclusive por chamadas diretas à API do Supabase.
--
-- A função public.has_role é a fundação das políticas e RPCs privilegiadas do
-- projeto. A partir desta migration, papéis privilegiados só retornam true
-- quando o JWT atual estiver em AAL2. service_role permanece autorizado para
-- rotinas de backend, migrations e manutenção segura.

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.user_roles') IS NULL
     OR to_regtype('public.app_role') IS NULL
     OR to_regprocedure('public.has_role(uuid,public.app_role)') IS NULL THEN
    RAISE EXCEPTION 'Estrutura de autorização do Bafafá Connect não encontrada. Confirme o projeto Supabase.';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_session_is_aal2()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT
    coalesce(auth.jwt() ->> 'role', '') = 'service_role'
    OR coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

REVOKE ALL ON FUNCTION public.current_session_is_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_session_is_aal2() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role = _role
    )
    AND (
      _role NOT IN (
        'admin'::public.app_role,
        'moderador'::public.app_role,
        'equipe'::public.app_role
      )
      OR public.current_session_is_aal2()
    )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Guard explícito para RPCs novas ou existentes que precisem falhar com mensagem
-- clara antes de executar qualquer leitura ou escrita sensível.
CREATE OR REPLACE FUNCTION public.require_privileged_aal2()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão autenticada obrigatória.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_session_is_aal2() THEN
    RAISE EXCEPTION 'Confirme o código do autenticador para continuar.' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.require_privileged_aal2() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_privileged_aal2() TO authenticated, service_role;

COMMIT;
