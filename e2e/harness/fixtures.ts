import { test as base, expect } from "@playwright/test";
import {
  SupabaseStub,
  makeSessionPayload,
  storageKeyForUrl,
  type StubState,
  type StubUser,
} from "./supabase-stub";

const SUPABASE_URL = "https://e2estub.supabase.co";

/**
 * Fixtures dos testes de ponta a ponta.
 *
 * Cada spec recebe um `bafafa` já montado. O fluxo típico é:
 *
 *     await bafafa.start({ session: bafafa.user({ roles: ["admin"], aal: "aal1" }) });
 *     await page.goto("/admin");
 *
 * Nenhuma spec fala com o Supabase diretamente — o harness responde por ele.
 */

export type BafafaHarness = {
  stub: SupabaseStub;
  /** Atalho para descrever um usuário do stub. */
  user: (overrides?: Partial<StubUser>) => StubUser;
  /** Instala a interceptação e, se houver sessão, já deixa o app logado. */
  start: (state?: Partial<StubState>) => Promise<void>;
};

export const test = base.extend<{ bafafa: BafafaHarness }>({
  bafafa: async ({ page, context }, use) => {
    let stub = new SupabaseStub();

    const harness: BafafaHarness = {
      get stub() {
        return stub;
      },

      user: (overrides = {}) => ({
        id: overrides.id ?? "user-teste",
        email: overrides.email ?? "cliente@bafafa.test",
        phone: overrides.phone,
        roles: overrides.roles ?? ["gratuito"],
        aal: overrides.aal ?? "aal1",
        user_metadata: overrides.user_metadata,
      }),

      start: async (state = {}) => {
        stub = new SupabaseStub(state);
        await stub.install(page);

        // Semeia a sessão no localStorage do mesmo jeito que o supabase-js
        // faria depois de um login bem-sucedido. Assim os testes que não são
        // sobre login começam já autenticados, sem passar pelo fluxo de OTP.
        if (stub.state.session) {
          const payload = makeSessionPayload(stub.state.session);
          await context.addInitScript(
            ([key, value]) => {
              window.localStorage.setItem(key as string, value as string);
            },
            [storageKeyForUrl(SUPABASE_URL), JSON.stringify(payload)],
          );
        }
      },
    };

    await use(harness);
  },
});

export { expect };
