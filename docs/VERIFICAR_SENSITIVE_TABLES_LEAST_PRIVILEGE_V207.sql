-- Verificação V20.7 — menor privilégio em tabelas comerciais sensíveis.
-- Somente leitura.

with function_state as (
  select
    has_function_privilege(
      'authenticated',
      'public.admin_change_sale_status(uuid,text,text)',
      'EXECUTE'
    ) as audited_status_rpc_available,
    position(
      'has_role' in pg_get_functiondef(
        'public.admin_change_sale_status(uuid,text,text)'::regprocedure
      )
    ) > 0 as audited_status_rpc_checks_role
), privilege_state as (
  select
    not has_table_privilege('anon', 'public.qr_tokens', 'SELECT')
      and not has_table_privilege('anon', 'public.sales', 'SELECT')
      and not has_table_privilege('anon', 'public.sale_items', 'SELECT')
      as anon_sensitive_access_removed,
    has_table_privilege('authenticated', 'public.qr_tokens', 'SELECT')
      and not has_table_privilege('authenticated', 'public.qr_tokens', 'INSERT')
      and not has_table_privilege('authenticated', 'public.qr_tokens', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.qr_tokens', 'DELETE')
      as qr_tokens_read_only,
    has_table_privilege('authenticated', 'public.sales', 'SELECT')
      and not has_table_privilege('authenticated', 'public.sales', 'INSERT')
      and not has_table_privilege('authenticated', 'public.sales', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.sales', 'DELETE')
      as sales_read_only,
    has_table_privilege('authenticated', 'public.sale_items', 'SELECT')
      and not has_table_privilege('authenticated', 'public.sale_items', 'INSERT')
      and not has_table_privilege('authenticated', 'public.sale_items', 'UPDATE')
      and not has_table_privilege('authenticated', 'public.sale_items', 'DELETE')
      as sale_items_read_only
)
select
  audited_status_rpc_available,
  audited_status_rpc_checks_role,
  anon_sensitive_access_removed,
  qr_tokens_read_only,
  sales_read_only,
  sale_items_read_only,
  audited_status_rpc_available
    and audited_status_rpc_checks_role
    and anon_sensitive_access_removed
    and qr_tokens_read_only
    and sales_read_only
    and sale_items_read_only as verificacao_ok
from function_state
cross join privilege_state;
