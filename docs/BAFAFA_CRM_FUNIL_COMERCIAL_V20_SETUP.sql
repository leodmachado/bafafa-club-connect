-- BAFAFÁ CONNECT V20.0
-- Fundação comercial: CRM, produtos, funil por consumo líquido, vendas,
-- ativação de Fofoquinhas, Fofocômetro, avaliações e salves com consentimento.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Perfil e CRM
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS phone_e164 text,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_checkin_at timestamptz,
  ADD COLUMN IF NOT EXISTS visit_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lifetime_net_spend_cents bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_purchase_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reward_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS current_segment text NOT NULL DEFAULT 'bafafa_novo';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_e164_unique
  ON public.profiles(phone_e164)
  WHERE phone_e164 IS NOT NULL;
CREATE INDEX IF NOT EXISTS profiles_current_segment_idx ON public.profiles(current_segment);
CREATE INDEX IF NOT EXISTS profiles_last_checkin_idx ON public.profiles(last_checkin_at DESC);

CREATE TABLE IF NOT EXISTS public.crm_segment_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  segment_key text NOT NULL CHECK (segment_key IN (
    'bafafa_novo',
    'bafafa_recorrente',
    'sumido_da_resenha',
    'aniversariante',
    'presenca_garantida',
    'cacador_de_fofoquinha',
    'fofoqueiro_oficial'
  )),
  active boolean NOT NULL DEFAULT true,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, segment_key)
);
CREATE INDEX IF NOT EXISTS crm_segment_memberships_active_idx
  ON public.crm_segment_memberships(segment_key, active);
ALTER TABLE public.crm_segment_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.crm_segment_memberships TO authenticated;
GRANT ALL ON public.crm_segment_memberships TO service_role;
DROP POLICY IF EXISTS "Users read own CRM segments" ON public.crm_segment_memberships;
CREATE POLICY "Users read own CRM segments" ON public.crm_segment_memberships
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins read CRM segments" ON public.crm_segment_memberships;
CREATE POLICY "Admins read CRM segments" ON public.crm_segment_memberships
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 2. Produtos e histórico imutável
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_product_name(_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog, public
AS $$
  SELECT trim(regexp_replace(
    lower(translate(coalesce(_name, ''),
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_name text NOT NULL,
  normalized_name text NOT NULL,
  category text NOT NULL DEFAULT 'outros',
  current_sale_price_cents integer NOT NULL DEFAULT 0 CHECK (current_sale_price_cents >= 0),
  current_cost_cents integer NOT NULL DEFAULT 0 CHECK (current_cost_cents >= 0),
  active boolean NOT NULL DEFAULT true,
  counts_for_funnel boolean NOT NULL DEFAULT true,
  discount_eligible boolean NOT NULL DEFAULT true,
  counts_for_fofocometro boolean NOT NULL DEFAULT false,
  max_discount_cents integer CHECK (max_discount_cents IS NULL OR max_discount_cents >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(normalized_name)
);
CREATE INDEX IF NOT EXISTS products_category_active_idx ON public.products(category, active);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
DROP POLICY IF EXISTS "Authenticated read active products" ON public.products;
CREATE POLICY "Authenticated read active products" ON public.products
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'equipe'));
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.product_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_change_history_product_idx
  ON public.product_change_history(product_id, changed_at DESC);
ALTER TABLE public.product_change_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.product_change_history TO authenticated;
GRANT ALL ON public.product_change_history TO service_role;
DROP POLICY IF EXISTS "Admins read product history" ON public.product_change_history;
CREATE POLICY "Admins read product history" ON public.product_change_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_product_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_actor uuid := auth.uid();
BEGIN
  IF NEW.current_sale_price_cents IS DISTINCT FROM OLD.current_sale_price_cents THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'current_sale_price_cents', to_jsonb(OLD.current_sale_price_cents), to_jsonb(NEW.current_sale_price_cents), v_reason, v_actor);
  END IF;
  IF NEW.current_cost_cents IS DISTINCT FROM OLD.current_cost_cents THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'current_cost_cents', to_jsonb(OLD.current_cost_cents), to_jsonb(NEW.current_cost_cents), v_reason, v_actor);
  END IF;
  IF NEW.category IS DISTINCT FROM OLD.category THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'category', to_jsonb(OLD.category), to_jsonb(NEW.category), v_reason, v_actor);
  END IF;
  IF NEW.discount_eligible IS DISTINCT FROM OLD.discount_eligible THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'discount_eligible', to_jsonb(OLD.discount_eligible), to_jsonb(NEW.discount_eligible), v_reason, v_actor);
  END IF;
  IF NEW.counts_for_funnel IS DISTINCT FROM OLD.counts_for_funnel THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'counts_for_funnel', to_jsonb(OLD.counts_for_funnel), to_jsonb(NEW.counts_for_funnel), v_reason, v_actor);
  END IF;
  IF NEW.counts_for_fofocometro IS DISTINCT FROM OLD.counts_for_fofocometro THEN
    INSERT INTO public.product_change_history(product_id, field_name, old_value, new_value, reason, changed_by)
    VALUES(NEW.id, 'counts_for_fofocometro', to_jsonb(OLD.counts_for_fofocometro), to_jsonb(NEW.counts_for_fofocometro), v_reason, v_actor);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS products_audit_changes ON public.products;
CREATE TRIGGER products_audit_changes AFTER UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_product_changes();

CREATE OR REPLACE FUNCTION public.admin_upsert_product(
  _name text,
  _category text DEFAULT 'outros',
  _sale_price_cents integer DEFAULT 0,
  _cost_cents integer DEFAULT 0,
  _reason text DEFAULT NULL
)
RETURNS public.products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_normalized text := public.normalize_product_name(_name);
  v_product public.products%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN
    RAISE EXCEPTION 'Acesso restrito à administração.';
  END IF;
  IF length(v_normalized) < 2 THEN RAISE EXCEPTION 'Informe um nome de produto válido.'; END IF;
  IF _sale_price_cents < 0 OR _cost_cents < 0 THEN RAISE EXCEPTION 'Preço e custo não podem ser negativos.'; END IF;

  PERFORM set_config('app.change_reason', coalesce(_reason, 'Atualização administrativa'), true);
  INSERT INTO public.products(original_name, normalized_name, category, current_sale_price_cents, current_cost_cents, created_by)
  VALUES(trim(_name), v_normalized, coalesce(nullif(trim(_category), ''), 'outros'), _sale_price_cents, _cost_cents, v_actor)
  ON CONFLICT (normalized_name) DO UPDATE SET
    original_name = EXCLUDED.original_name,
    category = EXCLUDED.category,
    current_sale_price_cents = EXCLUDED.current_sale_price_cents,
    current_cost_cents = EXCLUDED.current_cost_cents,
    active = true,
    updated_at = now()
  RETURNING * INTO v_product;
  RETURN v_product;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_upsert_product(text,text,integer,integer,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_product(text,text,integer,integer,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Fofoquinhas mais completas e snapshots
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS public_title text,
  ADD COLUMN IF NOT EXISTS public_copy text,
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_category text,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS activation_window_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS redemption_window_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS visit_scope text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS counts_for_funnel boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS counts_for_fofocometro boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stacking_allowed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligible_quantity_mode text NOT NULL DEFAULT 'first_unit',
  ADD COLUMN IF NOT EXISTS audience_segment text,
  ADD COLUMN IF NOT EXISTS progression_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS used_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_kind_check;
ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_kind_check
  CHECK (campaign_kind IN ('event','milestone','global','funnel'));

DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_discount_type_check
    CHECK (discount_type IS NULL OR discount_type IN ('percent','fixed','gift','other'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_visit_scope_check
    CHECK (visit_scope IN ('current','future','either'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_quantity_mode_check
    CHECK (eligible_quantity_mode IN ('first_unit','all_units'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

UPDATE public.campaigns
SET public_title = coalesce(public_title, name),
    public_copy = coalesce(public_copy, description),
    discount_type = coalesce(discount_type,
      CASE
        WHEN discount_percent IS NOT NULL THEN 'percent'
        WHEN fixed_off_cents IS NOT NULL THEN 'fixed'
        ELSE 'other'
      END),
    discount_value = coalesce(discount_value,
      CASE
        WHEN discount_percent IS NOT NULL THEN discount_percent::numeric
        WHEN fixed_off_cents IS NOT NULL THEN fixed_off_cents::numeric / 100
        ELSE NULL
      END)
WHERE public_title IS NULL OR discount_type IS NULL;

CREATE TABLE IF NOT EXISTS public.campaign_products (
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(campaign_id, product_id)
);
ALTER TABLE public.campaign_products ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.campaign_products TO authenticated;
GRANT ALL ON public.campaign_products TO service_role;
DROP POLICY IF EXISTS "Authenticated read campaign products" ON public.campaign_products;
CREATE POLICY "Authenticated read campaign products" ON public.campaign_products
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage campaign products" ON public.campaign_products;
CREATE POLICY "Admins manage campaign products" ON public.campaign_products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.campaign_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  field_name text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  reason text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaign_change_history_campaign_idx
  ON public.campaign_change_history(campaign_id, changed_at DESC);
ALTER TABLE public.campaign_change_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.campaign_change_history TO authenticated;
GRANT ALL ON public.campaign_change_history TO service_role;
DROP POLICY IF EXISTS "Admins read campaign history" ON public.campaign_change_history;
CREATE POLICY "Admins read campaign history" ON public.campaign_change_history
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.tg_audit_campaign_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_reason text := nullif(current_setting('app.change_reason', true), '');
  v_field text;
  v_old jsonb := to_jsonb(OLD);
  v_new jsonb := to_jsonb(NEW);
BEGIN
  FOREACH v_field IN ARRAY ARRAY[
    'benefit_type','discount_percent','fixed_off_cents','discount_max_cents','product_id',
    'product_category','activation_window_minutes','redemption_window_minutes','visit_scope',
    'counts_for_funnel','counts_for_fofocometro','stacking_allowed','eligible_quantity_mode',
    'progression_rule','starts_at','ends_at','status','total_available','per_user_limit'
  ] LOOP
    IF (v_old -> v_field) IS DISTINCT FROM (v_new -> v_field) THEN
      INSERT INTO public.campaign_change_history(campaign_id,field_name,old_value,new_value,reason,changed_by)
      VALUES(NEW.id,v_field,v_old -> v_field,v_new -> v_field,v_reason,v_actor);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS campaigns_audit_changes ON public.campaigns;
CREATE TRIGGER campaigns_audit_changes AFTER UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_audit_campaign_changes();

CREATE OR REPLACE FUNCTION public.tg_campaign_product_autocreate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_product_id uuid;
  v_normalized text;
BEGIN
  IF NEW.product_id IS NULL AND nullif(trim(NEW.product_name), '') IS NOT NULL THEN
    v_normalized := public.normalize_product_name(NEW.product_name);
    INSERT INTO public.products(original_name, normalized_name, category, created_by)
    VALUES(trim(NEW.product_name), v_normalized, coalesce(nullif(NEW.product_category, ''), 'outros'), auth.uid())
    ON CONFLICT (normalized_name) DO UPDATE SET original_name = EXCLUDED.original_name
    RETURNING id INTO v_product_id;
    NEW.product_id := v_product_id;
  END IF;
  NEW.public_title := coalesce(nullif(NEW.public_title, ''), NEW.name);
  NEW.public_copy := coalesce(NEW.public_copy, NEW.description);
  NEW.discount_type := coalesce(NEW.discount_type,
    CASE WHEN NEW.discount_percent IS NOT NULL THEN 'percent'
         WHEN NEW.fixed_off_cents IS NOT NULL THEN 'fixed'
         ELSE 'other' END);
  NEW.discount_value := coalesce(NEW.discount_value,
    CASE WHEN NEW.discount_percent IS NOT NULL THEN NEW.discount_percent::numeric
         WHEN NEW.fixed_off_cents IS NOT NULL THEN NEW.fixed_off_cents::numeric / 100
         ELSE NULL END);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS campaigns_product_autocreate ON public.campaigns;
CREATE TRIGGER campaigns_product_autocreate
  BEFORE INSERT OR UPDATE OF product_name, product_id, public_title, public_copy, discount_type, discount_value
  ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_campaign_product_autocreate();

INSERT INTO public.products(original_name, normalized_name, category)
SELECT DISTINCT trim(c.product_name), public.normalize_product_name(c.product_name), coalesce(nullif(c.product_category,''), 'outros')
FROM public.campaigns c
WHERE nullif(trim(c.product_name),'') IS NOT NULL
ON CONFLICT(normalized_name) DO NOTHING;

UPDATE public.campaigns c
SET product_id = p.id
FROM public.products p
WHERE c.product_id IS NULL
  AND nullif(trim(c.product_name),'') IS NOT NULL
  AND p.normalized_name = public.normalize_product_name(c.product_name);

ALTER TABLE public.user_rewards
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS used_at timestamptz,
  ADD COLUMN IF NOT EXISTS visit_scope text NOT NULL DEFAULT 'current',
  ADD COLUMN IF NOT EXISTS source_stage_id uuid,
  ADD COLUMN IF NOT EXISTS reward_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.tg_snapshot_user_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_campaign public.campaigns%ROWTYPE;
BEGIN
  SELECT * INTO v_campaign FROM public.campaigns WHERE id = NEW.campaign_id;
  IF FOUND THEN
    NEW.visit_scope := coalesce(NEW.visit_scope, v_campaign.visit_scope, 'current');
    IF NEW.reward_snapshot = '{}'::jsonb OR NEW.reward_snapshot IS NULL THEN
      NEW.reward_snapshot := jsonb_build_object(
        'campaign_id', v_campaign.id,
        'name', v_campaign.name,
        'public_title', coalesce(v_campaign.public_title, v_campaign.name),
        'public_copy', coalesce(v_campaign.public_copy, v_campaign.description),
        'benefit_type', v_campaign.benefit_type,
        'discount_type', v_campaign.discount_type,
        'discount_percent', v_campaign.discount_percent,
        'fixed_off_cents', v_campaign.fixed_off_cents,
        'discount_max_cents', v_campaign.discount_max_cents,
        'product_id', v_campaign.product_id,
        'product_name', v_campaign.product_name,
        'product_category', v_campaign.product_category,
        'redemption_window_minutes', v_campaign.redemption_window_minutes,
        'eligible_quantity_mode', v_campaign.eligible_quantity_mode,
        'stacking_allowed', v_campaign.stacking_allowed,
        'visit_scope', v_campaign.visit_scope,
        'captured_at', now()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_rewards_snapshot ON public.user_rewards;
CREATE TRIGGER user_rewards_snapshot BEFORE INSERT ON public.user_rewards
  FOR EACH ROW EXECUTE FUNCTION public.tg_snapshot_user_reward();

UPDATE public.user_rewards ur
SET reward_snapshot = jsonb_build_object(
  'campaign_id',c.id,'name',c.name,'public_title',coalesce(c.public_title,c.name),
  'public_copy',coalesce(c.public_copy,c.description),'benefit_type',c.benefit_type,
  'discount_type',c.discount_type,'discount_percent',c.discount_percent,
  'fixed_off_cents',c.fixed_off_cents,'discount_max_cents',c.discount_max_cents,
  'product_id',c.product_id,'product_name',c.product_name,'product_category',c.product_category,
  'redemption_window_minutes',c.redemption_window_minutes,
  'eligible_quantity_mode',c.eligible_quantity_mode,'stacking_allowed',c.stacking_allowed,
  'visit_scope',c.visit_scope,'captured_at',coalesce(ur.granted_at,ur.created_at)
)
FROM public.campaigns c
WHERE ur.campaign_id=c.id AND (ur.reward_snapshot IS NULL OR ur.reward_snapshot='{}'::jsonb);

-- ---------------------------------------------------------------------------
-- 4. Sessões por evento, vendas e itens
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_event_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  checkin_id uuid REFERENCES public.checkins(id) ON DELETE SET NULL,
  entered_at timestamptz NOT NULL DEFAULT now(),
  exited_at timestamptz,
  gross_total_cents bigint NOT NULL DEFAULT 0,
  discount_total_cents bigint NOT NULL DEFAULT 0,
  net_total_cents bigint NOT NULL DEFAULT 0,
  funnel_net_total_cents bigint NOT NULL DEFAULT 0,
  cost_total_cents bigint NOT NULL DEFAULT 0,
  margin_total_cents bigint NOT NULL DEFAULT 0,
  current_stage integer NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
CREATE INDEX IF NOT EXISTS customer_event_sessions_event_idx
  ON public.customer_event_sessions(event_id, status);
ALTER TABLE public.customer_event_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.customer_event_sessions TO authenticated;
GRANT ALL ON public.customer_event_sessions TO service_role;
DROP POLICY IF EXISTS "Users read own event sessions" ON public.customer_event_sessions;
CREATE POLICY "Users read own event sessions" ON public.customer_event_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Staff read event sessions" ON public.customer_event_sessions;
CREATE POLICY "Staff read event sessions" ON public.customer_event_sessions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'equipe') OR public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS customer_event_sessions_updated_at ON public.customer_event_sessions;
CREATE TRIGGER customer_event_sessions_updated_at BEFORE UPDATE ON public.customer_event_sessions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES public.customer_event_sessions(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','refunded')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','zig','import','demo')),
  external_reference text,
  gross_total_cents bigint NOT NULL DEFAULT 0,
  discount_total_cents bigint NOT NULL DEFAULT 0,
  net_total_cents bigint NOT NULL DEFAULT 0,
  funnel_eligible_net_cents bigint NOT NULL DEFAULT 0,
  service_fee_cents bigint NOT NULL DEFAULT 0,
  tip_cents bigint NOT NULL DEFAULT 0,
  couvert_cents bigint NOT NULL DEFAULT 0,
  cost_total_cents bigint NOT NULL DEFAULT 0,
  margin_total_cents bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  cancelled_at timestamptz,
  refunded_at timestamptz,
  cancellation_reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_user_event_idx ON public.sales(user_id, event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sales_external_reference_idx ON public.sales(external_reference) WHERE external_reference IS NOT NULL;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sales TO authenticated;
GRANT ALL ON public.sales TO service_role;
DROP POLICY IF EXISTS "Users read own sales" ON public.sales;
CREATE POLICY "Users read own sales" ON public.sales
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Staff read sales" ON public.sales;
CREATE POLICY "Staff read sales" ON public.sales
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'equipe') OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage sales" ON public.sales;
CREATE POLICY "Admins manage sales" ON public.sales
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS sales_updated_at ON public.sales;
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  catalog_sale_price_cents integer NOT NULL CHECK (catalog_sale_price_cents >= 0),
  unit_sale_price_cents integer NOT NULL CHECK (unit_sale_price_cents >= 0),
  unit_cost_snapshot_cents integer NOT NULL CHECK (unit_cost_snapshot_cents >= 0),
  gross_value_cents bigint NOT NULL CHECK (gross_value_cents >= 0),
  discount_type text,
  configured_discount_value numeric(12,2),
  discount_real_cents bigint NOT NULL DEFAULT 0 CHECK (discount_real_cents >= 0),
  net_paid_cents bigint NOT NULL CHECK (net_paid_cents >= 0),
  estimated_margin_cents bigint NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  reward_id uuid REFERENCES public.user_rewards(id) ON DELETE SET NULL,
  eligible_for_funnel boolean NOT NULL DEFAULT true,
  counts_for_fofocometro boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled','refunded')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sale_items_sale_idx ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS sale_items_product_idx ON public.sale_items(product_id, created_at DESC);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.sale_items TO authenticated;
GRANT ALL ON public.sale_items TO service_role;
DROP POLICY IF EXISTS "Users read own sale items" ON public.sale_items;
CREATE POLICY "Users read own sale items" ON public.sale_items
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.sales s WHERE s.id = sale_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Staff read sale items" ON public.sale_items;
CREATE POLICY "Staff read sale items" ON public.sale_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'equipe') OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 5. Funil configurável
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_funnel_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Funil principal',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS event_funnel_rules_one_active_event
  ON public.event_funnel_rules(event_id)
  WHERE active AND event_id IS NOT NULL;
ALTER TABLE public.event_funnel_rules ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.event_funnel_rules TO authenticated;
GRANT ALL ON public.event_funnel_rules TO service_role;
DROP POLICY IF EXISTS "Authenticated read active funnel rules" ON public.event_funnel_rules;
CREATE POLICY "Authenticated read active funnel rules" ON public.event_funnel_rules
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage funnel rules" ON public.event_funnel_rules;
CREATE POLICY "Admins manage funnel rules" ON public.event_funnel_rules
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS event_funnel_rules_updated_at ON public.event_funnel_rules;
CREATE TRIGGER event_funnel_rules_updated_at BEFORE UPDATE ON public.event_funnel_rules
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.funnel_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.event_funnel_rules(id) ON DELETE CASCADE,
  stage_order integer NOT NULL CHECK (stage_order > 0),
  trigger_type text NOT NULL CHECK (trigger_type IN ('checkin','net_spend')),
  threshold_cents integer NOT NULL DEFAULT 0 CHECK (threshold_cents >= 0),
  reward_campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE RESTRICT,
  title text NOT NULL,
  progress_copy text,
  unlocked_copy text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rule_id, stage_order)
);
ALTER TABLE public.funnel_stages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.funnel_stages TO authenticated;
GRANT ALL ON public.funnel_stages TO service_role;
DROP POLICY IF EXISTS "Authenticated read active funnel stages" ON public.funnel_stages;
CREATE POLICY "Authenticated read active funnel stages" ON public.funnel_stages
  FOR SELECT TO authenticated USING (active OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins manage funnel stages" ON public.funnel_stages;
CREATE POLICY "Admins manage funnel stages" ON public.funnel_stages
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS funnel_stages_updated_at ON public.funnel_stages;
CREATE TRIGGER funnel_stages_updated_at BEFORE UPDATE ON public.funnel_stages
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.event_funnel_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.customer_event_sessions(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES public.funnel_stages(id) ON DELETE CASCADE,
  reward_id uuid REFERENCES public.user_rewards(id) ON DELETE SET NULL,
  reached_at timestamptz NOT NULL DEFAULT now(),
  reversed_at timestamptz,
  reversal_reason text,
  UNIQUE(session_id, stage_id)
);
ALTER TABLE public.event_funnel_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.event_funnel_progress TO authenticated;
GRANT ALL ON public.event_funnel_progress TO service_role;
DROP POLICY IF EXISTS "Users read own funnel progress" ON public.event_funnel_progress;
CREATE POLICY "Users read own funnel progress" ON public.event_funnel_progress
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.customer_event_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Staff read funnel progress" ON public.event_funnel_progress;
CREATE POLICY "Staff read funnel progress" ON public.event_funnel_progress
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'equipe') OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 6. Fofocômetro
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.collective_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name text NOT NULL DEFAULT 'Gela a Gente',
  stage_order integer NOT NULL DEFAULT 1,
  target_count integer NOT NULL CHECK (target_count > 0),
  current_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled')),
  starts_at timestamptz,
  completed_at timestamptz,
  reward_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, stage_order)
);
ALTER TABLE public.collective_goals ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.collective_goals TO anon, authenticated;
GRANT ALL ON public.collective_goals TO service_role;
DROP POLICY IF EXISTS "Everyone reads collective goals" ON public.collective_goals;
CREATE POLICY "Everyone reads collective goals" ON public.collective_goals
  FOR SELECT USING (status IN ('scheduled','active','completed'));
DROP POLICY IF EXISTS "Admins manage collective goals" ON public.collective_goals;
CREATE POLICY "Admins manage collective goals" ON public.collective_goals
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS collective_goals_updated_at ON public.collective_goals;
CREATE TRIGGER collective_goals_updated_at BEFORE UPDATE ON public.collective_goals
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.collective_goal_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.collective_goals(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  reward_redemption_id uuid NOT NULL REFERENCES public.reward_redemptions(id) ON DELETE RESTRICT,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  gross_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  net_cents bigint NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  margin_cents bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(goal_id, reward_redemption_id)
);
ALTER TABLE public.collective_goal_contributions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.collective_goal_contributions TO authenticated;
GRANT ALL ON public.collective_goal_contributions TO service_role;
DROP POLICY IF EXISTS "Admins read Fofocometro contributions" ON public.collective_goal_contributions;
CREATE POLICY "Admins read Fofocometro contributions" ON public.collective_goal_contributions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 7. Avaliações e salves
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  service_rating integer CHECK (service_rating BETWEEN 1 AND 5),
  music_rating integer CHECK (music_rating BETWEEN 1 AND 5),
  atmosphere_rating integer CHECK (atmosphere_rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  would_return boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);
ALTER TABLE public.event_reviews ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.event_reviews TO authenticated;
GRANT ALL ON public.event_reviews TO service_role;
DROP POLICY IF EXISTS "Users manage own event reviews" ON public.event_reviews;
CREATE POLICY "Users manage own event reviews" ON public.event_reviews
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins read all event reviews" ON public.event_reviews;
CREATE POLICY "Admins read all event reviews" ON public.event_reviews
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS event_reviews_updated_at ON public.event_reviews;
CREATE TRIGGER event_reviews_updated_at BEFORE UPDATE ON public.event_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE IF NOT EXISTS public.salve_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','expired')),
  opener text CHECK (opener IS NULL OR length(opener) <= 220),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  responded_at timestamptz,
  CHECK (sender_id <> recipient_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS salve_requests_pending_unique
  ON public.salve_requests(event_id, sender_id, recipient_id)
  WHERE status = 'pending';
ALTER TABLE public.salve_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.salve_requests TO authenticated;
GRANT ALL ON public.salve_requests TO service_role;
DROP POLICY IF EXISTS "Participants read own salves" ON public.salve_requests;
CREATE POLICY "Participants read own salves" ON public.salve_requests
  FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));

CREATE TABLE IF NOT EXISTS public.private_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  salve_request_id uuid NOT NULL UNIQUE REFERENCES public.salve_requests(id) ON DELETE CASCADE,
  member_one_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_two_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (member_one_id <> member_two_id)
);
ALTER TABLE public.private_chat_threads ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.private_chat_threads TO authenticated;
GRANT ALL ON public.private_chat_threads TO service_role;
DROP POLICY IF EXISTS "Members read private threads" ON public.private_chat_threads;
CREATE POLICY "Members read private threads" ON public.private_chat_threads
  FOR SELECT TO authenticated USING (auth.uid() IN (member_one_id, member_two_id));

CREATE TABLE IF NOT EXISTS public.private_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.private_chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (length(trim(body)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS private_chat_messages_thread_idx
  ON public.private_chat_messages(thread_id, created_at);
ALTER TABLE public.private_chat_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.private_chat_messages TO authenticated;
GRANT ALL ON public.private_chat_messages TO service_role;
DROP POLICY IF EXISTS "Members read private messages" ON public.private_chat_messages;
CREATE POLICY "Members read private messages" ON public.private_chat_messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.private_chat_threads t
      WHERE t.id = thread_id AND auth.uid() IN (t.member_one_id, t.member_two_id)
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Funções de consistência e CRM
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_customer_event_session(
  _user_id uuid,
  _event_id uuid,
  _checkin_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  INSERT INTO public.customer_event_sessions(user_id, event_id, checkin_id, entered_at)
  VALUES(_user_id, _event_id, _checkin_id, now())
  ON CONFLICT (user_id, event_id) DO UPDATE SET
    checkin_id = coalesce(public.customer_event_sessions.checkin_id, EXCLUDED.checkin_id),
    status = CASE WHEN public.customer_event_sessions.status = 'cancelled' THEN 'open' ELSE public.customer_event_sessions.status END,
    updated_at = now()
  RETURNING id INTO v_session_id;
  RETURN v_session_id;
END;
$$;
REVOKE ALL ON FUNCTION public.open_customer_event_session(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_customer_event_session(uuid,uuid,uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_profile_crm(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_visits integer := 0;
  v_first timestamptz;
  v_last timestamptz;
  v_net bigint := 0;
  v_last_purchase timestamptz;
  v_redeemed integer := 0;
  v_chat integer := 0;
  v_birth date;
  v_primary text := 'bafafa_novo';
  v_key text;
  v_should boolean;
BEGIN
  SELECT count(*), min(created_at), max(created_at)
    INTO v_visits, v_first, v_last
  FROM public.checkins WHERE user_id = _user_id;

  SELECT coalesce(sum(net_total_cents),0), max(created_at)
    INTO v_net, v_last_purchase
  FROM public.sales WHERE user_id = _user_id AND status = 'confirmed';

  SELECT count(*) INTO v_redeemed
  FROM public.user_rewards WHERE user_id = _user_id AND status = 'redeemed';

  SELECT count(*) INTO v_chat
  FROM public.event_chat_messages WHERE user_id = _user_id AND deleted_at IS NULL;

  SELECT birth_date INTO v_birth FROM public.profiles WHERE id = _user_id;

  FOREACH v_key IN ARRAY ARRAY[
    'bafafa_novo','bafafa_recorrente','sumido_da_resenha','aniversariante',
    'presenca_garantida','cacador_de_fofoquinha','fofoqueiro_oficial'
  ] LOOP
    v_should := CASE v_key
      WHEN 'bafafa_novo' THEN v_visits <= 1
      WHEN 'bafafa_recorrente' THEN v_visits >= 3
      WHEN 'sumido_da_resenha' THEN v_last IS NOT NULL AND v_last < now() - interval '60 days'
      WHEN 'aniversariante' THEN v_birth IS NOT NULL AND extract(month from v_birth) = extract(month from current_date)
      WHEN 'presenca_garantida' THEN v_visits >= 6 AND v_last >= now() - interval '45 days'
      WHEN 'cacador_de_fofoquinha' THEN v_redeemed >= 3
      WHEN 'fofoqueiro_oficial' THEN v_chat >= 10 AND v_visits >= 2
      ELSE false END;

    INSERT INTO public.crm_segment_memberships(user_id, segment_key, active, entered_at, exited_at, updated_at)
    VALUES(_user_id, v_key, v_should, now(), CASE WHEN v_should THEN NULL ELSE now() END, now())
    ON CONFLICT (user_id, segment_key) DO UPDATE SET
      active = EXCLUDED.active,
      entered_at = CASE
        WHEN EXCLUDED.active AND NOT public.crm_segment_memberships.active THEN now()
        ELSE public.crm_segment_memberships.entered_at END,
      exited_at = CASE WHEN EXCLUDED.active THEN NULL ELSE coalesce(public.crm_segment_memberships.exited_at, now()) END,
      updated_at = now();
  END LOOP;

  v_primary := CASE
    WHEN v_birth IS NOT NULL AND extract(month from v_birth) = extract(month from current_date) THEN 'aniversariante'
    WHEN v_chat >= 10 AND v_visits >= 2 THEN 'fofoqueiro_oficial'
    WHEN v_visits >= 6 AND v_last >= now() - interval '45 days' THEN 'presenca_garantida'
    WHEN v_redeemed >= 3 THEN 'cacador_de_fofoquinha'
    WHEN v_last IS NOT NULL AND v_last < now() - interval '60 days' THEN 'sumido_da_resenha'
    WHEN v_visits >= 3 THEN 'bafafa_recorrente'
    ELSE 'bafafa_novo' END;

  UPDATE public.profiles
  SET first_checkin_at = v_first,
      last_checkin_at = v_last,
      visit_count = v_visits,
      lifetime_net_spend_cents = v_net,
      last_purchase_at = v_last_purchase,
      current_segment = v_primary,
      updated_at = now()
  WHERE id = _user_id;

  RETURN v_primary;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_profile_crm(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_profile_crm(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.tg_after_checkin_customer_journey()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  PERFORM public.open_customer_event_session(NEW.user_id, NEW.event_id, NEW.id);
  PERFORM public.refresh_profile_crm(NEW.user_id);
  PERFORM public.refresh_customer_funnel(NEW.user_id, NEW.event_id);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS checkins_customer_journey ON public.checkins;
CREATE TRIGGER checkins_customer_journey AFTER INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.tg_after_checkin_customer_journey();

CREATE OR REPLACE FUNCTION public.recalculate_customer_event_session(_session_id uuid)
RETURNS public.customer_event_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.customer_event_sessions%ROWTYPE;
BEGIN
  UPDATE public.customer_event_sessions s
  SET gross_total_cents = x.gross_total,
      discount_total_cents = x.discount_total,
      net_total_cents = x.net_total,
      funnel_net_total_cents = x.funnel_net_total,
      cost_total_cents = x.cost_total,
      margin_total_cents = x.margin_total,
      last_purchase_at = x.last_purchase,
      updated_at = now()
  FROM (
    SELECT
      coalesce(sum(gross_total_cents),0)::bigint AS gross_total,
      coalesce(sum(discount_total_cents),0)::bigint AS discount_total,
      coalesce(sum(net_total_cents),0)::bigint AS net_total,
      coalesce(sum(funnel_eligible_net_cents),0)::bigint AS funnel_net_total,
      coalesce(sum(cost_total_cents),0)::bigint AS cost_total,
      coalesce(sum(margin_total_cents),0)::bigint AS margin_total,
      max(created_at) FILTER (WHERE status = 'confirmed') AS last_purchase
    FROM public.sales WHERE session_id = _session_id AND status = 'confirmed'
  ) x
  WHERE s.id = _session_id
  RETURNING s.* INTO v_session;

  IF NOT FOUND THEN RAISE EXCEPTION 'Sessão do evento não encontrada.'; END IF;
  PERFORM public.refresh_profile_crm(v_session.user_id);
  RETURN v_session;
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_customer_event_session(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_customer_event_session(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_customer_funnel(_user_id uuid, _event_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_session public.customer_event_sessions%ROWTYPE;
  v_rule public.event_funnel_rules%ROWTYPE;
  v_stage public.funnel_stages%ROWTYPE;
  v_progress public.event_funnel_progress%ROWTYPE;
  v_eligible boolean;
  v_reward_id uuid;
  v_campaign public.campaigns%ROWTYPE;
  v_expiration timestamptz;
  v_changed integer := 0;
  v_highest integer := 0;
BEGIN
  SELECT * INTO v_session FROM public.customer_event_sessions
  WHERE user_id = _user_id AND event_id = _event_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT * INTO v_rule FROM public.event_funnel_rules
  WHERE active AND (event_id = _event_id OR event_id IS NULL)
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  ORDER BY (event_id IS NOT NULL) DESC, created_at DESC LIMIT 1;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR v_stage IN
    SELECT * FROM public.funnel_stages
    WHERE rule_id = v_rule.id AND active ORDER BY stage_order
  LOOP
    v_eligible := CASE
      WHEN v_stage.trigger_type = 'checkin' THEN v_session.checkin_id IS NOT NULL
      WHEN v_stage.trigger_type = 'net_spend' THEN v_session.funnel_net_total_cents >= v_stage.threshold_cents
      ELSE false END;

    SELECT * INTO v_progress FROM public.event_funnel_progress
    WHERE session_id = v_session.id AND stage_id = v_stage.id FOR UPDATE;

    IF v_eligible THEN
      v_highest := greatest(v_highest, v_stage.stage_order);
      IF NOT FOUND OR v_progress.reversed_at IS NOT NULL THEN
        SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_stage.reward_campaign_id FOR SHARE;
        IF NOT FOUND OR v_campaign.status <> 'active' THEN CONTINUE; END IF;
        v_expiration := CASE
          WHEN v_campaign.visit_scope = 'future' THEN
            now() + greatest(coalesce(v_campaign.reward_valid_hours, 168), 1) * interval '1 hour'
          ELSE least(
            now() + greatest(coalesce(v_campaign.activation_window_minutes, 60), 1) * interval '1 minute',
            coalesce(
              v_campaign.ends_at,
              now() + greatest(coalesce(v_campaign.activation_window_minutes, 60), 1) * interval '1 minute'
            )
          ) END;

        INSERT INTO public.user_rewards(user_id, campaign_id, event_id, status, expires_at, visit_scope, source_stage_id)
        VALUES(_user_id, v_campaign.id,
          CASE WHEN v_campaign.visit_scope = 'future' THEN NULL ELSE _event_id END,
          'available', v_expiration, v_campaign.visit_scope, v_stage.id)
        RETURNING id INTO v_reward_id;

        INSERT INTO public.event_funnel_progress(session_id, stage_id, reward_id, reached_at, reversed_at, reversal_reason)
        VALUES(v_session.id, v_stage.id, v_reward_id, now(), NULL, NULL)
        ON CONFLICT (session_id, stage_id) DO UPDATE SET
          reward_id = EXCLUDED.reward_id,
          reached_at = now(),
          reversed_at = NULL,
          reversal_reason = NULL;
        v_changed := v_changed + 1;
      END IF;
    ELSIF FOUND AND v_progress.reversed_at IS NULL THEN
      UPDATE public.event_funnel_progress
      SET reversed_at = now(), reversal_reason = 'Progresso recalculado após cancelamento ou estorno.'
      WHERE id = v_progress.id;
      UPDATE public.user_rewards
      SET status = 'revoked', updated_at = now()
      WHERE id = v_progress.reward_id AND status = 'available';
      v_changed := v_changed + 1;
    END IF;
  END LOOP;

  UPDATE public.customer_event_sessions SET current_stage = v_highest, updated_at = now()
  WHERE id = v_session.id;
  RETURN v_changed;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_customer_funnel(uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_customer_funnel(uuid,uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. QR de cliente e ativação de Fofoquinha
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_my_qr_token(
  _purpose text,
  _ref_id uuid DEFAULT NULL
)
RETURNS TABLE(token uuid, short_code text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_code text;
  v_token uuid;
  v_expires timestamptz;
  v_attempt integer := 0;
  v_reward public.user_rewards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _purpose NOT IN ('checkin', 'redemption', 'customer') THEN RAISE EXCEPTION 'Finalidade inválida.'; END IF;

  IF _purpose = 'checkin' THEN
    IF _ref_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = _ref_id AND e.checkin_enabled
        AND e.status IN ('scheduled','published','ongoing')
        AND now() >= coalesce(e.checkin_opens_at, e.starts_at - interval '2 hours')
        AND now() <= coalesce(e.checkin_closes_at, e.starts_at + interval '6 hours')
    ) THEN RAISE EXCEPTION 'Check-in ainda não está disponível para este evento.'; END IF;
    v_expires := now() + interval '5 minutes';
  ELSIF _purpose = 'customer' THEN
    v_expires := now() + interval '10 minutes';
  ELSE
    PERFORM public.refresh_my_reward_statuses();
    SELECT * INTO v_reward FROM public.user_rewards
    WHERE id = _ref_id AND user_id = v_user FOR UPDATE;
    IF NOT FOUND OR v_reward.status <> 'available' OR (v_reward.expires_at IS NOT NULL AND v_reward.expires_at <= now()) THEN
      RAISE EXCEPTION 'Fofoquinha indisponível.';
    END IF;
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_reward.campaign_id;
    IF v_reward.activated_at IS NULL THEN
      UPDATE public.user_rewards
      SET activated_at = now(),
          activation_expires_at = least(
            coalesce(expires_at, now() + interval '24 hours'),
            now() + greatest(coalesce(v_campaign.redemption_window_minutes, 20), 1) * interval '1 minute'
          ),
          updated_at = now()
      WHERE id = v_reward.id
      RETURNING * INTO v_reward;
    ELSIF v_reward.activation_expires_at IS NOT NULL AND v_reward.activation_expires_at <= now() THEN
      UPDATE public.user_rewards SET status = 'expired', updated_at = now() WHERE id = v_reward.id;
      RAISE EXCEPTION 'O prazo desta Fofoquinha terminou.';
    END IF;
    v_expires := least(coalesce(v_reward.activation_expires_at, now() + interval '2 minutes'), now() + interval '2 minutes');
  END IF;

  UPDATE public.qr_tokens AS qt SET used_at = now()
  WHERE qt.user_id = v_user AND qt.purpose = _purpose AND qt.used_at IS NULL;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := lpad((floor(random() * 1000000))::integer::text, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.qr_tokens qt
      WHERE qt.short_code = v_code AND qt.used_at IS NULL AND qt.expires_at > now()
    );
    IF v_attempt >= 15 THEN RAISE EXCEPTION 'Não foi possível gerar o código. Tente novamente.'; END IF;
  END LOOP;

  INSERT INTO public.qr_tokens(user_id, purpose, ref_id, short_code, expires_at)
  VALUES(v_user, _purpose, _ref_id, v_code, v_expires)
  RETURNING qr_tokens.token INTO v_token;
  RETURN QUERY SELECT v_token, v_code, v_expires;
END;
$$;
REVOKE ALL ON FUNCTION public.create_my_qr_token(text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_my_qr_token(text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.inspect_commercial_qr(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_staff uuid := auth.uid();
  v_qr public.qr_tokens%ROWTYPE;
  v_reward public.user_rewards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_input text := lower(trim(coalesce(_token, '')));
  v_digits text := regexp_replace(coalesce(_token, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_staff IS NULL OR NOT (public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;
  SELECT * INTO v_qr FROM public.qr_tokens qt
  WHERE qt.purpose IN ('customer','redemption')
    AND (qt.token::text = v_input OR (length(v_digits) = 6 AND qt.short_code = v_digits))
  ORDER BY qt.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado. Gere um novo no celular do cliente.'; END IF;
  IF v_qr.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este código já foi utilizado.'; END IF;
  IF v_qr.expires_at <= now() THEN RAISE EXCEPTION 'O código expirou. Gere um novo.'; END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_qr.user_id;
  IF v_qr.purpose = 'redemption' THEN
    SELECT * INTO v_reward FROM public.user_rewards WHERE id = v_qr.ref_id FOR SHARE;
    IF NOT FOUND OR v_reward.status <> 'available' THEN RAISE EXCEPTION 'A Fofoquinha não está mais disponível.'; END IF;
    IF v_reward.activation_expires_at IS NOT NULL AND v_reward.activation_expires_at <= now() THEN
      RAISE EXCEPTION 'O prazo desta Fofoquinha terminou.';
    END IF;
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_reward.campaign_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'purpose', v_qr.purpose,
    'token', v_qr.token,
    'user_id', v_qr.user_id,
    'display_name', coalesce(v_profile.display_name, 'Bafafã'),
    'reward_id', v_reward.id,
    'campaign_id', v_campaign.id,
    'campaign_name', coalesce(v_campaign.public_title, v_campaign.name),
    'product_id', v_campaign.product_id,
    'product_name', v_campaign.product_name,
    'product_category', v_campaign.product_category,
    'discount_type', v_campaign.discount_type,
    'discount_percent', v_campaign.discount_percent,
    'fixed_off_cents', v_campaign.fixed_off_cents,
    'discount_max_cents', v_campaign.discount_max_cents,
    'eligible_quantity_mode', v_campaign.eligible_quantity_mode,
    'activation_expires_at', v_reward.activation_expires_at
  );
END;
$$;
REVOKE ALL ON FUNCTION public.inspect_commercial_qr(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.inspect_commercial_qr(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Registro transacional de venda e desconto real
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_customer_sale(
  _event_id uuid,
  _items jsonb,
  _commercial_token text,
  _external_reference text DEFAULT NULL,
  _source text DEFAULT 'manual',
  _service_fee_cents integer DEFAULT 0,
  _tip_cents integer DEFAULT 0,
  _couvert_cents integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_staff uuid := auth.uid();
  v_qr public.qr_tokens%ROWTYPE;
  v_user uuid;
  v_reward public.user_rewards%ROWTYPE;
  v_campaign public.campaigns%ROWTYPE;
  v_session_id uuid;
  v_sale_id uuid;
  v_item jsonb;
  v_product public.products%ROWTYPE;
  v_qty numeric(12,3);
  v_unit_price integer;
  v_unit_cost integer;
  v_gross bigint;
  v_discount bigint;
  v_net bigint;
  v_margin bigint;
  v_discount_applied boolean := false;
  v_product_allowed boolean;
  v_discount_base bigint;
  v_gross_total bigint := 0;
  v_discount_total bigint := 0;
  v_net_total bigint := 0;
  v_funnel_net_total bigint := 0;
  v_cost_total bigint := 0;
  v_margin_total bigint := 0;
  v_redemption_id uuid;
  v_goal public.collective_goals%ROWTYPE;
  v_first_product uuid;
  v_input text := lower(trim(coalesce(_commercial_token, '')));
  v_digits text := regexp_replace(coalesce(_commercial_token, ''), '[^0-9]', '', 'g');
BEGIN
  IF v_staff IS NULL OR NOT (public.has_role(v_staff, 'equipe') OR public.has_role(v_staff, 'admin')) THEN
    RAISE EXCEPTION 'Acesso restrito à equipe.';
  END IF;
  IF _source NOT IN ('manual','zig','import','demo') THEN RAISE EXCEPTION 'Origem da venda inválida.'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Inclua pelo menos um produto.';
  END IF;

  SELECT * INTO v_qr FROM public.qr_tokens qt
  WHERE qt.purpose IN ('customer','redemption')
    AND (qt.token::text = v_input OR (length(v_digits) = 6 AND qt.short_code = v_digits))
  ORDER BY qt.created_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Código não encontrado.'; END IF;
  IF v_qr.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este código já foi utilizado.'; END IF;
  IF v_qr.expires_at <= now() THEN RAISE EXCEPTION 'O código expirou.'; END IF;
  v_user := v_qr.user_id;

  IF NOT EXISTS (SELECT 1 FROM public.events e WHERE e.id = _event_id) THEN
    RAISE EXCEPTION 'Evento não encontrado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.checkins c WHERE c.user_id = v_user AND c.event_id = _event_id) THEN
    RAISE EXCEPTION 'O cliente precisa fazer check-in neste evento antes da compra.';
  END IF;

  IF v_qr.purpose = 'redemption' THEN
    SELECT * INTO v_reward FROM public.user_rewards WHERE id = v_qr.ref_id FOR UPDATE;
    IF NOT FOUND OR v_reward.user_id <> v_user OR v_reward.status <> 'available' THEN
      RAISE EXCEPTION 'Essa Fofoquinha já foi usada ou não está disponível.';
    END IF;
    IF v_reward.activation_expires_at IS NOT NULL AND v_reward.activation_expires_at <= now() THEN
      UPDATE public.user_rewards SET status = 'expired', updated_at = now() WHERE id = v_reward.id;
      RAISE EXCEPTION 'O prazo terminou.';
    END IF;
    SELECT * INTO v_campaign FROM public.campaigns WHERE id = v_reward.campaign_id FOR SHARE;
    IF v_reward.event_id IS NOT NULL AND v_reward.event_id <> _event_id THEN
      RAISE EXCEPTION 'Essa Fofoquinha é de outro evento do Bafafá.';
    END IF;
  END IF;

  v_session_id := public.open_customer_event_session(v_user, _event_id,
    (SELECT id FROM public.checkins WHERE user_id = v_user AND event_id = _event_id));

  INSERT INTO public.sales(user_id,event_id,session_id,status,source,external_reference,
    service_fee_cents,tip_cents,couvert_cents,created_by)
  VALUES(v_user,_event_id,v_session_id,'confirmed',_source,nullif(trim(_external_reference),''),
    greatest(_service_fee_cents,0),greatest(_tip_cents,0),greatest(_couvert_cents,0),v_staff)
  RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto inválido ou inativo.'; END IF;
    v_qty := coalesce((v_item->>'quantity')::numeric, 1);
    IF v_qty <= 0 OR v_qty > 1000 THEN RAISE EXCEPTION 'Quantidade inválida.'; END IF;
    v_unit_price := coalesce((v_item->>'unit_price_cents')::integer, v_product.current_sale_price_cents);
    v_unit_cost := coalesce((v_item->>'unit_cost_cents')::integer, v_product.current_cost_cents);
    IF v_unit_price < 0 OR v_unit_cost < 0 THEN RAISE EXCEPTION 'Preço e custo não podem ser negativos.'; END IF;

    v_gross := round(v_unit_price * v_qty)::bigint;
    v_discount := 0;
    v_product_allowed := false;
    IF v_qr.purpose = 'redemption' AND NOT v_discount_applied AND v_product.discount_eligible THEN
      v_product_allowed :=
        (v_campaign.product_id IS NULL AND nullif(v_campaign.product_category,'') IS NULL)
        OR v_campaign.product_id = v_product.id
        OR v_campaign.product_category = v_product.category
        OR EXISTS (SELECT 1 FROM public.campaign_products cp WHERE cp.campaign_id = v_campaign.id AND cp.product_id = v_product.id);
      IF v_product_allowed THEN
        v_discount_base := CASE WHEN v_campaign.eligible_quantity_mode = 'all_units'
          THEN v_gross ELSE least(v_gross, v_unit_price::bigint) END;
        IF v_campaign.discount_type = 'percent' OR v_campaign.discount_percent IS NOT NULL THEN
          v_discount := floor(v_discount_base * coalesce(v_campaign.discount_percent, v_campaign.discount_value, 0) / 100)::bigint;
        ELSIF v_campaign.discount_type = 'fixed' OR v_campaign.fixed_off_cents IS NOT NULL THEN
          v_discount := coalesce(v_campaign.fixed_off_cents, round(coalesce(v_campaign.discount_value,0) * 100)::integer);
        ELSE
          v_discount := 0;
        END IF;
        v_discount := least(v_discount, v_gross);
        IF v_campaign.discount_max_cents IS NOT NULL THEN v_discount := least(v_discount, v_campaign.discount_max_cents); END IF;
        IF v_product.max_discount_cents IS NOT NULL THEN v_discount := least(v_discount, v_product.max_discount_cents); END IF;
        v_discount := greatest(v_discount, 0);
        v_discount_applied := true;
      END IF;
    END IF;

    v_net := greatest(v_gross - v_discount, 0);
    v_margin := v_net - round(v_unit_cost * v_qty)::bigint;
    IF v_first_product IS NULL THEN v_first_product := v_product.id; END IF;

    INSERT INTO public.sale_items(
      sale_id,product_id,quantity,catalog_sale_price_cents,unit_sale_price_cents,unit_cost_snapshot_cents,
      gross_value_cents,discount_type,configured_discount_value,discount_real_cents,net_paid_cents,
      estimated_margin_cents,campaign_id,reward_id,eligible_for_funnel,counts_for_fofocometro,status)
    VALUES(
      v_sale_id,v_product.id,v_qty,v_product.current_sale_price_cents,v_unit_price,v_unit_cost,
      v_gross,CASE WHEN v_discount > 0 THEN v_campaign.discount_type ELSE NULL END,
      CASE WHEN v_discount > 0 THEN v_campaign.discount_value ELSE NULL END,v_discount,v_net,v_margin,
      CASE WHEN v_discount > 0 THEN v_campaign.id ELSE NULL END,
      CASE WHEN v_discount > 0 THEN v_reward.id ELSE NULL END,
      v_product.counts_for_funnel,v_product.counts_for_fofocometro,'confirmed');

    v_gross_total := v_gross_total + v_gross;
    v_discount_total := v_discount_total + v_discount;
    v_net_total := v_net_total + v_net;
    IF v_product.counts_for_funnel THEN v_funnel_net_total := v_funnel_net_total + v_net; END IF;
    v_cost_total := v_cost_total + round(v_unit_cost * v_qty)::bigint;
    v_margin_total := v_margin_total + v_margin;
  END LOOP;

  IF v_qr.purpose = 'redemption' AND NOT v_discount_applied AND
     (v_campaign.discount_type IN ('percent','fixed') OR v_campaign.discount_percent IS NOT NULL OR v_campaign.fixed_off_cents IS NOT NULL) THEN
    RAISE EXCEPTION 'Nenhum produto desta compra participa da Fofoquinha.';
  END IF;

  UPDATE public.sales SET
    gross_total_cents = v_gross_total,
    discount_total_cents = v_discount_total,
    net_total_cents = v_net_total,
    funnel_eligible_net_cents = v_funnel_net_total,
    cost_total_cents = v_cost_total,
    margin_total_cents = v_margin_total,
    updated_at = now()
  WHERE id = v_sale_id;

  UPDATE public.qr_tokens SET used_at = now(), used_by = v_staff WHERE token = v_qr.token;

  IF v_qr.purpose = 'redemption' THEN
    INSERT INTO public.reward_redemptions(reward_id,user_id,staff_id,notes)
    VALUES(v_reward.id,v_user,v_staff,'Venda ' || v_sale_id::text)
    ON CONFLICT (reward_id) DO NOTHING RETURNING id INTO v_redemption_id;
    IF v_redemption_id IS NULL THEN RAISE EXCEPTION 'Essa Fofoquinha já foi usada.'; END IF;
    UPDATE public.user_rewards SET status = 'redeemed', used_at = now(), updated_at = now() WHERE id = v_reward.id;
    UPDATE public.campaigns SET used_count = used_count + 1, updated_at = now() WHERE id = v_campaign.id;
    UPDATE public.profiles SET last_reward_at = now() WHERE id = v_user;

    IF v_campaign.counts_for_fofocometro THEN
      SELECT * INTO v_goal FROM public.collective_goals
      WHERE event_id = _event_id AND status IN ('scheduled','active')
        AND (campaign_id IS NULL OR campaign_id = v_campaign.id)
      ORDER BY stage_order LIMIT 1 FOR UPDATE;
      IF FOUND THEN
        UPDATE public.collective_goals SET status = 'active', starts_at = coalesce(starts_at, now()) WHERE id = v_goal.id;
        INSERT INTO public.collective_goal_contributions(
          goal_id,event_id,user_id,reward_redemption_id,sale_id,product_id,
          gross_cents,discount_cents,net_cents,cost_cents,margin_cents)
        VALUES(v_goal.id,_event_id,v_user,v_redemption_id,v_sale_id,v_first_product,
          v_gross_total,v_discount_total,v_net_total,v_cost_total,v_margin_total)
        ON CONFLICT (goal_id,reward_redemption_id) DO NOTHING;
        UPDATE public.collective_goals g SET
          current_count = (SELECT count(*) FROM public.collective_goal_contributions c WHERE c.goal_id = g.id),
          status = CASE WHEN (SELECT count(*) FROM public.collective_goal_contributions c WHERE c.goal_id = g.id) >= g.target_count THEN 'completed' ELSE 'active' END,
          completed_at = CASE WHEN (SELECT count(*) FROM public.collective_goal_contributions c WHERE c.goal_id = g.id) >= g.target_count THEN coalesce(g.completed_at, now()) ELSE NULL END,
          updated_at = now()
        WHERE g.id = v_goal.id;
      END IF;
    END IF;
  END IF;

  PERFORM public.recalculate_customer_event_session(v_session_id);
  PERFORM public.refresh_customer_funnel(v_user, _event_id);

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,details)
  VALUES(v_staff,'sale_recorded','sale',v_sale_id::text,jsonb_build_object(
    'user_id',v_user,'event_id',_event_id,'gross_cents',v_gross_total,
    'discount_cents',v_discount_total,'net_cents',v_net_total,'net_funnel_cents',v_funnel_net_total,'margin_cents',v_margin_total));

  RETURN jsonb_build_object(
    'ok',true,'sale_id',v_sale_id,'user_id',v_user,
    'gross_cents',v_gross_total,'discount_cents',v_discount_total,
    'net_cents',v_net_total,'funnel_net_cents',v_funnel_net_total,'cost_cents',v_cost_total,'margin_cents',v_margin_total,
    'reward_redeemed',v_qr.purpose = 'redemption'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_change_sale_status(
  _sale_id uuid,
  _status text,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_sale public.sales%ROWTYPE;
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor, 'admin') THEN RAISE EXCEPTION 'Acesso restrito à administração.'; END IF;
  IF _status NOT IN ('confirmed','cancelled','refunded') THEN RAISE EXCEPTION 'Status inválido.'; END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada.'; END IF;
  UPDATE public.sales SET status = _status,
    cancelled_at = CASE WHEN _status = 'cancelled' THEN now() ELSE NULL END,
    refunded_at = CASE WHEN _status = 'refunded' THEN now() ELSE NULL END,
    cancellation_reason = _reason,
    updated_at = now()
  WHERE id = _sale_id;
  UPDATE public.sale_items SET status = _status WHERE sale_id = _sale_id;
  PERFORM public.recalculate_customer_event_session(v_sale.session_id);
  PERFORM public.refresh_customer_funnel(v_sale.user_id, v_sale.event_id);
  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,details)
  VALUES(v_actor,'sale_status_changed','sale',_sale_id::text,jsonb_build_object('status',_status,'reason',_reason));
  RETURN jsonb_build_object('ok',true,'sale_id',_sale_id,'status',_status);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_change_sale_status(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_change_sale_status(uuid,text,text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Jornada do cliente, avaliações, salves e Fofocômetro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_my_reward_statuses()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid(); v_count integer;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  UPDATE public.user_rewards
  SET status='expired',updated_at=now()
  WHERE user_id=v_user AND status='available'
    AND ((expires_at IS NOT NULL AND expires_at<=now())
      OR (activated_at IS NOT NULL AND activation_expires_at IS NOT NULL AND activation_expires_at<=now()));
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_my_reward_statuses() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_my_reward_statuses() TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.my_fofoquinhas();
CREATE FUNCTION public.my_fofoquinhas()
RETURNS TABLE(
  campaign_id uuid,
  name text,
  description text,
  benefit_type text,
  discount_percent numeric,
  fixed_off_cents integer,
  product_name text,
  public_rules text,
  campaign_kind text,
  trigger_type text,
  trigger_target integer,
  progress_value integer,
  completed boolean,
  reward_id uuid,
  reward_status text,
  reward_expires_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  is_pinned boolean,
  feed_priority integer,
  public_title text,
  public_copy text,
  product_id uuid,
  product_category text,
  activation_expires_at timestamptz,
  visit_scope text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  PERFORM public.refresh_user_milestone_rewards(v_user);
  PERFORM public.refresh_my_reward_statuses();
  RETURN QUERY
  SELECT
    c.id,
    coalesce(c.public_title,c.name),
    coalesce(c.public_copy,c.description),
    c.benefit_type,
    c.discount_percent,
    c.fixed_off_cents,
    coalesce(p.original_name,c.product_name),
    c.public_rules,
    c.campaign_kind,
    c.trigger_type,
    c.trigger_target,
    coalesce(cp.progress_value,0),
    coalesce(cp.completed,false),
    r.id,
    r.status,
    r.expires_at,
    c.starts_at,
    c.ends_at,
    c.is_pinned,
    c.feed_priority,
    coalesce(c.public_title,c.name),
    coalesce(c.public_copy,c.description),
    c.product_id,
    c.product_category,
    r.activation_expires_at,
    coalesce(r.visit_scope,c.visit_scope)
  FROM public.campaigns c
  LEFT JOIN public.products p ON p.id=c.product_id
  LEFT JOIN LATERAL public.campaign_progress_for_user(v_user,c.id) cp ON true
  LEFT JOIN LATERAL (
    SELECT ur.id,ur.status,ur.expires_at,ur.activation_expires_at,ur.visit_scope
    FROM public.user_rewards ur
    WHERE ur.user_id=v_user AND ur.campaign_id=c.id AND ur.status<>'revoked'
    ORDER BY ur.created_at DESC LIMIT 1
  ) r ON true
  WHERE c.status='active' AND c.feed_visible
    AND c.starts_at<=now() AND (c.ends_at IS NULL OR c.ends_at>=now() OR r.id IS NOT NULL)
    AND (c.campaign_kind<>'funnel' OR r.id IS NOT NULL)
  ORDER BY (r.status='available') DESC,c.is_pinned DESC,c.feed_priority DESC,c.starts_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.my_fofoquinhas() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_fofoquinhas() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_event_journey()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_session public.customer_event_sessions%ROWTYPE;
  v_next_stage record;
  v_pending_review record;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  PERFORM public.sync_event_statuses();
  SELECT * INTO v_event FROM public.events
  WHERE status = 'ongoing' AND starts_at <= now() AND coalesce(ends_at, starts_at + interval '8 hours') >= now()
  ORDER BY starts_at LIMIT 1;
  IF FOUND THEN
    SELECT * INTO v_session FROM public.customer_event_sessions
    WHERE user_id = v_user AND event_id = v_event.id;
  END IF;

  IF v_session.id IS NOT NULL THEN
    SELECT fs.stage_order, fs.trigger_type, fs.threshold_cents, fs.title, fs.progress_copy, fs.unlocked_copy,
      (efp.id IS NOT NULL AND efp.reversed_at IS NULL) AS completed
    INTO v_next_stage
    FROM public.event_funnel_rules fr
    JOIN public.funnel_stages fs ON fs.rule_id = fr.id AND fs.active
    LEFT JOIN public.event_funnel_progress efp ON efp.session_id = v_session.id AND efp.stage_id = fs.id
    WHERE fr.active AND (fr.event_id = v_event.id OR fr.event_id IS NULL)
      AND (efp.id IS NULL OR efp.reversed_at IS NOT NULL)
    ORDER BY (fr.event_id IS NOT NULL) DESC, fs.stage_order LIMIT 1;
  END IF;

  SELECT e.id, e.name, e.ends_at
  INTO v_pending_review
  FROM public.checkins c
  JOIN public.events e ON e.id = c.event_id
  LEFT JOIN public.event_reviews r ON r.user_id = c.user_id AND r.event_id = c.event_id
  WHERE c.user_id = v_user AND e.status = 'ended' AND r.id IS NULL
  ORDER BY e.ends_at DESC NULLS LAST, e.starts_at DESC LIMIT 1;

  RETURN jsonb_build_object(
    'event', CASE WHEN v_event.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_event.id,'name',v_event.name,'starts_at',v_event.starts_at,'ends_at',v_event.ends_at,
      'chat_enabled',v_event.chat_enabled,'checkin_enabled',v_event.checkin_enabled) END,
    'checked_in', v_session.checkin_id IS NOT NULL,
    'session', CASE WHEN v_session.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',v_session.id,'gross_total_cents',v_session.gross_total_cents,
      'discount_total_cents',v_session.discount_total_cents,'net_total_cents',v_session.net_total_cents,
      'funnel_net_total_cents',v_session.funnel_net_total_cents,'cost_total_cents',v_session.cost_total_cents,'margin_total_cents',v_session.margin_total_cents,
      'current_stage',v_session.current_stage) END,
    'next_stage', CASE WHEN v_next_stage.stage_order IS NULL THEN NULL ELSE jsonb_build_object(
      'stage_order',v_next_stage.stage_order,'trigger_type',v_next_stage.trigger_type,
      'threshold_cents',v_next_stage.threshold_cents,'title',v_next_stage.title,
      'progress_copy',v_next_stage.progress_copy,'unlocked_copy',v_next_stage.unlocked_copy,
      'completed',v_next_stage.completed) END,
    'pending_review', CASE WHEN v_pending_review.id IS NULL THEN NULL ELSE jsonb_build_object(
      'event_id',v_pending_review.id,'event_name',v_pending_review.name,'ended_at',v_pending_review.ends_at) END
  );
END;
$$;
REVOKE ALL ON FUNCTION public.my_event_journey() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_event_journey() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.submit_event_review(
  _event_id uuid,
  _rating integer,
  _service_rating integer DEFAULT NULL,
  _music_rating integer DEFAULT NULL,
  _atmosphere_rating integer DEFAULT NULL,
  _comment text DEFAULT NULL,
  _would_return boolean DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF _rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'Escolha uma nota de 1 a 5.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.checkins WHERE user_id = v_user AND event_id = _event_id) THEN
    RAISE EXCEPTION 'A avaliação está disponível para quem fez check-in no evento.';
  END IF;
  INSERT INTO public.event_reviews(user_id,event_id,rating,service_rating,music_rating,atmosphere_rating,comment,would_return)
  VALUES(v_user,_event_id,_rating,_service_rating,_music_rating,_atmosphere_rating,nullif(trim(_comment),''),_would_return)
  ON CONFLICT(user_id,event_id) DO UPDATE SET
    rating=EXCLUDED.rating,service_rating=EXCLUDED.service_rating,music_rating=EXCLUDED.music_rating,
    atmosphere_rating=EXCLUDED.atmosphere_rating,comment=EXCLUDED.comment,would_return=EXCLUDED.would_return,updated_at=now();
  UPDATE public.profiles SET last_review_at = now() WHERE id = v_user;
  PERFORM public.refresh_profile_crm(v_user);
  RETURN jsonb_build_object('ok',true);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_event_review(uuid,integer,integer,integer,integer,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_event_review(uuid,integer,integer,integer,integer,text,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_salve_request(_event_id uuid, _recipient_id uuid, _opener text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
  IF v_user = _recipient_id THEN RAISE EXCEPTION 'Você não pode mandar um salve para si.'; END IF;
  IF NOT public.can_access_event_chat(v_user, _event_id)
     OR NOT EXISTS (SELECT 1 FROM public.checkins c WHERE c.user_id = _recipient_id AND c.event_id = _event_id) THEN
    RAISE EXCEPTION 'O salve só pode ser enviado entre participantes da Resenha deste evento.';
  END IF;
  IF public.is_event_chat_blocked(v_user,_recipient_id) THEN
    RAISE EXCEPTION 'Não é possível enviar este salve.';
  END IF;
  INSERT INTO public.salve_requests(event_id,sender_id,recipient_id,opener)
  VALUES(_event_id,v_user,_recipient_id,nullif(trim(_opener),''))
  ON CONFLICT (event_id,sender_id,recipient_id) WHERE status='pending'
  DO UPDATE SET opener=EXCLUDED.opener,created_at=now(),expires_at=now()+interval '24 hours'
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('ok',true,'request_id',v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.send_salve_request(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_salve_request(uuid,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.respond_salve_request(_request_id uuid, _accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid(); v_request public.salve_requests%ROWTYPE; v_thread uuid;
BEGIN
  SELECT * INTO v_request FROM public.salve_requests WHERE id=_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.recipient_id <> v_user THEN RAISE EXCEPTION 'Solicitação não encontrada.'; END IF;
  IF v_request.status <> 'pending' OR v_request.expires_at <= now() THEN RAISE EXCEPTION 'Este salve não está mais disponível.'; END IF;
  UPDATE public.salve_requests SET status=CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,responded_at=now() WHERE id=_request_id;
  IF _accept THEN
    INSERT INTO public.private_chat_threads(event_id,salve_request_id,member_one_id,member_two_id)
    VALUES(
      v_request.event_id,
      v_request.id,
      CASE WHEN v_request.sender_id::text < v_request.recipient_id::text THEN v_request.sender_id ELSE v_request.recipient_id END,
      CASE WHEN v_request.sender_id::text < v_request.recipient_id::text THEN v_request.recipient_id ELSE v_request.sender_id END
    )
    ON CONFLICT(salve_request_id) DO UPDATE SET status='active',updated_at=now()
    RETURNING id INTO v_thread;
  END IF;
  RETURN jsonb_build_object('ok',true,'accepted',_accept,'thread_id',v_thread);
END;
$$;
REVOKE ALL ON FUNCTION public.respond_salve_request(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.respond_salve_request(uuid,boolean) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.send_private_message(_thread_id uuid, _body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_user uuid := auth.uid(); v_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.private_chat_threads t WHERE t.id=_thread_id AND t.status='active' AND v_user IN (t.member_one_id,t.member_two_id)) THEN
    RAISE EXCEPTION 'Conversa indisponível.';
  END IF;
  INSERT INTO public.private_chat_messages(thread_id,sender_id,body)
  VALUES(_thread_id,v_user,trim(_body)) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.send_private_message(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_private_message(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.event_fofocometro(_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',g.id,'name',g.name,'stage_order',g.stage_order,'target_count',g.target_count,
    'current_count',g.current_count,'status',g.status,'starts_at',g.starts_at,
    'completed_at',g.completed_at,'reward_description',g.reward_description
  ) ORDER BY g.stage_order),'[]'::jsonb)
  FROM public.collective_goals g
  WHERE g.event_id=_event_id AND g.status IN ('scheduled','active','completed')
$$;
REVOKE ALL ON FUNCTION public.event_fofocometro(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.event_fofocometro(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_configure_event_funnel(
  _event_id uuid,
  _config jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_rule_id uuid;
  v_stage1_campaign uuid;
  v_stage2_campaign uuid;
  v_stage3_campaign uuid;
  v_stage1_threshold integer := 0;
  v_stage2_threshold integer := greatest(coalesce((_config->>'stage2_threshold_cents')::integer,5000),0);
  v_stage3_threshold integer := greatest(coalesce((_config->>'stage3_threshold_cents')::integer,10000),0);
  v_stage1_percent numeric := greatest(coalesce((_config->>'stage1_discount_percent')::numeric,20),0);
  v_stage2_percent numeric := greatest(coalesce((_config->>'stage2_discount_percent')::numeric,30),0);
  v_stage3_percent numeric := greatest(coalesce((_config->>'stage3_discount_percent')::numeric,20),0);
  v_stage1_max integer := greatest(coalesce((_config->>'stage1_max_discount_cents')::integer,1000),0);
  v_stage2_max integer := greatest(coalesce((_config->>'stage2_max_discount_cents')::integer,1500),0);
  v_stage3_max integer := greatest(coalesce((_config->>'stage3_max_discount_cents')::integer,1000),0);
  v_product_id uuid := nullif(_config->>'product_id','')::uuid;
  v_product_category text := nullif(trim(_config->>'product_category'),'');
  v_activation integer := greatest(coalesce((_config->>'activation_window_minutes')::integer,60),1);
  v_use integer := greatest(coalesce((_config->>'redemption_window_minutes')::integer,20),1);
  v_future_hours integer := greatest(coalesce((_config->>'future_reward_valid_hours')::integer,168),1);
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Acesso restrito à administração.'; END IF;
  SELECT * INTO v_event FROM public.events WHERE id=_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado.'; END IF;
  IF v_stage3_threshold <= v_stage2_threshold THEN RAISE EXCEPTION 'O terceiro marco precisa ser maior que o segundo.'; END IF;

  SELECT id INTO v_rule_id FROM public.event_funnel_rules WHERE event_id=_event_id AND active LIMIT 1 FOR UPDATE;
  IF v_rule_id IS NULL THEN
    INSERT INTO public.event_funnel_rules(event_id,name,active,starts_at,ends_at,created_by)
    VALUES(_event_id,'Funil progressivo de '||v_event.name,true,v_event.starts_at,v_event.ends_at,v_actor)
    RETURNING id INTO v_rule_id;
  ELSE
    UPDATE public.event_funnel_rules SET name='Funil progressivo de '||v_event.name,starts_at=v_event.starts_at,ends_at=v_event.ends_at,updated_at=now()
    WHERE id=v_rule_id;
  END IF;

  SELECT id INTO v_stage1_campaign FROM public.campaigns
  WHERE event_id=_event_id AND campaign_kind='funnel' AND progression_rule->>'stage_key'='checkin' LIMIT 1 FOR UPDATE;
  IF v_stage1_campaign IS NULL THEN
    INSERT INTO public.campaigns(
      name,public_title,description,public_copy,benefit_type,discount_percent,discount_max_cents,
      product_id,product_category,event_id,starts_at,ends_at,reward_valid_hours,total_available,
      per_user_limit,requires_checkin,requires_staff_validation,status,campaign_kind,trigger_type,
      trigger_target,feed_priority,is_pinned,feed_visible,activation_window_minutes,
      redemption_window_minutes,visit_scope,counts_for_funnel,progression_rule,discount_type,discount_value)
    VALUES(
      'Funil 01 | Chegou e já tem fofoca','CHEGOU E JÁ TEM FOFOCA',
      'Desconto liberado pelo check-in.','Seu check-in liberou uma vantagem no primeiro item participante da noite.',
      'discount',v_stage1_percent,v_stage1_max,v_product_id,v_product_category,_event_id,
      coalesce(v_event.checkin_opens_at,v_event.starts_at-interval '2 hours'),coalesce(v_event.ends_at,v_event.starts_at+interval '8 hours'),
      12,NULL,1,true,false,'active','funnel','none',1,300,true,true,v_activation,v_use,'current',true,
      jsonb_build_object('stage_key','checkin','stage_order',1),'percent',v_stage1_percent)
    RETURNING id INTO v_stage1_campaign;
  ELSE
    UPDATE public.campaigns SET discount_percent=v_stage1_percent,discount_max_cents=v_stage1_max,
      product_id=v_product_id,product_category=v_product_category,activation_window_minutes=v_activation,
      redemption_window_minutes=v_use,starts_at=coalesce(v_event.checkin_opens_at,v_event.starts_at-interval '2 hours'),
      ends_at=coalesce(v_event.ends_at,v_event.starts_at+interval '8 hours'),status='active',updated_at=now()
    WHERE id=v_stage1_campaign;
  END IF;

  SELECT id INTO v_stage2_campaign FROM public.campaigns
  WHERE event_id=_event_id AND campaign_kind='funnel' AND progression_rule->>'stage_key'='net_50' LIMIT 1 FOR UPDATE;
  IF v_stage2_campaign IS NULL THEN
    INSERT INTO public.campaigns(
      name,public_title,description,public_copy,benefit_type,discount_percent,discount_max_cents,
      product_id,product_category,event_id,starts_at,ends_at,reward_valid_hours,total_available,
      per_user_limit,requires_checkin,requires_staff_validation,status,campaign_kind,trigger_type,
      trigger_target,feed_priority,is_pinned,feed_visible,activation_window_minutes,
      redemption_window_minutes,visit_scope,counts_for_funnel,progression_rule,discount_type,discount_value)
    VALUES(
      'Funil 02 | Babado Forte','DESBLOQUEOU UM BABADO FORTE',
      'Vantagem liberada pelo consumo líquido.','Seu consumo liberou uma vantagem no próximo item participante.',
      'discount',v_stage2_percent,v_stage2_max,v_product_id,v_product_category,_event_id,
      v_event.starts_at,coalesce(v_event.ends_at,v_event.starts_at+interval '8 hours'),12,NULL,1,true,false,
      'active','funnel','none',1,290,false,true,v_activation,v_use,'current',true,
      jsonb_build_object('stage_key','net_50','stage_order',2,'threshold_cents',v_stage2_threshold),'percent',v_stage2_percent)
    RETURNING id INTO v_stage2_campaign;
  ELSE
    UPDATE public.campaigns SET discount_percent=v_stage2_percent,discount_max_cents=v_stage2_max,
      product_id=v_product_id,product_category=v_product_category,activation_window_minutes=v_activation,
      redemption_window_minutes=v_use,starts_at=v_event.starts_at,ends_at=coalesce(v_event.ends_at,v_event.starts_at+interval '8 hours'),
      progression_rule=jsonb_build_object('stage_key','net_50','stage_order',2,'threshold_cents',v_stage2_threshold),status='active',updated_at=now()
    WHERE id=v_stage2_campaign;
  END IF;

  SELECT id INTO v_stage3_campaign FROM public.campaigns
  WHERE event_id=_event_id AND campaign_kind='funnel' AND progression_rule->>'stage_key'='net_100' LIMIT 1 FOR UPDATE;
  IF v_stage3_campaign IS NULL THEN
    INSERT INTO public.campaigns(
      name,public_title,description,public_copy,benefit_type,discount_percent,discount_max_cents,
      product_id,product_category,event_id,starts_at,ends_at,reward_valid_hours,total_available,
      per_user_limit,requires_checkin,requires_staff_validation,status,campaign_kind,trigger_type,
      trigger_target,feed_priority,is_pinned,feed_visible,activation_window_minutes,
      redemption_window_minutes,visit_scope,counts_for_funnel,progression_rule,discount_type,discount_value)
    VALUES(
      'Funil 03 | Próximo encontro','VOCÊ FEZ A FOFOCA RENDER',
      'Vantagem guardada para o retorno.','Tem uma Fofoquinha guardada para sua próxima visita ao Bafas.',
      'discount',v_stage3_percent,v_stage3_max,v_product_id,v_product_category,_event_id,
      v_event.starts_at,coalesce(v_event.ends_at,v_event.starts_at+interval '8 hours'),v_future_hours,NULL,1,true,false,
      'active','funnel','none',1,280,false,true,v_activation,v_use,'future',true,
      jsonb_build_object('stage_key','net_100','stage_order',3,'threshold_cents',v_stage3_threshold),'percent',v_stage3_percent)
    RETURNING id INTO v_stage3_campaign;
  ELSE
    UPDATE public.campaigns SET discount_percent=v_stage3_percent,discount_max_cents=v_stage3_max,
      product_id=v_product_id,product_category=v_product_category,reward_valid_hours=v_future_hours,
      activation_window_minutes=v_activation,redemption_window_minutes=v_use,
      progression_rule=jsonb_build_object('stage_key','net_100','stage_order',3,'threshold_cents',v_stage3_threshold),
      visit_scope='future',status='active',updated_at=now()
    WHERE id=v_stage3_campaign;
  END IF;

  INSERT INTO public.funnel_stages(rule_id,stage_order,trigger_type,threshold_cents,reward_campaign_id,title,progress_copy,unlocked_copy,active)
  VALUES
    (v_rule_id,1,'checkin',v_stage1_threshold,v_stage1_campaign,'Chegou e já tem fofoca','Confirme sua presença para abrir a primeira vantagem.','Seu check-in liberou a primeira Fofoquinha.',true),
    (v_rule_id,2,'net_spend',v_stage2_threshold,v_stage2_campaign,'A fofoca tá crescendo','Acompanhe seu consumo líquido até o Babado Forte.','Seu consumo liberou um Babado Forte.',true),
    (v_rule_id,3,'net_spend',v_stage3_threshold,v_stage3_campaign,'Faça a fofoca render','Mais um pouco e tem vantagem guardada para o retorno.','Sua próxima visita já ganhou Fofoquinha.',true)
  ON CONFLICT(rule_id,stage_order) DO UPDATE SET
    trigger_type=EXCLUDED.trigger_type,threshold_cents=EXCLUDED.threshold_cents,
    reward_campaign_id=EXCLUDED.reward_campaign_id,title=EXCLUDED.title,
    progress_copy=EXCLUDED.progress_copy,unlocked_copy=EXCLUDED.unlocked_copy,active=true,updated_at=now();

  INSERT INTO public.audit_logs(actor_id,action,entity,entity_id,details)
  VALUES(v_actor,'event_funnel_configured','event',_event_id::text,jsonb_build_object(
    'rule_id',v_rule_id,'stage2_threshold_cents',v_stage2_threshold,'stage3_threshold_cents',v_stage3_threshold));

  RETURN jsonb_build_object('ok',true,'rule_id',v_rule_id,'campaigns',jsonb_build_array(v_stage1_campaign,v_stage2_campaign,v_stage3_campaign));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_configure_event_funnel(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_configure_event_funnel(uuid,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_commercial_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.has_role(v_actor,'admin') THEN RAISE EXCEPTION 'Acesso restrito à administração.'; END IF;
  RETURN jsonb_build_object(
    'customers', (SELECT count(*) FROM public.profiles WHERE deleted_at IS NULL),
    'checkins', (SELECT count(*) FROM public.checkins),
    'sales', (SELECT count(*) FROM public.sales WHERE status='confirmed'),
    'gross_cents', (SELECT coalesce(sum(gross_total_cents),0) FROM public.sales WHERE status='confirmed'),
    'discount_cents', (SELECT coalesce(sum(discount_total_cents),0) FROM public.sales WHERE status='confirmed'),
    'net_cents', (SELECT coalesce(sum(net_total_cents),0) FROM public.sales WHERE status='confirmed'),
    'cost_cents', (SELECT coalesce(sum(cost_total_cents),0) FROM public.sales WHERE status='confirmed'),
    'margin_cents', (SELECT coalesce(sum(margin_total_cents),0) FROM public.sales WHERE status='confirmed'),
    'fofoquinha_sales_margin_cents', (
      SELECT coalesce(sum(s.margin_total_cents),0)
      FROM public.sales s
      WHERE s.status='confirmed'
        AND EXISTS (SELECT 1 FROM public.sale_items si WHERE si.sale_id=s.id AND si.reward_id IS NOT NULL)
    ),
    'fofoquinha_addon_margin_cents', (
      SELECT coalesce(sum(si.estimated_margin_cents),0)
      FROM public.sale_items si
      JOIN public.sales s ON s.id=si.sale_id AND s.status='confirmed'
      WHERE si.status='confirmed'
        AND si.reward_id IS NULL
        AND EXISTS (SELECT 1 FROM public.sale_items promoted WHERE promoted.sale_id=si.sale_id AND promoted.reward_id IS NOT NULL)
    ),
    'margin_per_redeemed_reward_cents', (
      SELECT CASE WHEN count(DISTINCT rr.id)=0 THEN 0
        ELSE round(coalesce(sum(s.margin_total_cents),0)::numeric / count(DISTINCT rr.id))::bigint END
      FROM public.reward_redemptions rr
      JOIN public.user_rewards ur ON ur.id=rr.reward_id
      LEFT JOIN public.sale_items si ON si.reward_id=ur.id
      LEFT JOIN public.sales s ON s.id=si.sale_id AND s.status='confirmed'
    ),
    'reward_conversion', (SELECT jsonb_build_object(
      'granted',count(*),
      'redeemed',count(*) FILTER (WHERE status='redeemed'),
      'expired',count(*) FILTER (WHERE status='expired')
    ) FROM public.user_rewards),
    'segments', (SELECT coalesce(jsonb_object_agg(segment_key,total),'{}'::jsonb) FROM (
      SELECT segment_key,count(*) AS total FROM public.crm_segment_memberships WHERE active GROUP BY segment_key
    ) s),
    'stage_50', (SELECT count(DISTINCT session_id) FROM public.event_funnel_progress p JOIN public.funnel_stages s ON s.id=p.stage_id WHERE s.trigger_type='net_spend' AND s.threshold_cents=5000 AND p.reversed_at IS NULL),
    'stage_100', (SELECT count(DISTINCT session_id) FROM public.event_funnel_progress p JOIN public.funnel_stages s ON s.id=p.stage_id WHERE s.trigger_type='net_spend' AND s.threshold_cents=10000 AND p.reversed_at IS NULL)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_commercial_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_commercial_snapshot() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Autenticação por telefone compatível com o cadastro atual
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
  v_phone text;
  v_birth date;
  v_city text;
  v_over18 boolean;
  v_first text;
  v_last text;
BEGIN
  v_phone := coalesce(nullif(new.phone,''), nullif(new.raw_user_meta_data->>'phone_e164',''), nullif(new.raw_user_meta_data->>'whatsapp',''));
  v_display := coalesce(nullif(new.raw_user_meta_data->>'display_name',''), nullif(new.raw_user_meta_data->>'name',''),
    nullif(split_part(coalesce(new.email,''),'@',1),''), 'Bafafã');
  v_first := coalesce(nullif(new.raw_user_meta_data->>'first_name',''), split_part(v_display,' ',1));
  v_last := nullif(new.raw_user_meta_data->>'last_name','');
  v_username := nullif(new.raw_user_meta_data->>'username','');
  v_whatsapp := coalesce(nullif(new.raw_user_meta_data->>'whatsapp',''), v_phone);
  v_city := nullif(new.raw_user_meta_data->>'city','');
  v_over18 := coalesce((new.raw_user_meta_data->>'is_over_18')::boolean, false);
  BEGIN v_birth := (new.raw_user_meta_data->>'birth_date')::date; EXCEPTION WHEN others THEN v_birth := null; END;

  INSERT INTO public.profiles(id,display_name,first_name,last_name,username,whatsapp,phone_e164,phone_verified_at,birth_date,city,is_over_18)
  VALUES(new.id,v_display,v_first,v_last,v_username,v_whatsapp,v_phone,CASE WHEN new.phone_confirmed_at IS NOT NULL THEN new.phone_confirmed_at ELSE NULL END,v_birth,v_city,v_over18)
  ON CONFLICT(id) DO UPDATE SET
    display_name=coalesce(nullif(EXCLUDED.display_name,''),public.profiles.display_name),
    first_name=coalesce(EXCLUDED.first_name,public.profiles.first_name),
    last_name=coalesce(EXCLUDED.last_name,public.profiles.last_name),
    phone_e164=coalesce(EXCLUDED.phone_e164,public.profiles.phone_e164),
    phone_verified_at=coalesce(EXCLUDED.phone_verified_at,public.profiles.phone_verified_at),
    whatsapp=coalesce(EXCLUDED.whatsapp,public.profiles.whatsapp),
    birth_date=coalesce(EXCLUDED.birth_date,public.profiles.birth_date),
    is_over_18=public.profiles.is_over_18 OR EXCLUDED.is_over_18,
    updated_at=now();

  INSERT INTO public.user_preferences(user_id,marketing_opt_in,notify_whatsapp)
  VALUES(new.id,coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean,false),coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean,false))
  ON CONFLICT(user_id) DO NOTHING;
  INSERT INTO public.user_roles(user_id,role) VALUES(new.id,'gratuito') ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- 13. Atualiza sessões e CRM existentes
-- ---------------------------------------------------------------------------
INSERT INTO public.customer_event_sessions(user_id,event_id,checkin_id,entered_at)
SELECT c.user_id,c.event_id,c.id,c.created_at FROM public.checkins c
ON CONFLICT(user_id,event_id) DO UPDATE SET checkin_id=coalesce(public.customer_event_sessions.checkin_id,EXCLUDED.checkin_id);

DO $$
DECLARE v_user record;
BEGIN
  FOR v_user IN SELECT id FROM public.profiles WHERE deleted_at IS NULL LOOP
    PERFORM public.refresh_profile_crm(v_user.id);
  END LOOP;
  FOR v_user IN SELECT user_id, event_id FROM public.customer_event_sessions LOOP
    PERFORM public.refresh_customer_funnel(v_user.user_id, v_user.event_id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
