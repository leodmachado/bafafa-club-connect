import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock, makeUser } from "../helpers/supabase-mock";

/**
 * REGRESSÃO — Contas privilegiadas em AAL1 escapavam do 2FA.
 *
 * Bug observado em smoke test: ao entrar como admin, a tela de 2FA aparecia,
 * mas bastava navegar para outra rota (trocar de aba / digitar a URL) para
 * usar o app inteiro sem nunca confirmar o segundo fator.
 *
 * Causa: `src/routes/_authenticated/route.tsx` só checava se havia sessão.
 * Antes de 6e05948 o `beforeLoad` era literalmente:
 *
 *     const { data, error } = await supabase.auth.getUser();
 *     if (error || !data.user) throw redirect({ to: "/auth", ... });
 *     return { user: data.user };
 *
 * Nenhuma consulta de papel, nenhuma checagem de AAL. A tela `/seguranca` era
 * apenas uma sugestão visual.
 *
 * Correções:
 *   7f20e59 security: centraliza inspeção de sessão privilegiada e AAL2
 *   6e05948 security: bloqueia contas privilegiadas em AAL1 no roteamento global
 *   99cdb0c security: exige AAL2 nas permissões privilegiadas do Supabase
 *
 * VERMELHO antes de 6e05948 (o guard devolvia contexto sem redirecionar) /
 * VERDE depois. Ver `scripts/verify-regressions.sh`.
 */

// `vi.hoisted` roda antes dos imports do arquivo, então o container começa
// vazio e cada teste injeta o dublê que precisa. O mock do módulo expõe um
// getter, de modo que a troca vale mesmo depois do import dinâmico.
type SupabaseDouble = ReturnType<typeof createSupabaseMock>["supabase"];
const mockRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    if (!mockRef.current) throw new Error("dublê do Supabase não foi configurado no teste");
    return mockRef.current;
  },
}));

function useSupabase(double: SupabaseDouble) {
  mockRef.current = double;
}

/**
 * O `redirect()` do TanStack Router guarda o destino em `.options.to`.
 * Versões antigas expunham `.to` na raiz — aceitamos as duas formas para que a
 * suíte não quebre num upgrade de router.
 */
function redirectTarget(thrown: unknown): string | undefined {
  const value = thrown as { to?: string; options?: { to?: string } } | null;
  return value?.options?.to ?? value?.to;
}

async function loadAuthSecurity() {
  // Import dinâmico: o módulo mantém cache de papéis em escopo de módulo,
  // então cada teste precisa de uma instância limpa.
  vi.resetModules();
  return import("@/lib/auth-security");
}

beforeEach(() => {
  useSupabase(createSupabaseMock().supabase);
});

describe("inspectPrivilegedSession — exigência de AAL2", () => {
  it("exige 2FA para admin que só apresentou senha (AAL1)", async () => {
    useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal1" }).supabase);
    const { inspectPrivilegedSession } = await loadAuthSecurity();

    const status = await inspectPrivilegedSession(makeUser());

    expect(status.privileged).toBe(true);
    expect(status.assuranceLevel).toBe("aal1");
    expect(status.requiresMfa).toBe(true);
  });

  it.each(["admin", "moderador", "equipe"] as const)(
    "exige 2FA para o papel privilegiado '%s' em AAL1",
    async (role) => {
      useSupabase(createSupabaseMock({ roles: [role], assuranceLevel: "aal1" }).supabase);
      const { inspectPrivilegedSession } = await loadAuthSecurity();

      const status = await inspectPrivilegedSession(makeUser());

      expect(status.privileged).toBe(true);
      expect(status.requiresMfa).toBe(true);
    },
  );

  it("libera admin que já confirmou o segundo fator (AAL2)", async () => {
    useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal2" }).supabase);
    const { inspectPrivilegedSession } = await loadAuthSecurity();

    const status = await inspectPrivilegedSession(makeUser());

    expect(status.privileged).toBe(true);
    expect(status.requiresMfa).toBe(false);
  });

  it.each(["gratuito", "premium", "visitante"] as const)(
    "não exige 2FA do papel comum '%s'",
    async (role) => {
      useSupabase(createSupabaseMock({ roles: [role], assuranceLevel: "aal1" }).supabase);
      const { inspectPrivilegedSession } = await loadAuthSecurity();

      const status = await inspectPrivilegedSession(makeUser());

      expect(status.privileged).toBe(false);
      expect(status.requiresMfa).toBe(false);
    },
  );

  it("trata usuário com papel privilegiado E comum como privilegiado", async () => {
    useSupabase(
      createSupabaseMock({
        roles: ["gratuito", "admin"],
        assuranceLevel: "aal1",
      }).supabase,
    );
    const { inspectPrivilegedSession } = await loadAuthSecurity();

    expect((await inspectPrivilegedSession(makeUser())).requiresMfa).toBe(true);
  });

  it("assume AAL1 quando o Supabase não informa o nível (fail-safe)", async () => {
    const { supabase } = createSupabaseMock({ roles: ["admin"] });
    supabase.auth.mfa.getAuthenticatorAssuranceLevel = vi.fn(async () => ({
      data: { currentLevel: undefined, nextLevel: undefined },
      error: null,
    })) as never;
    useSupabase(supabase);
    const { inspectPrivilegedSession } = await loadAuthSecurity();

    const status = await inspectPrivilegedSession(makeUser());

    expect(status.assuranceLevel).toBe("aal1");
    expect(status.requiresMfa).toBe(true);
  });
});

describe("guard global de /_authenticated", () => {
  async function runGuard(pathname: string) {
    vi.resetModules();
    const { Route } = await import("@/routes/_authenticated/route");
    const beforeLoad = (Route.options as { beforeLoad?: (ctx: unknown) => Promise<unknown> })
      .beforeLoad;
    if (!beforeLoad) throw new Error("beforeLoad ausente no guard de /_authenticated");
    return beforeLoad({ location: { pathname } });
  }

  it("prende admin em AAL1 na tela /seguranca ao tentar abrir /admin", async () => {
    useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal1" }).supabase);

    // O guard sinaliza redirecionamento lançando o objeto de redirect.
    const outcome = await runGuard("/admin").then(
      (value) => ({ redirected: false as const, value }),
      (thrown) => ({ redirected: true as const, thrown }),
    );

    expect(outcome.redirected).toBe(true);
    expect(redirectTarget((outcome as { thrown: unknown }).thrown)).toBe("/seguranca");
  });

  it.each(["/inicio", "/carteira", "/perfil", "/reservas", "/staff/checkin"])(
    "bloqueia admin em AAL1 também na rota %s",
    async (pathname) => {
      useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal1" }).supabase);

      const outcome = await runGuard(pathname).then(
        () => ({ redirected: false as const }),
        (thrown) => ({ redirected: true as const, thrown }),
      );

      expect(outcome.redirected).toBe(true);
    },
  );

  it("permite que admin em AAL1 permaneça em /seguranca para concluir o 2FA", async () => {
    useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal1" }).supabase);

    const context = (await runGuard("/seguranca")) as { privileged: boolean };

    expect(context.privileged).toBe(true);
  });

  it("libera admin em AAL2 em qualquer rota autenticada", async () => {
    useSupabase(createSupabaseMock({ roles: ["admin"], assuranceLevel: "aal2" }).supabase);

    const context = (await runGuard("/admin")) as {
      privileged: boolean;
      assuranceLevel: string;
    };

    expect(context.privileged).toBe(true);
    expect(context.assuranceLevel).toBe("aal2");
  });

  it("não atrapalha membro comum em AAL1", async () => {
    useSupabase(createSupabaseMock({ roles: ["premium"], assuranceLevel: "aal1" }).supabase);

    const context = (await runGuard("/inicio")) as { privileged: boolean };

    expect(context.privileged).toBe(false);
  });

  it("manda visitante sem sessão para /auth", async () => {
    useSupabase(createSupabaseMock({ user: null }).supabase);

    const outcome = await runGuard("/inicio").then(
      () => ({ redirected: false as const }),
      (thrown) => ({ redirected: true as const, thrown }),
    );

    expect(outcome.redirected).toBe(true);
    expect(redirectTarget((outcome as { thrown: unknown }).thrown)).toBe("/auth");
  });
});
