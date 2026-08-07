# Auditoria de Segurança V20.7 — Pacote 05

Data: 03/08/2026  
Branch: `codex/v20-7-hardening-rpc-comercial`  
Ambiente: Supabase `xijjohgokwfkqfkkhsyn`

## SEC-008 — escrita direta em tabelas comerciais

Severidade original: ALTA.

A migration `supabase/migrations/20260803153000_sensitive_tables_least_privilege_v207.sql` foi aplicada diretamente no Supabase.

Registro do Supabase:

`20260803164204 — sensitive_tables_least_privilege_v207`

## Controles aplicados

- `anon` perdeu acesso direto a `qr_tokens`, `sales` e `sale_items`;
- `authenticated` mantém somente leitura direta nessas três tabelas;
- criação e consumo de QR continuam pelas RPCs controladas;
- registro de vendas continua por `record_customer_sale()`;
- alteração administrativa de status continua por `admin_change_sale_status()`;
- escrita de itens continua restrita ao motor comercial;
- a policy administrativa de `sales` não consegue mais autorizar UPDATE direto porque o papel `authenticated` não possui o grant de UPDATE.

## Verificação

Arquivo executado:

`docs/VERIFICAR_SENSITIVE_TABLES_LEAST_PRIVILEGE_V207.sql`

Resultado:

- `audited_status_rpc_available = true`;
- `audited_status_rpc_checks_role = true`;
- `anon_sensitive_access_removed = true`;
- `qr_tokens_read_only = true`;
- `sales_read_only = true`;
- `sale_items_read_only = true`;
- `verificacao_ok = true`.

Status: CORRIGIDO E VALIDADO ESTRUTURALMENTE.

## Validação funcional ainda necessária

- registrar uma venda normal pelo aplicativo;
- alterar o status pela RPC administrativa;
- confirmar que tentativa de UPDATE direto em `sales` retorna `permission denied`;
- validar que leitura de vendas, itens e QR continua funcionando conforme as policies de proprietário e equipe.
