-- V20.7 — hardening inicial de RPCs críticas e integridade comercial.
--
-- Objetivos:
-- 1. sync_event_statuses exige service_role ou admin em AAL2.
-- 2. record_customer_sale deixa de confiar em preço, custo e origem enviados pelo cliente.
-- 3. A implementação comercial anterior fica interna e sem EXECUTE para papéis da API.
-- 4. Tentativas de adulteração geram security_events.

create or replace function public.sync_event_statuses()
returns integer
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_rows integer := 0;
  v_actor uuid := auth.uid();
  v_auth_role text := auth.role();
begin
  if v_auth_role is distinct from 'service_role' then
    if v_actor is null or not public.has_role(v_actor, 'admin') then
      raise exception 'Acesso restrito à administração.';
    end if;
  end if;

  update public.events e
  set status = public.event_status_from_schedule(e.status, e.starts_at, e.ends_at, now()),
      updated_at = now()
  where e.status not in ('draft', 'cancelled')
    and e.status is distinct from public.event_status_from_schedule(
      e.status,
      e.starts_at,
      e.ends_at,
      now()
    );

  get diagnostics v_rows = row_count;

  if v_actor is not null and v_rows > 0 then
    insert into public.audit_logs(actor_id, action, entity, details)
    values(
      v_actor,
      'event_statuses_synced',
      'event',
      jsonb_build_object('rows', v_rows)
    );
  end if;

  return v_rows;
end;
$function$;

revoke all on function public.sync_event_statuses() from public;
revoke all on function public.sync_event_statuses() from anon;
grant execute on function public.sync_event_statuses() to authenticated;
grant execute on function public.sync_event_statuses() to service_role;

-- A função anterior conserva a lógica transacional já validada, mas deixa de ser
-- um endpoint da API. A nova função pública abaixo atua como uma fronteira de
-- confiança e encaminha apenas dados sanitizados.
alter function public.record_customer_sale(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) rename to record_customer_sale_internal_v207;

revoke all on function public.record_customer_sale_internal_v207(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from public;
revoke all on function public.record_customer_sale_internal_v207(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from anon;
revoke all on function public.record_customer_sale_internal_v207(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from authenticated;
revoke all on function public.record_customer_sale_internal_v207(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from service_role;

create or replace function public.record_customer_sale(
  _event_id uuid,
  _items jsonb,
  _commercial_token text,
  _external_reference text default null::text,
  _source text default 'manual'::text,
  _service_fee_cents integer default 0,
  _tip_cents integer default 0,
  _couvert_cents integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_staff uuid := auth.uid();
  v_item jsonb;
  v_product_id uuid;
  v_catalog_price integer;
  v_catalog_cost integer;
  v_requested_price integer;
  v_requested_cost integer;
  v_sanitized_items jsonb := '[]'::jsonb;
  v_service_fee integer := coalesce(_service_fee_cents, 0);
  v_tip integer := coalesce(_tip_cents, 0);
  v_couvert integer := coalesce(_couvert_cents, 0);
begin
  if v_staff is null or not (
    public.has_role(v_staff, 'equipe')
    or public.has_role(v_staff, 'admin')
  ) then
    raise exception 'Acesso restrito à equipe.';
  end if;

  if coalesce(_source, 'manual') <> 'manual' then
    perform public.record_security_event(
      'high',
      'operations',
      'sale_source_tampering',
      'Tentativa de alterar a origem de uma venda manual',
      v_staff,
      null,
      'sale',
      null,
      jsonb_build_object(
        'requested_source', left(coalesce(_source, ''), 40)
      )
    );
    raise exception 'Origem de venda não permitida neste fluxo.';
  end if;

  if v_service_fee < 0
     or v_tip < 0
     or v_couvert < 0
     or v_service_fee > 100000
     or v_tip > 100000
     or v_couvert > 100000 then
    perform public.record_security_event(
      'high',
      'operations',
      'sale_fee_out_of_range',
      'Valores adicionais de venda fora do limite operacional',
      v_staff,
      null,
      'sale',
      null,
      jsonb_build_object(
        'service_fee_cents', v_service_fee,
        'tip_cents', v_tip,
        'couvert_cents', v_couvert
      )
    );
    raise exception 'Taxa, gorjeta ou couvert fora do limite permitido.';
  end if;

  if char_length(coalesce(_commercial_token, '')) > 200 then
    raise exception 'Código comercial inválido.';
  end if;

  if char_length(coalesce(_external_reference, '')) > 160 then
    raise exception 'Referência externa muito longa.';
  end if;

  if jsonb_typeof(_items) <> 'array'
     or jsonb_array_length(_items) = 0
     or jsonb_array_length(_items) > 100
     or octet_length(_items::text) > 100000 then
    raise exception 'Lista de produtos inválida.';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(_items)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Item de venda inválido.';
    end if;

    begin
      v_product_id := nullif(v_item ->> 'product_id', '')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'Produto inválido.';
    end;

    select
      p.current_sale_price_cents,
      p.current_cost_cents
    into
      v_catalog_price,
      v_catalog_cost
    from public.products p
    where p.id = v_product_id
      and p.active;

    if not found then
      raise exception 'Produto inválido ou inativo.';
    end if;

    begin
      v_requested_price := case
        when v_item ? 'unit_price_cents'
          then nullif(v_item ->> 'unit_price_cents', '')::integer
        else null
      end;

      v_requested_cost := case
        when v_item ? 'unit_cost_cents'
          then nullif(v_item ->> 'unit_cost_cents', '')::integer
        else null
      end;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        perform public.record_security_event(
          'high',
          'operations',
          'sale_catalog_tampering',
          'Tentativa de enviar preço ou custo inválido em uma venda',
          v_staff,
          null,
          'product',
          v_product_id::text,
          jsonb_build_object('reason', 'non_integer_value')
        );
        raise exception 'Os valores do produto são inválidos. Atualize a tela e tente novamente.';
    end;

    if (
      v_requested_price is not null
      and v_requested_price <> v_catalog_price
    ) or (
      v_requested_cost is not null
      and v_requested_cost <> v_catalog_cost
    ) then
      perform public.record_security_event(
        'high',
        'operations',
        'sale_catalog_tampering',
        'Tentativa de alterar preço ou custo de catálogo em uma venda',
        v_staff,
        null,
        'product',
        v_product_id::text,
        jsonb_build_object(
          'requested_unit_price_cents', v_requested_price,
          'catalog_unit_price_cents', v_catalog_price,
          'requested_unit_cost_cents', v_requested_cost,
          'catalog_unit_cost_cents', v_catalog_cost
        )
      );
      raise exception 'O preço ou custo do produto mudou. Atualize a tela e tente novamente.';
    end if;

    -- A função interna recebe somente produto, quantidade e demais metadados
    -- não financeiros. Ela volta a obter preço e custo do catálogo.
    v_sanitized_items := v_sanitized_items || jsonb_build_array(
      v_item - 'unit_price_cents' - 'unit_cost_cents'
    );
  end loop;

  return public.record_customer_sale_internal_v207(
    _event_id,
    v_sanitized_items,
    _commercial_token,
    _external_reference,
    'manual',
    v_service_fee,
    v_tip,
    v_couvert
  );
end;
$function$;

revoke all on function public.record_customer_sale(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from public;
revoke all on function public.record_customer_sale(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from anon;
revoke all on function public.record_customer_sale(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) from service_role;
grant execute on function public.record_customer_sale(
  uuid,
  jsonb,
  text,
  text,
  text,
  integer,
  integer,
  integer
) to authenticated;
