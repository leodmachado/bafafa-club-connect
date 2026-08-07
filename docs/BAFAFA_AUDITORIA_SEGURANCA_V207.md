# Bafafá Connect — Auditoria de Segurança V20.7

Status: EM ANDAMENTO  
Ambiente analisado: Supabase `xijjohgokwfkqfkkhsyn`  
Branch: `codex/v20-7-hardening-rpc-comercial`  
Regra: nenhuma promoção do frontend para produção enquanto houver bloqueador crítico ou alto sem tratamento.

## Objetivo

Avaliar autenticação, sessões, autorização, RLS, RPCs, funções `SECURITY DEFINER`, dados pessoais, integridade comercial, abuso do produto, Storage, Edge Functions, dependências e configuração da infraestrutura.

## Método

Cada controle deve ter teste negativo e positivo:

- `anon` → somente operações públicas intencionais;
- usuário autenticado comum → apenas seus próprios dados e ações;
- conta privilegiada em `aal1` → negada;
- conta privilegiada em `aal2` → permitida conforme o papel;
- chamada direta da API → mesma decisão do aplicativo;
- `service_role` → somente rotinas internas autorizadas.

## Pacote 01 — integridade comercial e RPC crítica

Migration do repositório:

`20260803143000_security_hardening_rpc_commercial_v207.sql`

Registro do Supabase:

`20260803142954 — security_hardening_rpc_commercial_v207`

Controles aplicados:

- `sync_event_statuses()` exige `service_role` ou `admin` validado por `has_role()`;
- `anon` e `PUBLIC` não possuem `EXECUTE` na sincronização;
- a implementação anterior de `record_customer_sale()` foi tornada interna;
- `authenticated` não possui `EXECUTE` na função comercial interna;
- o wrapper público mantém compatibilidade com o frontend;
- preço e custo enviados pelo cliente são comparados ao catálogo;
- divergências geram `security_events` e a venda é rejeitada;
- preço e custo são removidos antes do processamento interno;
- origem diferente de `manual` é bloqueada;
- payload, quantidade de itens, token, referência e adicionais possuem limites.

Evidência:

- `verificacao_estrutural_ok = true`;
- `teste_sem_sessao_ok = true`.

Limitação:

O conector bloqueou a simulação artificial de JWTs `aal1` e `aal2`. O teste completo permanece disponível em `docs/VERIFICAR_HARDENING_RPC_COMERCIAL_V207.sql` para execução pelo SQL Editor ou futura suíte automatizada.

## Pacote 02 — escopo próprio de `has_role()`

Migration do repositório:

`20260803144500_has_role_self_scope_v207.sql`

Registro do Supabase:

`20260803144655 — has_role_self_scope_v207`

Controles aplicados:

- usuário autenticado só pode consultar o papel do próprio `auth.uid()`;
- consulta de papéis de UUIDs arbitrários foi bloqueada;
- `anon` não possui `EXECUTE`;
- `service_role` mantém o caminho interno necessário;
- a exigência de `aal2` para `admin`, `moderador` e `equipe` foi preservada;
- todas as chamadas internas encontradas usam `auth.uid()` ou variável derivada dele.

Evidência:

- `restricts_to_current_user = true`;
- `preserves_service_role_path = true`;
- `preserves_privileged_aal2 = true`;
- `anon_cannot_enumerate_roles = true`;
- `no_session_denied = true`;
- `verificacao_ok = true`.

Status: CORRIGIDO E VALIDADO ESTRUTURALMENTE.

## Pacote 03 — objetos futuros fechados por padrão

Migrations do repositório:

- `20260803151000_secure_default_privileges_v207.sql`;
- `20260803151500_secure_default_maintain_v207.sql`.

Registros do Supabase:

- `20260803145238 — secure_default_privileges_v207`;
- `20260803145334 — secure_default_maintain_v207`.

Controles aplicados ao proprietário `postgres`, usado pelas migrations e funções do aplicativo:

- novas tabelas não recebem automaticamente privilégios de API para `anon` ou `authenticated`;
- novas sequências não recebem automaticamente `USAGE`, `SELECT` ou `UPDATE`;
- novas funções não recebem automaticamente `EXECUTE`;
- o privilégio `MAINTAIN` também foi removido de futuras tabelas;
- cada nova migration deverá conceder explicitamente somente os privilégios necessários.

A primeira tentativa incluiu o papel interno `supabase_admin`, mas o Supabase recusou a alteração e reverteu a migration inteira. A versão aplicada foi limitada ao proprietário real dos objetos do aplicativo. Os defaults de `supabase_admin` permanecem gerenciados pela plataforma.

Evidência:

- `future_tables_closed = true`;
- `future_sequences_closed = true`;
- `future_functions_closed = true`;
- `supabase_admin_defaults_managed_by_platform = true`;
- `verificacao_ok = true`.

Status: CORRIGIDO PARA OBJETOS DO APLICATIVO; LIMITAÇÃO DA PLATAFORMA DOCUMENTADA.

## Revisão de infraestrutura

### Edge Functions

Não existem Edge Functions implantadas no projeto.

Resultado:

- nenhuma função com `verify_jwt = false`;
- nenhuma função com segredo administrativo para revisar;
- nenhuma superfície HTTP adicional fora do Data API neste momento.

Status: SEM ACHADO ATUAL.

### Storage

Buckets encontrados:

- `avatars` — público, limite de 10 MB, JPEG/PNG/WebP/GIF;
- `event-images` — público, limite de 10 MB, JPEG/PNG/WebP/GIF.

Políticas:

- usuários autenticados só inserem, alteram ou removem avatar dentro da pasta do próprio UUID;
- imagens de evento só podem ser inseridas, alteradas ou removidas por `admin`, passando pelo `has_role()` e, portanto, por `aal2`;
- ambos os buckets são públicos por decisão de produto, então qualquer pessoa com a URL do arquivo pode visualizá-lo;
- conteúdo sensível não deve ser armazenado nesses buckets.

Arquivos existentes:

- 4 avatares;
- 3 imagens de evento;
- zero avatares fora da pasta do proprietário;
- zero objetos sem proprietário;
- zero MIME types fora da lista;
- zero arquivos acima do limite.

Status: REVISÃO FAVORÁVEL. RISCO ACEITO PARA LEITURA PÚBLICA DE MÍDIA NÃO SENSÍVEL.

## Pacote 06 — inventário de RPCs públicas

Arquivo de verificação:

`docs/VERIFICAR_INVENTARIO_RPCS_V207.sql`

Resultado estrutural em 05/08/2026:

- 100 funções no schema `public`;
- 89 funções `SECURITY DEFINER`;
- 53 funções `SECURITY DEFINER` executáveis por `authenticated`;
- 3 funções `SECURITY DEFINER` executáveis por `anon`;
- 12 de 12 RPCs administrativas expostas ao aplicativo validam `has_role()`;
- zero funções privilegiadas sem `search_path` fixo;
- zero exposições autenticadas ou anônimas sem justificativa estrutural.

Evidência:

- `all_admin_rpcs_have_role_guard = true`;
- `all_security_definer_have_fixed_search_path = true`;
- `no_unexplained_authenticated_security_definer = true`;
- `no_unexplained_anon_security_definer = true`;
- `verificacao_ok = true`.

Status: INVENTÁRIO CONCLUÍDO E VALIDADO ESTRUTURALMENTE. Testes com sessões
reais AAL1/AAL2 continuam pendentes.

## Achados

### SEC-001 — RPCs anônimas `SECURITY DEFINER`

Funções:

- `check_content_allowed(text,text)`;
- `event_fofocometro(uuid)`;
- `get_public_profile(text)`.

Classificação:

- as três são endpoints públicos intencionais;
- `check_content_allowed()` retorna apenas decisão booleana, limita conteúdo a 1.200 caracteres e valida o contexto;
- `event_fofocometro()` retorna somente metas públicas de eventos e possui índice por evento/ordem;
- `get_public_profile()` só retorna perfis marcados como públicos, respeita preferências de visibilidade e possui índice para busca por username;
- nenhuma retorna telefone, e-mail, nascimento ou termos privados de moderação.

Risco residual:

- abuso por volume e enumeração de usernames públicos;
- ausência de rate limiting específico na camada do banco;
- os avisos do Security Advisor continuarão porque a exposição anônima é intencional.

Status: EXPOSIÇÃO INTENCIONAL — HARDENING DE ABUSO/RATE LIMIT PENDENTE.

### SEC-002 — `sync_event_statuses()` sem autorização interna

Severidade original: ALTA.

Status: CORRIGIDO — teste direto com tokens reais `aal1` e `aal2` ainda pendente.

### SEC-003 — Funções administrativas expostas a `authenticated`

Severidade: variável conforme a função.

O Advisor sinaliza funções que possuem `EXECUTE` para `authenticated`. Muitas precisam ser chamadas pelo aplicativo, mas validam internamente `has_role()`, agora restrito ao próprio usuário e com `aal2` obrigatório para papéis privilegiados.

O inventário do Pacote 06 confirmou que todas as 12 RPCs administrativas
expostas ao frontend contêm a guarda `has_role()` e que nenhuma função
privilegiada está sem `search_path` fixo.

Pendente:

- teste direto por usuário comum;
- teste com conta privilegiada em `aal1`;
- teste positivo em `aal2`;
- confirmar o comportamento com tokens reais;
- migrar helpers internos para schema não exposto quando isso reduzir a
  superfície sem quebrar policies ou fluxos internos.

Status: VALIDADO ESTRUTURALMENTE — TESTES REAIS AAL1/AAL2 PENDENTES.

### SEC-004 — Integridade de preços e custos

Severidade original: CRÍTICA/ALTA.

Status: BLOQUEADOR PRINCIPAL CORRIGIDO — teste de venda real e política definitiva de taxas pendentes.

### SEC-005 — Proteção contra senhas vazadas desativada

Severidade: MÉDIA.

Pendente:

- habilitar no Auth caso disponível no plano;
- testar cadastro, troca e recuperação de senha;
- manter respostas que não revelem existência de conta.

Status: PENDENTE.

### SEC-006 — Tabela privada de moderação sem policy

Verificação:

- `anon` não possui `USAGE` no schema `private`;
- `authenticated` não possui `USAGE` no schema `private`;
- nenhum dos dois possui `SELECT` em `private.content_moderation_terms`;
- a tabela só é acessada por função controlada que retorna decisão booleana.

Status: SEGURO POR ISOLAMENTO DE SCHEMA; AVISO INFORMATIVO DO ADVISOR.

## Controles já confirmados

### 2FA privilegiado

- interface bloqueia acesso antes do segundo fator;
- `has_role()` exige `aal2` para `admin`, `moderador` e `equipe`;
- consulta de papéis foi limitada ao próprio usuário;
- ainda falta o teste direto com tokens reais contra as RPCs.

Status: PARCIALMENTE VALIDADO.

### Chat de eventos

`can_access_event_chat()` e `can_read_event_chat()` rejeitam `_user_id` diferente de `auth.uid()`, exigem maioridade e check-in para usuários comuns e usam `has_role()` para privilégios.

Status: REVISÃO INICIAL FAVORÁVEL; testes negativos ainda necessários.

## Próximas etapas

1. executar os testes com tokens reais `aal1` e `aal2`;
2. fazer uma venda controlada normal e uma tentativa adulterada;
3. revisar RLS das tabelas ainda não cobertas pelos Pacotes 04 e 05;
4. revisar funções que recebem IDs de outros usuários;
5. revisar dependências, CI, segredos, cabeçalhos e variáveis;
6. habilitar proteção contra senhas vazadas;
7. desenhar rate limiting para endpoints públicos e ações de abuso;
8. atualizar o Documento Mestre AI-First.

## Critério de liberação

O piloto só poderá ser promovido quando:

- não houver achados críticos ou altos abertos;
- cada operação privilegiada tiver teste `aal1` negado e `aal2` permitido;
- RLS e RPCs tiverem evidência de menor privilégio;
- dados pessoais não forem expostos a usuários indevidos;
- integridade comercial estiver protegida no servidor;
- correções estiverem documentadas e reproduzíveis.
