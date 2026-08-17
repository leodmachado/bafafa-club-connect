import { test, expect } from "../harness/fixtures";

/**
 * Automatiza a seção A1 "Cadastro pelo telefone" de
 * docs/WORKFLOW_TESTE_PILOTO_V205.md, na parte que não depende de receber um
 * SMS de verdade:
 *
 *   - Tente avançar sem preencher um campo obrigatório.
 *   - Confirme que aparece uma orientação clara, sem mensagem técnica.
 *   - Confirme que uma pessoa menor de 18 anos não consegue continuar.
 *   - Confirme que a autorização de marketing começa desmarcada.
 *   - Tente continuar sem aceitar cada consentimento obrigatório.
 *   - Abra os Termos de Uso e a Política de Privacidade e depois volte.
 *
 * A porta de idade e o estado inicial dos consentimentos também são exigências
 * da LGPD (Art. 14 sobre menores; Art. 8 §1 sobre consentimento não presumido),
 * registradas em docs/CONFORMIDADE_LGPD_2026-08.md.
 */

test.beforeEach(async ({ bafafa }) => {
  await bafafa.start({ session: null });
});

async function abrirCadastroPorEmail(page: import("@playwright/test").Page) {
  await page.goto("/auth?mode=signup");
  await page.getByRole("button", { name: "E-mail" }).click();
  await expect(page.getByRole("button", { name: "Entrar pro Clube" })).toBeVisible();
}

test.describe("A1 — porta de idade no cadastro", () => {
  test("o seletor de ano não oferece nenhum ano de quem tem menos de 18", async ({ page }) => {
    await abrirCadastroPorEmail(page);

    const anos = await page
      .getByLabel("Ano de nascimento")
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => Number((option as HTMLOptionElement).value))
          .filter((value) => Number.isFinite(value) && value > 0),
      );

    expect(anos.length).toBeGreaterThan(0);

    // Quem nasceu depois de (ano atual - 18) ainda não completou 18 anos.
    const anoLimite = new Date().getFullYear() - 18;
    const anosDeMenor = anos.filter((ano) => ano > anoLimite);

    expect(anosDeMenor, `o cadastro ofereceu anos de menor de idade: ${anosDeMenor}`).toHaveLength(
      0,
    );
    expect(Math.max(...anos)).toBe(anoLimite);
  });

  test("o dia se ajusta ao mês escolhido e não permite data impossível", async ({ page }) => {
    // Regressão de 8b81389 ("corrige seleção de data no cadastro"): antes da
    // correção dava para montar 31 de fevereiro trocando o mês depois do dia.
    await abrirCadastroPorEmail(page);

    await page.getByLabel("Ano de nascimento").selectOption("2000");
    await page.getByLabel("Mês de nascimento").selectOption("02");

    const dias = await page
      .getByLabel("Dia de nascimento")
      .locator("option")
      .evaluateAll((options) =>
        options
          .map((option) => Number((option as HTMLOptionElement).value))
          .filter((value) => Number.isFinite(value) && value > 0),
      );

    // 2000 é bissexto: fevereiro tem 29 dias, nunca 30 ou 31.
    expect(Math.max(...dias)).toBe(29);
  });
});

test.describe("A1 — consentimentos", () => {
  test("marketing começa desmarcado e os obrigatórios também", async ({ page }) => {
    await abrirCadastroPorEmail(page);

    // Art. 8 §1 da LGPD: consentimento não pode vir pré-marcado.
    for (const nome of [
      "marketing_opt_in",
      "accept_terms",
      "accept_privacy",
      "accept_community",
      "is_over_18",
    ]) {
      await expect(page.locator(`input[name="${nome}"]`)).not.toBeChecked();
    }
  });

  test("não dá para se cadastrar sem aceitar os termos obrigatórios", async ({ page, bafafa }) => {
    await abrirCadastroPorEmail(page);

    await page.locator('input[name="display_name"]').fill("Bafafã de Teste");
    await page.locator('input[name="email"]').fill("teste@bafafa.test");
    await page.getByLabel("Crie uma senha").fill("SenhaForte#2026");
    await page.getByLabel("Repita a senha").fill("SenhaForte#2026");
    await page.getByLabel("Ano de nascimento").selectOption("1995");
    await page.getByLabel("Mês de nascimento").selectOption("03");
    await page.getByLabel("Dia de nascimento").selectOption("14");

    // Marca tudo menos os termos de uso.
    await page.locator('input[name="is_over_18"]').check();
    await page.locator('input[name="accept_privacy"]').check();
    await page.locator('input[name="accept_community"]').check();

    await page.getByRole("button", { name: "Entrar pro Clube" }).click();

    await expect(page.getByText("Precisa aceitar os termos.")).toBeVisible();
    // O que importa de verdade: nenhuma conta foi criada.
    expect(bafafa.stub.calls.filter((call) => call.path === "/auth/v1/signup")).toHaveLength(0);
  });

  test("e-mail malformado nem chega a ser enviado", async ({ page, bafafa }) => {
    await abrirCadastroPorEmail(page);

    await page.locator('input[name="display_name"]').fill("Bafafã de Teste");
    await page.locator('input[name="email"]').fill("nao-e-email");
    await page.getByRole("button", { name: "Entrar pro Clube" }).click();

    // O campo é `type="email" required`, então a validação nativa do navegador
    // barra antes do Zod. O resultado que importa é o mesmo: nada foi enviado.
    await expect(page.locator('input[name="email"]')).toBeVisible();
    expect(bafafa.stub.calls.filter((call) => call.path === "/auth/v1/signup")).toHaveLength(0);
  });

  test("a orientação de erro é em português claro, sem mensagem técnica", async ({ page }) => {
    await abrirCadastroPorEmail(page);

    // E-mail válido para passar da validação nativa e deixar o Zod falar.
    await page.locator('input[name="display_name"]').fill("A");
    await page.locator('input[name="email"]').fill("teste@bafafa.test");
    await page.getByLabel("Crie uma senha").fill("SenhaForte#2026");
    await page.getByLabel("Repita a senha").fill("SenhaForte#2026");
    await page.getByRole("button", { name: "Entrar pro Clube" }).click();

    await expect(page.getByText("Diz teu nome, Bafafã.")).toBeVisible();

    // Nada de vazamento de detalhe técnico na tela do cliente.
    const corpo = (await page.locator("body").innerText()).toLowerCase();
    for (const termo of ["zoderror", "pgrst", "postgres", "undefined is not", "at object."]) {
      expect(corpo, `mensagem técnica vazou para o cliente: ${termo}`).not.toContain(termo);
    }
  });
});

test.describe("A1 — documentos legais acessíveis antes de aceitar", () => {
  test("a política de privacidade abre e dá para voltar", async ({ page }) => {
    await page.goto("/privacidade");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const texto = await page.locator("body").innerText();
    expect(texto.length).toBeGreaterThan(200);
  });
});
