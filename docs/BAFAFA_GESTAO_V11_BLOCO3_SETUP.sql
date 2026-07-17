BEGIN;

-- V11 / Bloco 3 — Gestão, métricas, exportações e preparação do piloto.

CREATE TABLE IF NOT EXISTS public.pilot_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'preparing'
    CHECK (status IN ('preparing', 'ready', 'running', 'finished', 'cancelled')),
  expected_attendance integer NOT NULL DEFAULT 0 CHECK (expected_attendance >= 0),
  target_registrations integer NOT NULL DEFAULT 0 CHECK (target_registrations >= 0),
  target_checkins integer NOT NULL DEFAULT 0 CHECK (target_checkins >= 0),
  target_redemptions integer NOT NULL DEFAULT 0 CHECK (target_redemptions >= 0),
  minimum_profile_percent integer NOT NULL DEFAULT 40
    CHECK (minimum_profile_percent BETWEEN 0 AND 100),
  staff_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  customer_instructions text,
  internal_notes text,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS pilot_runs_status_idx ON public.pilot_runs(status);
CREATE INDEX IF NOT EXISTS pilot_runs_campaign_idx ON public.pilot_runs(campaign_id);

DROP TRIGGER IF EXISTS pilot_runs_set_updated_at ON public.pilot_runs;
CREATE TRIGGER pilot_runs_set_updated_at
BEFORE UPDATE ON public.pilot_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.pilot_runs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilot_runs TO authenticated;
GRANT ALL ON public.pilot_runs TO service_role;

DROP POLICY IF EXISTS "Admins manage pilot runs" ON public.pilot_runs;
CREATE POLICY "Admins manage pilot runs"
ON public.pilot_runs
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_pilot_run()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (
    auth.uid(),
    CASE WHEN TG_OP = 'INSERT' THEN 'pilot_created' ELSE 'pilot_updated' END,
    'pilot_run',
    NEW.id::text,
    jsonb_build_object(
      'name', NEW.name,
      'event_id', NEW.event_id,
      'campaign_id', NEW.campaign_id,
      'status', NEW.status,
      'previous_status', CASE WHEN TG_OP = 'UPDATE' THEN OLD.status ELSE NULL END
    )
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tg_audit_pilot_run() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tg_audit_pilot_run() TO service_role;

DROP TRIGGER IF EXISTS pilot_runs_audit ON public.pilot_runs;
CREATE TRIGGER pilot_runs_audit
AFTER INSERT OR UPDATE ON public.pilot_runs
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pilot_run();

-- Exportações administrativas em uma única resposta JSON para evitar cortes de paginação.
CREATE OR REPLACE FUNCTION public.admin_export_data(
  _kind text,
  _event_id uuid DEFAULT NULL,
  _from timestamptz DEFAULT NULL,
  _to timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_result jsonb := '[]'::jsonb;
  v_count integer := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;

  IF _kind = 'clients' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.created_at DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        p.id,
        p.display_name AS nome,
        p.username,
        u.email,
        coalesce(u.phone, p.whatsapp) AS telefone,
        p.birth_date AS nascimento,
        p.city AS cidade,
        p.neighborhood AS bairro,
        p.how_found_us AS como_conheceu,
        public.calculate_profile_completeness(p.id) AS perfil_percentual,
        up.event_categories AS preferencias_eventos,
        up.drink_preferences AS preferencias_bebidas,
        up.food_preferences AS preferencias_comidas,
        coalesce(up.marketing_opt_in, false) AS marketing_opt_in,
        count(DISTINCT c.id)::integer AS checkins,
        max(c.created_at) AS ultimo_checkin,
        p.created_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.id
      LEFT JOIN public.user_preferences up ON up.user_id = p.id
      LEFT JOIN public.checkins c ON c.user_id = p.id
      WHERE p.deleted_at IS NULL
        AND (_from IS NULL OR p.created_at >= _from)
        AND (_to IS NULL OR p.created_at <= _to)
      GROUP BY p.id, u.email, u.phone, up.user_id
    ) q;

  ELSIF _kind = 'checkins' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.data_hora DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        c.id,
        c.created_at AS data_hora,
        p.display_name AS cliente,
        p.username,
        coalesce(u.phone, p.whatsapp) AS telefone,
        e.name AS evento,
        e.category AS categoria,
        c.method AS metodo,
        staff.display_name AS validado_por
      FROM public.checkins c
      JOIN public.profiles p ON p.id = c.user_id
      LEFT JOIN auth.users u ON u.id = c.user_id
      JOIN public.events e ON e.id = c.event_id
      LEFT JOIN public.profiles staff ON staff.id = c.staff_id
      WHERE (_event_id IS NULL OR c.event_id = _event_id)
        AND (_from IS NULL OR c.created_at >= _from)
        AND (_to IS NULL OR c.created_at <= _to)
    ) q;

  ELSIF _kind = 'campaigns' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.criada_em DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        cp.id,
        cp.name AS campanha,
        e.name AS evento,
        cp.status,
        cp.product_name AS produto,
        cp.benefit_type AS tipo_beneficio,
        cp.discount_percent AS desconto_percentual,
        cp.fixed_off_cents AS desconto_centavos,
        cp.total_available AS limite_total,
        cp.per_user_limit AS limite_por_cliente,
        count(DISTINCT r.id)::integer AS mimos_liberados,
        count(DISTINCT rr.id)::integer AS mimos_utilizados,
        count(DISTINCT r.id) FILTER (WHERE r.status = 'expired')::integer AS mimos_expirados,
        cp.starts_at AS inicio,
        cp.ends_at AS fim,
        cp.created_at AS criada_em
      FROM public.campaigns cp
      LEFT JOIN public.events e ON e.id = cp.event_id
      LEFT JOIN public.user_rewards r ON r.campaign_id = cp.id
      LEFT JOIN public.reward_redemptions rr ON rr.reward_id = r.id
      WHERE (_event_id IS NULL OR cp.event_id = _event_id)
        AND (_from IS NULL OR cp.created_at >= _from)
        AND (_to IS NULL OR cp.created_at <= _to)
      GROUP BY cp.id, e.name
    ) q;

  ELSIF _kind = 'events' THEN
    SELECT coalesce(jsonb_agg(to_jsonb(q) ORDER BY q.inicio DESC), '[]'::jsonb)
    INTO v_result
    FROM (
      SELECT
        e.id,
        e.name AS evento,
        e.category AS categoria,
        e.status,
        e.starts_at AS inicio,
        e.ends_at AS fim,
        count(DISTINCT c.user_id)::integer AS checkins,
        count(DISTINCT r.id)::integer AS mimos_liberados,
        count(DISTINCT rr.id)::integer AS mimos_utilizados,
        count(DISTINCT m.user_id)::integer AS participantes_resenha,
        count(DISTINCT m.id)::integer AS mensagens_resenha,
        count(DISTINCT rep.id)::integer AS denuncias_resenha,
        count(DISTINCT c.user_id) FILTER (
          WHERE (SELECT count(DISTINCT c2.event_id) FROM public.checkins c2 WHERE c2.user_id = c.user_id) >= 2
        )::integer AS clientes_recorrentes
      FROM public.events e
      LEFT JOIN public.checkins c ON c.event_id = e.id
      LEFT JOIN public.user_rewards r ON r.event_id = e.id
      LEFT JOIN public.reward_redemptions rr ON rr.reward_id = r.id
      LEFT JOIN public.event_chat_messages m ON m.event_id = e.id AND m.deleted_at IS NULL
      LEFT JOIN public.event_chat_reports rep ON rep.message_id = m.id
      WHERE (_event_id IS NULL OR e.id = _event_id)
        AND (_from IS NULL OR e.starts_at >= _from)
        AND (_to IS NULL OR e.starts_at <= _to)
      GROUP BY e.id
    ) q;
  ELSE
    RAISE EXCEPTION 'Tipo de exportação inválido.';
  END IF;

  v_count := coalesce(jsonb_array_length(v_result), 0);
  INSERT INTO public.audit_logs(actor_id, action, entity, details)
  VALUES (
    v_actor,
    'admin_export',
    'report',
    jsonb_build_object(
      'kind', _kind,
      'event_id', _event_id,
      'from', _from,
      'to', _to,
      'rows', v_count
    )
  );

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_export_data(text, uuid, timestamptz, timestamptz)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_export_data(text, uuid, timestamptz, timestamptz)
TO authenticated, service_role;

COMMIT;
