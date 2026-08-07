# Auditoria de Segurança V20.7 — Pacote 04

Data: 03/08/2026  
Branch: `codex/v20-7-hardening-rpc-comercial`  
Ambiente: Supabase `xijjohgokwfkqfkkhsyn`

## Escopo

Revisão de RLS e privilégios nas tabelas mais sensíveis:

- `profiles`;
- `user_roles`;
- `qr_tokens`;
- `user_rewards`;
- `reward_redemptions`;
- `sales`;
- `sale_items`;
- `checkins`;
- `user_consents`;
- `user_preferences`.

## SEC-007 — remoção do último administrador por UPDATE

Severidade original: ALTA.

A proteção existente cobria `DELETE` em `user_roles`, mas não cobria a mudança de um registro `admin` para outro papel usando `UPDATE`. Esse caminho também não produzia o evento específico de concessão/revogação privilegiada.

### Correção aplicada

Migration do repositório:

`supabase/migrations/20260803154500_user_roles_update_hardening_v207.sql`

Registro do Supabase:

`20260803150359 — user_roles_update_hardening_v207`

Controles:

- o trigger de proteção do administrador cobre `DELETE OR UPDATE`;
- o próprio administrador não pode remover seu papel por atualização;
- o último administrador não pode ser rebaixado por atualização;
- um registro de papel não pode ser transferido para outro `user_id`;
- `granted_by` passa a refletir o usuário que realizou a alteração;
- mudanças de papel por `UPDATE` geram eventos `privileged_role_revoked` e `privileged_role_granted`;
- o log administrativo geral permanece ativo.

Evidência:

- `admin_protection_covers_update = true`;
- `security_event_covers_update = true`;
- `role_row_transfer_blocked = true`;
- `last_admin_update_checked = true`;
- `revocation_event_present = true`;
- `grant_event_present = true`;
- `verificacao_ok = true`.

Status: CORRIGIDO E VALIDADO ESTRUTURALMENTE.

## SEC-008 — escrita direta em tabelas comerciais

Severidade: ALTA.

### Evidência

O papel `authenticated` ainda possui grants de escrita em:

- `qr_tokens`;
- `sales`;
- `sale_items`.

O RLS atual bloqueia a maioria dessas escritas por ausência de policy. Porém, `sales` possui a policy `Admins manage sales`, que permite `UPDATE` para administrador em `aal2`.

Como existe a RPC auditada `admin_change_sale_status()`, a escrita direta em `sales` permite contornar a fronteira prevista e modificar colunas como totais, custo, margem, usuário, origem ou metadados sem passar pela validação específica da RPC.

### Correção preparada, não aplicada

Migration candidata:

`supabase/migrations/20260803153000_sensitive_tables_least_privilege_v207.sql`

Verificação candidata:

`docs/VERIFICAR_SENSITIVE_TABLES_LEAST_PRIVILEGE_V207.sql`

A migration:

- remove acesso direto de `anon` a `qr_tokens`, `sales` e `sale_items`;
- transforma as três tabelas em leitura direta para `authenticated`;
- mantém escrita somente pelas RPCs `SECURITY DEFINER` controladas;
- preserva as policies de leitura por proprietário e por equipe.

O conector bloqueou a aplicação de alterações de grants em tabelas existentes. Nenhuma parte dessa migration foi executada no Supabase.

Status: VULNERABILIDADE CONFIRMADA — CORREÇÃO PREPARADA, APLICAÇÃO PELO SQL EDITOR PENDENTE.

## Observações favoráveis da revisão de RLS

### Perfis

- leitura limitada ao próprio usuário ou admin em `aal2`;
- atualização limitada ao próprio perfil;
- grants de UPDATE são por coluna;
- campos internos como `deleted_at`, `phone_verified_at`, métricas de visitas, consumo, recompensas e segmento não estão na lista de colunas editáveis pelo usuário.

Status: REVISÃO FAVORÁVEL.

### Check-ins, recompensas, resgates e consentimentos

- usuários leem apenas seus próprios registros;
- administração lê registros ampliados usando `has_role()`;
- não há grants diretos de escrita para `authenticated` nessas tabelas.

Status: REVISÃO FAVORÁVEL NESTA ETAPA.

### Preferências

A policy permite gestão do próprio registro, mas os grants atuais expõem apenas leitura direta; alterações são realizadas pela RPC `set_my_preferences()`.

Status: REVISÃO FAVORÁVEL; confirmar fluxo funcional no teste de regressão.

## Próximos passos

1. executar a migration de menor privilégio pelo SQL Editor;
2. confirmar `verificacao_ok = true`;
3. testar leitura de vendas e itens no frontend;
4. testar alteração de status pela RPC administrativa;
5. confirmar que UPDATE direto em `sales` retorna `permission denied`;
6. continuar revisão de produtos, campanhas e eventos, que também possuem policies administrativas amplas;
7. revisar funções que recebem IDs de outros usuários;
8. executar testes com tokens reais `aal1` e `aal2`.
