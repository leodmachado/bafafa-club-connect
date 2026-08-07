-- V20.7 — menor privilégio nas tabelas comerciais sensíveis.
--
-- Remove acessos diretos que não são necessários ao frontend. Operações de
-- escrita continuam disponíveis somente pelas RPCs SECURITY DEFINER que fazem
-- validação de papel, AAL2, consistência e auditoria.

-- Nenhuma destas tabelas possui uso público direto intencional.
revoke select, insert, update, delete, truncate, references, trigger, maintain
  on table public.qr_tokens, public.sales, public.sale_items
  from anon;

-- QR é criado/consumido pelas RPCs create_my_qr_token, validate_checkin_qr,
-- inspect_commercial_qr e fluxos comerciais. O cliente só precisa ler os seus.
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.qr_tokens from authenticated;
grant select on table public.qr_tokens to authenticated;

-- Vendas são registradas por record_customer_sale() e alteradas por
-- admin_change_sale_status(). Sem o grant UPDATE, a policy administrativa
-- existente não autoriza escrita direta e não contorna a auditoria da RPC.
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.sales from authenticated;
grant select on table public.sales to authenticated;

-- Itens de venda são derivados e só devem ser escritos pelo motor comercial.
revoke insert, update, delete, truncate, references, trigger, maintain
  on table public.sale_items from authenticated;
grant select on table public.sale_items to authenticated;
