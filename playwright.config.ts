import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta do Bafafá Connect.
 *
 * Determinismo é o requisito principal desta suíte. Três decisões garantem
 * isso:
 *
 * 1. A suíte roda contra o BUILD DE PRODUÇÃO, não contra `vite dev`. O servidor
 *    de desenvolvimento compila cada rota sob demanda, e a primeira visita a
 *    uma tela custava mais de um minuto — o primeiro teste de cada rota
 *    falhava por timeout enquanto os demais passavam. O build já vem pronto.
 *    Usamos o preset `node-server` do nitro só para os testes; o deploy real
 *    (Cloudflare/Vercel) continua como está.
 *
 * 2. `VITE_SUPABASE_URL` aponta para um "project ref" que não existe
 *    (`e2estub.supabase.co`). Todas as chamadas são interceptadas pelo harness
 *    em `e2e/harness/supabase-stub.ts`, e o ref é completamente diferente do de
 *    produção (`xijjohgokwfkqfkkhsyn`), então nenhum teste consegue tocar o
 *    banco real nem por engano. O host precisa terminar em `.supabase.co`
 *    porque a CSP do próprio app (`src/lib/security-headers.ts`) só libera
 *    `connect-src https://*.supabase.co`.
 *
 * 3. Relógio, fuso, locale e viewport são fixados, para que formatação de data
 *    e moeda em pt-BR não dependa da máquina que roda a suíte.
 */

const PORT = Number(process.env.E2E_PORT ?? 4321);
const BASE_URL = `http://127.0.0.1:${PORT}`;

const STUB_ENV = {
  VITE_SUPABASE_URL: "https://e2estub.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_stub",
  SUPABASE_URL: "https://e2estub.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_stub",
};

export default defineConfig({
  testDir: "./e2e/specs",
  outputDir: "./e2e/.results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],
  // /admin é a rota mais pesada do app (~300 kB); sob execução paralela
  // ela leva mais de 10 s para hidratar. Os limites abaixo têm folga para
  // isso sem esconder travamento real.
  timeout: 60_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: BASE_URL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"], locale: "pt-BR", timezoneId: "America/Sao_Paulo" },
    },
  ],

  webServer: {
    // `E2E_SKIP_BUILD=1` reaproveita o build anterior enquanto se escreve
    // testes localmente; a CI sempre constrói do zero.
    command: process.env.E2E_SKIP_BUILD
      ? "node .output/server/index.mjs"
      : "npm run e2e:build && node .output/server/index.mjs",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: { ...STUB_ENV, PORT: String(PORT) },
  },
});
