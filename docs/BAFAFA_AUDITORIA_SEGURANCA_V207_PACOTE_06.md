# Auditoria de Segurança V20.7 — Pacote 06

Data: 05/08/2026  
Branch: `codex/v20-7-hardening-rpc-comercial`  
Ambiente: Supabase `xijjohgokwfkqfkkhsyn`

## Escopo

Inventário estrutural de todas as funções do schema `public`, com foco em:

- RPCs `SECURITY DEFINER` acessíveis por `anon` ou `authenticated`;
- funções administrativas chamadas diretamente pelo frontend;
- validação de identidade por `auth.uid()`;
- validação de papel privilegiado por `has_role()` e AAL2;
- `search_path` fixo em código privilegiado;
- funções públicas intencionais.

## Resultado do inventário

- 100 funções públicas;
- 89 funções `SECURITY DEFINER`;
- 53 funções `SECURITY DEFINER` executáveis por `authenticated`;
- 3 funções `SECURITY DEFINER` executáveis por `anon`;
- 12 RPCs administrativas executáveis pelo aplicativo;
- 12 das 12 RPCs administrativas validam papel por `has_role()`;
- zero funções `SECURITY DEFINER` sem `search_path` fixo;
- zero exposições autenticadas sem justificativa estrutural;
- zero exposições anônimas sem justificativa estrutural.

Arquivo de verificação:

`docs/VERIFICAR_INVENTARIO_RPCS_V207.sql`

Resultado:

- `all_admin_rpcs_have_role_guard = true`;
- `all_security_definer_have_fixed_search_path = true`;
- `no_unexplained_authenticated_security_definer = true`;
- `no_unexplained_anon_security_definer = true`;
- `verificacao_ok = true`.

## Exposições anônimas intencionais

Permanecem acessíveis por decisão de produto:

- `check_content_allowed(text,text)`;
- `event_fofocometro(uuid)`;
- `get_public_profile(text)`.

Essas funções continuam produzindo avisos no Security Advisor. Os avisos são
aceitos estruturalmente, mas não encerram o risco de abuso por volume. O desenho
de rate limiting continua pendente.

## RPCs administrativas

As 12 RPCs administrativas expostas ao frontend possuem `has_role()`. Como a
V20.7 restringiu `has_role()` ao próprio `auth.uid()` e mantém AAL2 obrigatório
para `admin`, `moderador` e `equipe`, não foi necessária uma nova migration neste
pacote.

O teste estrutural não substitui os testes com sessões reais. Ainda é necessário
confirmar que:

- usuário comum é negado;
- conta privilegiada em AAL1 é negada;
- a mesma conta em AAL2 é autorizada apenas no escopo do papel.

## Estado da branch

Durante a retomada, a suíte encontrou erros de Prettier em arquivos já alterados
pela PR. A formatação foi normalizada, restaurando o lint sem erros.

Na primeira execução do GitHub Actions, o `bun audit` identificou três achados
altos em dependências transitivas: `postcss@8.5.10` e duas ocorrências de
`js-yaml@4.1.1`. O resultado anterior do `npm audit` não representava a resolução
registrada no lockfile do Bun usado pelo CI. Foram adicionados overrides para
`postcss@8.5.25` e `js-yaml@4.3.0`, com regeneração do `bun.lock` pelo Bun 1.3.14.

Validações locais:

- busca de segredos: passou;
- TypeScript: passou;
- build de produção: passou;
- lint: passou com 10 avisos preexistentes de Fast Refresh e zero erros;
- auditoria de dependências de produção: zero achados altos ou críticos e 2
  avisos baixos residuais (`@babel/core` e `esbuild`);
- cabeçalhos de segurança na produção: passou.

O preview da PR está protegido pelo SSO da Vercel. Por isso, o teste de
cabeçalhos no endereço de preview enxerga o redirecionamento da plataforma, não
a resposta da aplicação. A verificação foi concluída no endereço público de
produção, que retornou todos os cabeçalhos mínimos esperados.

## Status

INVENTÁRIO CONCLUÍDO E VALIDADO ESTRUTURALMENTE. Nenhum novo bloqueador crítico
ou alto foi encontrado neste pacote.
