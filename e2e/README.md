# Testes de ponta a ponta

Automação dos roteiros manuais de `docs/TESTE_*.md` e
`docs/WORKFLOW_TESTE_PILOTO_V205.md`.

## Como rodar

```bash
npm run test:e2e                 # constrói o app e roda a suíte
E2E_SKIP_BUILD=1 npm run test:e2e   # reaproveita o build anterior (mais rápido)
npx playwright test --ui         # modo interativo, para escrever testes
npx playwright show-report       # relatório HTML da última execução
```

A primeira execução precisa dos navegadores:

```bash
npx playwright install chromium
```

## Como isto funciona

### Roda contra o build de produção, não contra `vite dev`

`vite dev` compila cada rota sob demanda. A primeira visita a uma tela custava
mais de um minuto, e o primeiro teste de cada rota falhava por timeout enquanto
os demais passavam — o pior tipo de suíte, a que falha sem motivo. A suíte
constrói o app com o preset `node-server` do nitro (`npm run e2e:build`) e sobe
`.output/server/index.mjs`. O deploy de verdade continua usando o preset
original; o preset de teste só vale para a suíte.

### Nunca fala com o Supabase de produção

`VITE_SUPABASE_URL` aponta para `https://e2estub.supabase.co` — um *project
ref* que não existe e é completamente diferente do de produção
(`xijjohgokwfkqfkkhsyn`). Todas as chamadas são interceptadas por
`e2e/harness/supabase-stub.ts`.

O host precisa terminar em `.supabase.co`: a CSP do próprio app
(`src/lib/security-headers.ts`) libera apenas
`connect-src https://*.supabase.co`. Um host fora dessa lista faz o navegador
bloquear as chamadas em silêncio — a suíte inteira "passava" sem nunca ter
falado com o harness. Por isso `smoke.spec.ts` afirma explicitamente que o app
chamou o stub pelo menos uma vez e que nenhum log de CSP apareceu.

### O nível de 2FA não é uma chamada de rede

`supabase.auth.mfa.getAuthenticatorAssuranceLevel()` não consulta o servidor:
o `supabase-js` lê a claim `aal` de dentro do próprio access token. Por isso o
harness monta um JWT com payload real (a assinatura é irrelevante, já que nada
a verifica). Trocar entre `aal1` e `aal2` é só mudar um campo:

```ts
await bafafa.start({ session: bafafa.user({ roles: ["admin"], aal: "aal1" }) });
```

## Escrevendo um teste

Cada spec descreve o estado do mundo e as asserções. Nenhuma reimplementa
autenticação, papéis ou OTP.

```ts
import { test, expect } from "../harness/fixtures";

test("admin sem 2FA não abre o painel", async ({ page, bafafa }) => {
  await bafafa.start({
    session: bafafa.user({ roles: ["admin"], aal: "aal1" }),
    rpc: { my_fofoquinhas: [] },
    tables: { feed_posts: [] },
    otpCode: "654321",
  });

  await page.goto("/admin");

  await expect(page).toHaveURL(/\/seguranca$/);
});
```

`bafafa.stub.calls` guarda tudo que o app pediu, o que permite afirmar
**ausência** de chamada — por exemplo, que um cadastro inválido não chegou a
criar conta:

```ts
expect(bafafa.stub.calls.filter((c) => c.path === "/auth/v1/signup")).toHaveLength(0);
```

## O que já está automatizado

| Roteiro manual | Item | Spec |
|---|---|---|
| `WORKFLOW_TESTE_PILOTO_V205.md` A1 | Menor de 18 não continua | `cadastro-e-idade.spec.ts` |
| A1 | Marketing começa desmarcado | `cadastro-e-idade.spec.ts` |
| A1 | Consentimentos obrigatórios bloqueiam | `cadastro-e-idade.spec.ts` |
| A1 | Orientação clara, sem mensagem técnica | `cadastro-e-idade.spec.ts` |
| A1 | Data de nascimento impossível | `cadastro-e-idade.spec.ts` (regressão de `8b81389`) |
| A2 | Código incorreto não entra | `entrada-por-telefone.spec.ts` |
| A2 | Código correto reconhece a conta | `entrada-por-telefone.spec.ts` |
| B1 | Segundo fator exigido de conta privilegiada | `permissoes-e-2fa.spec.ts` |
| B1 | Equipe sem acesso administrativo | `permissoes-e-2fa.spec.ts` |
| C2 | Cliente não abre equipe nem administração | `permissoes-e-2fa.spec.ts` |
| `TESTE_AUTENTICACAO_V16.md` | Bloqueio de privilegiado sem MFA | `permissoes-e-2fa.spec.ts` |

## O que ainda precisa de gente

Estes itens dependem de coisas que um navegador headless não consegue produzir
com fidelidade. Continuam no roteiro manual de propósito:

- **Check-in por GPS dentro e fora do bar** (A4). O Playwright consegue forjar
  coordenadas, mas o que o piloto precisa validar é a precisão real do aparelho
  e o comportamento do geofence em campo.
- **Leitura de QR pela câmera da equipe** (A5, B2, B3). O caminho de digitação
  do código é automatizável e é o próximo passo natural; a câmera não é.
- **Recebimento de SMS real** (A1, A2). A suíte cobre a lógica dos dois lados
  do código; a entrega do SMS depende do provedor.
- **Contagem independente por campanha** (Parte D). É regra de banco de dados,
  não de interface. O lugar certo para cobrir isso é um teste contra um
  Supabase local (`supabase start` + as migrations), ainda não montado.
- **Perguntas de percepção** (Parte F). São sobre pessoas, não sobre o app.

## Limites conhecidos do harness

- O stub interpreta apenas os filtros PostgREST que o app usa hoje (`eq`, `in`,
  `is`). Um filtro novo passa despercebido em vez de falhar — se um teste
  receber linhas demais, é o primeiro lugar a olhar.
- O stub não aplica RLS. Ele responde o que a spec mandar responder, então
  **não** serve para provar que uma política do banco está correta. Isso é
  trabalho de teste no banco, não de teste de interface.
