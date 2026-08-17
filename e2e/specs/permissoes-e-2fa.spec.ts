import { test, expect } from "../harness/fixtures";

/**
 * Automatiza os itens de permissão e segundo fator dos roteiros manuais:
 *
 *   docs/WORKFLOW_TESTE_PILOTO_V205.md
 *     B1 "Acesso e segurança"
 *       - Confirme o segundo fator de segurança, quando solicitado.
 *       - Confirme que a área operacional abre.
 *       - Tente abrir a administração completa.
 *       - Confirme que uma conta de equipe não recebe acesso administrativo indevido.
 *     C2 "Permissões"
 *       - Confirme que cliente não abre a área da equipe.
 *       - Confirme que cliente não abre a administração.
 *       - Confirme que administrador usa MFA para operações privilegiadas.
 *   docs/TESTE_AUTENTICACAO_V16.md — bloqueio de conta privilegiada sem MFA.
 *
 * Estes itens exigiam três pessoas (cliente, equipe, admin), um autenticador
 * TOTP físico e um coordenador conferindo tela por tela. Aqui cada papel é um
 * estado do harness e o segundo fator é a claim `aal` do token.
 */

const HOME_DATA = {
  my_profile_completion_details: { percentage: 40, items: [], next_key: null },
  my_fofoquinhas: [],
  my_house_session: null,
};

test.describe("C2 — cliente comum não alcança áreas privilegiadas", () => {
  test("cliente que digita /admin vê 'Área restrita' e não o painel", async ({ page, bafafa }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["gratuito"], aal: "aal1" }),
      rpc: HOME_DATA,
    });

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Área restrita" })).toBeVisible();
    // O convite para o validador só aparece para quem é equipe.
    await expect(page.getByRole("link", { name: "Abrir validador" })).toHaveCount(0);
  });

  test("cliente comum não é interrompido por 2FA na navegação normal", async ({ page, bafafa }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["gratuito"], aal: "aal1" }),
      rpc: HOME_DATA,
    });

    await page.goto("/inicio");

    // Membro sem papel privilegiado nunca deve cair na tela de segurança.
    await expect(page).toHaveURL(/\/inicio$/);
  });
});

test.describe("B1 — conta privilegiada em AAL1 fica presa no segundo fator", () => {
  // Este é exatamente o furo encontrado no smoke test manual: a tela de 2FA
  // aparecia, mas dava para sair dela navegando para outra rota.
  const PRIVILEGED = ["admin", "moderador", "equipe"] as const;

  for (const role of PRIVILEGED) {
    test(`'${role}' em AAL1 é redirecionado de /inicio para /seguranca`, async ({
      page,
      bafafa,
    }) => {
      await bafafa.start({
        session: bafafa.user({ roles: [role], aal: "aal1" }),
        rpc: HOME_DATA,
      });

      await page.goto("/inicio");

      await expect(page).toHaveURL(/\/seguranca$/);
      await expect(page.getByRole("heading", { name: "Segurança" })).toBeVisible();
    });
  }

  test("admin em AAL1 não abre /admin nem trocando a URL na barra", async ({ page, bafafa }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["admin"], aal: "aal1" }),
      rpc: HOME_DATA,
    });

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/seguranca$/);
  });

  test("admin em AAL1 não abre o validador da equipe", async ({ page, bafafa }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["admin", "equipe"], aal: "aal1" }),
      rpc: HOME_DATA,
    });

    await page.goto("/staff/checkin");

    await expect(page).toHaveURL(/\/seguranca$/);
  });

  test("sair da tela de segurança por navegação do app devolve para /seguranca", async ({
    page,
    bafafa,
  }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["admin"], aal: "aal1" }),
      rpc: HOME_DATA,
    });

    await page.goto("/seguranca");
    await expect(page.getByRole("heading", { name: "Segurança" })).toBeVisible();

    // "Tab out": o link de voltar ao perfil é a saída mais óbvia da tela.
    await page.getByRole("link", { name: "Voltar ao perfil" }).click();

    await expect(page).toHaveURL(/\/seguranca$/);
  });
});

test.describe("B1/C2 — conta privilegiada em AAL2 trabalha normalmente", () => {
  test("admin com segundo fator confirmado abre o painel administrativo", async ({
    page,
    bafafa,
  }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["admin"], aal: "aal2" }),
      rpc: HOME_DATA,
    });

    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Área restrita" })).toHaveCount(0);
  });

  test("equipe com segundo fator não recebe acesso administrativo", async ({ page, bafafa }) => {
    await bafafa.start({
      session: bafafa.user({ roles: ["equipe"], aal: "aal2" }),
      rpc: HOME_DATA,
    });

    await page.goto("/admin");

    // Passou pelo gate de 2FA, mas continua sem o papel de admin.
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole("heading", { name: "Área restrita" })).toBeVisible();
    // A equipe é encaminhada para a ferramenta que lhe cabe.
    await expect(page.getByRole("link", { name: "Abrir validador" })).toBeVisible();
  });
});

test.describe("visitante sem sessão", () => {
  test("qualquer rota autenticada manda para /auth", async ({ page, bafafa }) => {
    await bafafa.start({ session: null });

    await page.goto("/inicio");

    await expect(page).toHaveURL(/\/auth/);
  });
});
