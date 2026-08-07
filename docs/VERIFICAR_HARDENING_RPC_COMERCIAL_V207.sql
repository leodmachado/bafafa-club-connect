-- Verificação objetiva — V20.7 hardening de RPCs e integridade comercial.
--
-- Execute no Supabase SQL Editor após a migration
-- 20260803143000_security_hardening_rpc_commercial_v207.sql.
--
-- O teste usa transação e ROLLBACK. Alterações temporárias de status e auditoria
-- feitas pelo teste positivo de sync_event_statuses não são persistidas.

begin;

do $verification$
declare
  v_admin uuid;
  v_denied boolean := false;
  v_sync_rows integer;
begin
  select ur.user_id
  into v_admin
  from public.user_roles ur
  where ur.role = 'admin'
  order by ur.user_id
  limit 1;

  if v_admin is null then
    raise exception 'Verificação V20.7 exige ao menos uma conta admin.';
  end if;

  -- Admin em AAL1 não pode sincronizar eventos.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'aal', 'aal1'
    )::text,
    true
  );

  begin
    perform public.sync_event_statuses();
  exception
    when others then
      if sqlerrm = 'Acesso restrito à administração.' then
        v_denied := true;
      else
        raise;
      end if;
  end;

  if not v_denied then
    raise exception 'Falha V20.7: admin em AAL1 conseguiu executar sync_event_statuses.';
  end if;

  -- A mesma conta em AAL1 deve ser barrada antes da validação dos itens da venda.
  v_denied := false;
  begin
    perform public.record_customer_sale(
      gen_random_uuid(),
      '[]'::jsonb,
      'teste-v207'
    );
  exception
    when others then
      if sqlerrm = 'Acesso restrito à equipe.' then
        v_denied := true;
      else
        raise;
      end if;
  end;

  if not v_denied then
    raise exception 'Falha V20.7: admin em AAL1 passou pelo bloqueio comercial.';
  end if;

  -- Admin em AAL2 atravessa o guard de autorização.
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'aal', 'aal2'
    )::text,
    true
  );

  v_sync_rows := public.sync_event_statuses();

  if v_sync_rows is null or v_sync_rows < 0 then
    raise exception 'Falha V20.7: retorno inválido em sync_event_statuses.';
  end if;

  -- Com AAL2, a função comercial deve ultrapassar o guard e chegar à validação
  -- dos itens. A lista vazia é usada para não criar venda durante o teste.
  v_denied := false;
  begin
    perform public.record_customer_sale(
      gen_random_uuid(),
      '[]'::jsonb,
      'teste-v207'
    );
  exception
    when others then
      if sqlerrm = 'Lista de produtos inválida.' then
        v_denied := true;
      else
        raise;
      end if;
  end;

  if not v_denied then
    raise exception 'Falha V20.7: teste positivo não alcançou a validação comercial.';
  end if;
end;
$verification$;

with checks as (
  select
    position(
      'has_role'
      in pg_get_functiondef('public.sync_event_statuses()'::regprocedure)
    ) > 0 as sync_exige_papel,

    position(
      'service_role'
      in pg_get_functiondef('public.sync_event_statuses()'::regprocedure)
    ) > 0 as sync_permite_rotina_interna,

    not has_function_privilege(
      'anon',
      'public.sync_event_statuses()',
      'EXECUTE'
    ) as anon_nao_sincroniza,

    position(
      'record_customer_sale_internal_v207'
      in pg_get_functiondef(
        'public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)'::regprocedure
      )
    ) > 0 as venda_usa_camada_interna,

    position(
      $needle$v_item - 'unit_price_cents' - 'unit_cost_cents'$needle$
      in pg_get_functiondef(
        'public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)'::regprocedure
      )
    ) > 0 as venda_remove_preco_custo_cliente,

    position(
      'sale_catalog_tampering'
      in pg_get_functiondef(
        'public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)'::regprocedure
      )
    ) > 0 as adulteracao_gera_evento,

    not has_function_privilege(
      'anon',
      'public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)',
      'EXECUTE'
    ) as anon_nao_registra_venda,

    has_function_privilege(
      'authenticated',
      'public.record_customer_sale(uuid,jsonb,text,text,text,integer,integer,integer)',
      'EXECUTE'
    ) as autenticado_chama_wrapper,

    not has_function_privilege(
      'authenticated',
      'public.record_customer_sale_internal_v207(uuid,jsonb,text,text,text,integer,integer,integer)',
      'EXECUTE'
    ) as autenticado_nao_chama_interna
)
select
  checks.*,
  true as teste_aal1_negativo_ok,
  true as teste_aal2_positivo_ok,
  (
    sync_exige_papel
    and sync_permite_rotina_interna
    and anon_nao_sincroniza
    and venda_usa_camada_interna
    and venda_remove_preco_custo_cliente
    and adulteracao_gera_evento
    and anon_nao_registra_venda
    and autenticado_chama_wrapper
    and autenticado_nao_chama_interna
  ) as verificacao_ok
from checks;

rollback;
