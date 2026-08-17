import { test, expect } from "../harness/fixtures";

/**
 * Verificação do próprio harness.
 *
 * Se esta spec falhar, nenhuma outra é confiável: ela prova que a
 * interceptação do Supabase está ativa, que a sessão semeada é aceita pelo
 * app e que nenhuma chamada escapa para a rede real.
 */

test("visitante sem sessão vê a porta de entrada do Clube", async ({ page, bafafa }) => {
  await bafafa.start({ session: null });

  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("O Bafafá começa");
  await expect(page.getByRole("link", { name: "Entrar no Clube" })).toBeVisible();
});

test("sessão semeada entra direto na área autenticada", async ({ page, bafafa }) => {
  await bafafa.start({
    session: bafafa.user({ roles: ["gratuito"], aal: "aal1" }),
    rpc: {
      my_profile_completion_details: { percentage: 40, items: [], next_key: null },
      my_fofoquinhas: [],
      my_house_session: null,
    },
  });

  await page.goto("/inicio");

  // A landing redireciona quem tem sessão; chegar em /inicio já prova que o
  // guard aceitou o token semeado pelo harness.
  await expect(page).toHaveURL(/\/inicio$/);
});

test("o stub intercepta de fato e nada escapa para a rede real", async ({ page, bafafa }) => {
  const escaped: string[] = [];
  const cspBlocked: string[] = [];

  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("supabase") && !url.includes("e2estub.supabase.co")) escaped.push(url);
  });
  // A CSP do app já barrou o harness uma vez (host fora de `*.supabase.co`).
  // Se voltar a barrar, o teste precisa gritar em vez de passar em silêncio.
  page.on("console", (message) => {
    if (message.text().includes("Content Security Policy")) cspBlocked.push(message.text());
  });

  await bafafa.start({ session: bafafa.user({ roles: ["gratuito"], aal: "aal1" }) });
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/inicio$/);

  // Sem esta asserção o teste passaria mesmo com a interceptação quebrada:
  // foi exatamente o que aconteceu antes da correção da CSP.
  expect(bafafa.stub.calls.length, "o app não chamou o stub nenhuma vez").toBeGreaterThan(0);
  expect(escaped, `requisições vazaram para fora do stub: ${escaped.join(", ")}`).toHaveLength(0);
  expect(cspBlocked, `a CSP bloqueou o harness: ${cspBlocked[0] ?? ""}`).toHaveLength(0);
});
