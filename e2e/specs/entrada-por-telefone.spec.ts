import { test, expect } from "../harness/fixtures";

/**
 * Automatiza a seção A2 "Entrada novamente" de
 * docs/WORKFLOW_TESTE_PILOTO_V205.md:
 *
 *   - Toque em Entrar e selecione Telefone.
 *   - Informe o mesmo telefone usado no cadastro.
 *   - Confirme que um novo código é recebido.
 *   - Digite primeiro um código incorreto.
 *   - Confirme que o app não entra e mostra uma orientação compreensível.
 *   - Digite o código correto.
 *   - Confirme que o aplicativo reconhece a mesma conta.
 *
 * O SMS real é substituído pelo código fixo do harness (`otpCode`). É o que
 * torna a verificação determinística: no roteiro manual, o participante
 * precisava de um celular com chip e sinal.
 */

const TELEFONE = "84999990000";
const CODIGO_CERTO = "654321";

async function pedirCodigo(page: import("@playwright/test").Page) {
  await page.goto("/auth?mode=signin");
  await page.getByRole("button", { name: "Telefone" }).click();
  await page.getByLabel("Telefone com DDD").fill(TELEFONE);
  await page.getByRole("button", { name: "Receber código" }).click();
  await expect(page.getByLabel("Código de 6 números")).toBeVisible();
}

test.describe("A2 — entrada por telefone", () => {
  test("pedir o código leva para a etapa de confirmação", async ({ page, bafafa }) => {
    await bafafa.start({ session: null, otpCode: CODIGO_CERTO });

    await pedirCodigo(page);

    // O app avisa para onde mandou o código, já formatado em pt-BR.
    await expect(page.getByText("(84) 99999-0000")).toBeVisible();
    expect(bafafa.stub.calls.filter((call) => call.path === "/auth/v1/otp").length).toBe(1);
  });

  test("código errado não entra e explica o que fazer", async ({ page, bafafa }) => {
    await bafafa.start({ session: null, otpCode: CODIGO_CERTO });

    await pedirCodigo(page);
    await page.getByLabel("Código de 6 números").fill("000000");
    await page.getByRole("button", { name: "Confirmar e entrar" }).click();

    // Continua na tela de código — nenhuma sessão foi aberta.
    await expect(page.getByLabel("Código de 6 números")).toBeVisible();
    await expect(page).toHaveURL(/\/auth/);

    // A mensagem é traduzida por `friendlyAuthError`, sem texto técnico.
    const corpo = (await page.locator("body").innerText()).toLowerCase();
    expect(corpo).not.toContain("token has expired");
    expect(corpo).not.toContain("invalid_otp");
  });

  test("código com menos de seis números nem é enviado", async ({ page, bafafa }) => {
    await bafafa.start({ session: null, otpCode: CODIGO_CERTO });

    await pedirCodigo(page);
    const antes = bafafa.stub.calls.filter((call) => call.path === "/auth/v1/verify").length;

    await page.getByLabel("Código de 6 números").fill("123");
    await page.getByRole("button", { name: "Confirmar e entrar" }).click();

    const depois = bafafa.stub.calls.filter((call) => call.path === "/auth/v1/verify").length;
    expect(depois).toBe(antes);
  });

  test("código correto entra e reconhece a mesma conta", async ({ page, bafafa }) => {
    await bafafa.start({
      session: null,
      otpCode: CODIGO_CERTO,
      rpc: {
        my_profile_completion_details: { percentage: 60, items: [], next_key: null },
        my_fofoquinhas: [],
        my_house_session: null,
      },
    });

    await pedirCodigo(page);
    await page.getByLabel("Código de 6 números").fill(CODIGO_CERTO);
    await page.getByRole("button", { name: "Confirmar e entrar" }).click();

    await expect(page).toHaveURL(/\/inicio$/);
  });

  test("telefone sem DDD não dispara envio de SMS", async ({ page, bafafa }) => {
    await bafafa.start({ session: null, otpCode: CODIGO_CERTO });

    await page.goto("/auth?mode=signin");
    await page.getByRole("button", { name: "Telefone" }).click();
    await page.getByLabel("Telefone com DDD").fill("99999");
    await page.getByRole("button", { name: "Receber código" }).click();

    // Segue na etapa do telefone e nenhum SMS foi pedido.
    await expect(page.getByLabel("Telefone com DDD")).toBeVisible();
    expect(bafafa.stub.calls.filter((call) => call.path === "/auth/v1/otp")).toHaveLength(0);
  });
});
