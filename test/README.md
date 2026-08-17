# Testes automatizados do Clube do Bafafã

Este diretório concentra os testes que rodam sem navegador, sem banco e sem
rede. São rápidos de propósito: dá para rodar a suíte inteira entre uma
alteração e outra.

## Como rodar

```bash
npm test            # roda tudo uma vez (vitest run)
npm run test:watch  # fica observando os arquivos e re-roda o que mudou
```

Para rodar só um arquivo ou só um teste:

```bash
npx vitest run test/unit/commercial.test.ts
npx vitest run -t "formatPhoneBR"
```

E a prova de que os testes de regressão realmente pegam os bugs que dizem pegar:

```bash
bash scripts/verify-regressions.sh
```

Esse script cria um worktree no commit ANTERIOR a cada correção, copia os testes
atuais para lá e exige que eles **falhem**; depois roda no commit da correção e
exige que **passem**. Um teste de regressão que passa nas duas pontas não estaria
testando nada, e o script reprova nesse caso.

## Organização

```
test/
  setup.ts                 carregado antes de cada arquivo de teste
  helpers/supabase-mock.ts dublê do cliente Supabase
  regression/              um arquivo por bug já corrigido
  unit/                    um arquivo por módulo de src/lib
```

- **`test/unit/`** — lógica pura e módulos de `src/lib`. Um arquivo por módulo,
  com o mesmo nome (`src/lib/commercial.ts` → `test/unit/commercial.test.ts`).
- **`test/regression/`** — cada arquivo documenta um bug real: o que acontecia, o
  commit que corrigiu e por que o teste falha no código antigo. Esses arquivos
  são referenciados por `scripts/verify-regressions.sh` e não devem ser
  renomeados sem atualizar o script.

O glob de testes é `test/**/*.test.ts(x)` (ver `vitest.config.ts`). Arquivos de
apoio que não terminam em `.test.ts` não são coletados.

## Configuração

`vitest.config.ts` é separado do `vite.config.ts` do app de propósito: o app usa
o preset do TanStack Start (rotas, nitro, SSR) e os testes não precisam disso —
só do alias `@/` e de um DOM (`jsdom`).

`test/setup.ts` roda antes de cada arquivo e:

- registra os matchers do `@testing-library/jest-dom`;
- desmonta os componentes renderizados (`cleanup`);
- limpa `sessionStorage` e `localStorage` entre testes.

`restoreMocks` e `clearMocks` estão ligados na config, então o histórico de
chamadas dos mocks é limpo automaticamente. **Timers falsos e globais trocados
não são**: quem chama `vi.useFakeTimers()` ou `vi.stubGlobal()` precisa desfazer
num `afterEach`.

## Como funciona o dublê do Supabase

`src/integrations/supabase/client.ts` é um Proxy preguiçoso que estoura se as
variáveis de ambiente não existirem — ou seja, não dá para importá-lo num teste.
A solução é trocar o módulo inteiro por `test/helpers/supabase-mock.ts`.

O padrão usado em todos os testes que tocam o Supabase é este:

```ts
import { createSupabaseMock } from "../helpers/supabase-mock";

// `vi.hoisted` roda antes dos imports, então o container começa vazio e cada
// teste injeta o dublê que precisa. O mock expõe um getter, de modo que a troca
// vale mesmo depois de um import dinâmico.
const mockRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    if (!mockRef.current) throw new Error("dublê do Supabase não foi configurado no teste");
    return mockRef.current;
  },
}));

// Não chame esse helper de `useSupabase`: o ESLint trata qualquer `useXxx` como
// React Hook e reclama (`react-hooks/rules-of-hooks`) se ele for chamado de
// dentro de uma função auxiliar comum.
function injetarSupabase(double: ReturnType<typeof createSupabaseMock>["supabase"]) {
  mockRef.current = double;
}
```

O dublê implementa apenas o que o código de produção usa:

| Chamada                                     | Controlado por                        |
| ------------------------------------------- | ------------------------------------- |
| `auth.getUser()`                            | `user` (use `null` para "sem sessão") |
| `auth.mfa.getAuthenticatorAssuranceLevel()` | `assuranceLevel` (`"aal1"`/`"aal2"`)  |
| `from("user_roles").select("role").eq(...)` | `roles` ou `roleResponses`            |
| `rpc(nome, args)`                           | `rpcResponses[nome]`                  |

Detalhes que costumam pegar quem escreve o primeiro teste:

- **O resultado de `.eq()` é um _thenable_, não uma Promise.** O código de
  produção faz `Promise.resolve(query)`, então o objeto devolvido precisa ter um
  `then`. É por isso que o dublê não usa `async` ali.
- **`roleResponses`** define respostas sucessivas da consulta a `user_roles`, uma
  por chamada (a última se repete). Serve para provar cache: se a segunda
  resposta é diferente e o resultado não muda, é porque a consulta não foi
  refeita.
- **`deferRoleQuery: true`** segura a consulta até o teste chamar
  `await controls.releaseRoleQueries()`. É o que permite observar o estado
  "requisição em voo" — coalescência de chamadas simultâneas e a guarda de
  geração de `clearAuthSecurityCache`. O `release` é `async` porque
  `Promise.resolve(thenable)` só chama o `then` numa microtask.
- **`spies`** expõe os `vi.fn` (`from`, `select`, `eq`, `rpc`, `getUser`, ...)
  para asserções do tipo "consultou o banco uma vez só".

Ao estender o dublê, mantenha a API existente funcionando: as duas suítes de
`test/regression/` dependem dela, e `scripts/verify-regressions.sh` copia o
helper atual para dentro de worktrees antigos.

## Convenções

1. **Português.** Nomes de `describe`/`it` e comentários em pt-BR, como o resto
   do código.
2. **Um arquivo por módulo**, com o mesmo nome do arquivo de origem.
3. **Comportamento e limites, não implementação.** Testar "no instante exato de
   `ends_at` ainda está rolando" vale mais do que testar que uma função interna
   foi chamada.
4. **Todo teste precisa poder falhar por um motivo real.** Nada de asserção que
   é verdadeira por construção. Quando desconfiar, quebre o código de propósito
   e confirme que o teste fica vermelho.
5. **Sem snapshots.** Eles passam a valer qualquer coisa depois do primeiro
   `-u`.
6. **Determinismo.** Sem rede, sem GPS, sem relógio de parede:
   - quando a função aceita o tempo por parâmetro (`referenceTime` em
     `effectiveEventStatus`), **use o parâmetro** — não mexa no relógio global;
   - quando não aceita, use `vi.useFakeTimers()` + `vi.setSystemTime()` e
     restaure em `afterEach`.
7. **Estado de módulo exige módulo novo.** `src/lib/auth-security.ts` guarda
   cache de papéis em escopo de módulo; testes que o tocam usam
   `vi.resetModules()` + `await import(...)` para começar limpos.
8. **Nada de `Intl` literal.** `"R$ 15,00"` usa espaço não separável (U+00A0) e
   as datas mudam com o fuso e a versão do ICU. Normalize o espaço antes de
   comparar e prefira propriedades estáveis (formato, dia correto, ausência de
   hora) a strings inteiras.
9. **Marque comportamento duvidoso.** Quando um teste registra o que o código
   faz hoje — e não o que deveria fazer — o nome começa com
   `COMPORTAMENTO ATUAL:` e um comentário aponta para
   `docs/ACHADOS_DOS_TESTES_2026-08.md`. Assim ninguém "conserta" o teste
   achando que ele descreve a regra desejada.

## Adicionando um teste novo

1. Crie `test/unit/<modulo>.test.ts`.
2. Comece pelos limites: vazio, `null`, zero, negativo, o instante exato do
   corte, o milissegundo seguinte.
3. Se o módulo fala com o Supabase, use `createSupabaseMock` — não crie outro
   dublê.
4. Rode `npx vitest run` e `npx eslint .` antes de commitar.
