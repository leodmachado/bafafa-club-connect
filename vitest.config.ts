import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Configuração de testes separada do `vite.config.ts` do app.
 *
 * O app usa `@lovable.dev/vite-tanstack-config`, que monta o pipeline completo
 * do TanStack Start (rotas, nitro, SSR). Os testes não precisam disso — só do
 * alias `@/` e de um DOM. Manter os dois arquivos separados evita que uma
 * mudança no build quebre a suíte (e vice-versa).
 *
 * O alias é declarado explicitamente em vez de usar `vite-tsconfig-paths`
 * porque `tsconfig.json` só inclui `src/**`; os arquivos de `test/**` ficariam
 * de fora da resolução do plugin.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    restoreMocks: true,
    clearMocks: true,
  },
});
