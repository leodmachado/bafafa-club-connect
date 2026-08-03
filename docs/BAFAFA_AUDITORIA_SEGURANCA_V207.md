# Bafafá Connect — Auditoria de Segurança V20.7

Status: EM ANDAMENTO  
Ambiente analisado: Supabase `xijjohgokwfkqfkkhsyn` e branch `codex/v20-6-bloqueio-2fa-admin`  
Regra: nenhuma promoção para produção enquanto houver bloqueador crítico ou alto sem tratamento.

## Objetivo

Avaliar autenticação, sessões, autorização, RLS, RPCs, funções `SECURITY DEFINER`, dados pessoais, integridade comercial, abuso do produto, dependências e configuração da infraestrutura.

## Método

Cada controle deve ter teste negativo e positivo:

- `anon` → somente operações públicas intencionais;
- usuário autenticado comum → apenas seus próprios dados e ações;
- conta privilegiada em `aal1` → negada;
- conta privilegiada em `aal2` → permitida conforme o papel;
- chamada direta da API → mesma decisão do aplicativo;
- `service_role` → somente rotinas internas autorizadas.

## Achados iniciais

### SEC-001 — Execução pública de funções `SECURITY DEFINER`

Severidade preliminar: MÉDIA, requer classificação individual.

O Supabase Security Advisor identificou funções executáveis por `anon`:

- `check_content_allowed(text,text)`;
- `event_fofocometro(uuid)`;
- `get_public_profile(text)`.

Essas funções parecem ligadas a funcionalidades públicas, mas devem ser revisadas quanto a enumeração, vazamento de dados, abuso, limites de chamada e necessidade real de `SECURITY DEFINER`.

Status: EM ANÁLISE.

### SEC-002 — `sync_event_statuses()` executável por qualquer usuário autenticado

Severidade preliminar: ALTA.

Evidência:

- função `SECURITY DEFINER`;
- possui `EXECUTE` para `authenticated`;
- não valida `auth.uid()`;
- não verifica papel;
- não exige `aal2`;
- executa `UPDATE` na tabela `events`.

Impacto potencial:

- qualquer conta autenticada pode provocar escrita administrativa;
- geração de carga e contenção por chamadas repetidas;
- alteração antecipada ou repetida de `updated_at` e estados calculados;
- quebra do princípio do menor privilégio.

Correção candidata:

- revogar `EXECUTE` de `authenticated`;
- manter somente `service_role`/rotina interna, ou exigir papel administrativo em `aal2` caso exista uso manual legítimo;
- criar teste negativo de chamada por usuário comum.

Status: VULNERÁVEL — CORREÇÃO NÃO APLICADA.

### SEC-003 — Funções administrativas expostas a `authenticated`

Severidade preliminar: BAIXA a ALTA, conforme a função.

O Advisor sinaliza diversas funções administrativas porque possuem `EXECUTE` para `authenticated`. A inspeção inicial mostra que várias validam `has_role()`, e a implementação atual de `has_role()` exige `aal2` para `admin`, `moderador` e `equipe`.

Isso reduz o risco, mas ainda exige:

- teste direto em `aal1`;
- teste com usuário comum;
- revisão de todos os caminhos internos;
- revogação de `EXECUTE` quando a função não precisar estar exposta;
- confirmação de `search_path` seguro.

Status: EM ANÁLISE; não tratar todos os avisos como falso positivo sem teste.

### SEC-004 — Integridade de preços e custos em `record_customer_sale()`

Severidade preliminar: CRÍTICA/ALTA, requer teste.

A função recebe `_items jsonb` e aceita `unit_price_cents` e `unit_cost_cents` enviados pelo chamador, usando o catálogo apenas como valor padrão. Uma conta de equipe em `aal2` pode, em princípio, enviar preços e custos diferentes dos cadastrados.

Riscos potenciais:

- venda registrada por valor inferior ou zero;
- custo adulterado, afetando margem e relatórios;
- fraude operacional ou erro de integração;
- dados financeiros inconsistentes.

Próxima verificação:

- identificar se descontos/preços manuais são requisito legítimo;
- testar chamadas com preço e custo manipulados;
- definir autorização específica para override;
- preferir preço/custo do catálogo no servidor;
- registrar qualquer exceção com motivo, limites e auditoria.

Status: EM VALIDAÇÃO — BLOQUEADOR POTENCIAL.

### SEC-005 — Proteção contra senhas vazadas desativada

Severidade preliminar: MÉDIA.

O Supabase Auth está com leaked password protection desativada.

Ação candidata:

- habilitar a proteção no Auth após confirmar impacto e disponibilidade no plano;
- testar cadastro e troca de senha;
- manter mensagens que não revelem detalhes indevidos.

Status: PENDENTE.

### SEC-006 — Tabela privada sem política RLS

Severidade preliminar: INFORMATIVA.

`private.content_moderation_terms` possui RLS sem políticas. Como está no schema `private`, isso pode ser intencional e seguro, desde que não esteja exposta na API e somente funções controladas tenham acesso.

Status: VALIDAR exposição de schemas e grants.

## Controles já confirmados

### 2FA privilegiado

- `has_role()` exige `aal2` para `admin`, `moderador` e `equipe`;
- teste manual confirmou bloqueio do aplicativo antes do segundo fator;
- a proteção precisa continuar sendo testada diretamente na API.

Status: PARCIALMENTE VALIDADO.

### Chat de eventos

`can_access_event_chat()` e `can_read_event_chat()` rejeitam `_user_id` diferente de `auth.uid()`, exigem maioridade e check-in para usuários comuns e usam `has_role()` para privilégios.

Status: REVISÃO INICIAL FAVORÁVEL; testes negativos ainda necessários.

## Próximas etapas

1. testar `sync_event_statuses()` como usuário comum;
2. testar manipulação de preço/custo em `record_customer_sale()`;
3. inventariar grants de todas as RPCs e tabelas;
4. revisar RLS tabela por tabela;
5. revisar Storage e Edge Functions;
6. verificar segredos, cabeçalhos, CORS e variáveis;
7. revisar dependências e CI;
8. preparar migrations de correção em branch, sem produção;
9. executar testes negativos e positivos;
10. atualizar o Documento Mestre AI-First.

## Critério de liberação

O piloto só poderá ser promovido quando:

- não houver achados críticos ou altos abertos;
- cada operação privilegiada tiver teste `aal1` negado e `aal2` permitido;
- RLS e RPCs tiverem evidência de menor privilégio;
- dados pessoais não forem expostos a usuários indevidos;
- integridade comercial estiver protegida no servidor;
- correções estiverem documentadas e reproduzíveis.
