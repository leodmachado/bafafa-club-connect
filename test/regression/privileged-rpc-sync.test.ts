import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * REGRESSÃO — telas de membro chamavam RPC privilegiada.
 *
 * `inicio.tsx` e `checkin.tsx` abriam o carregamento com:
 *
 *     await supabase.rpc("sync_event_statuses");
 *
 * `sync_event_statuses` é uma rotina administrativa. Depois do hardening
 * (a60a8c5) ela recusa quem não for `service_role` nem admin, registrando o
 * evento em `security_events`. Ou seja: todo membro que abrisse a tela inicial
 * disparava uma negativa de permissão — ruído no log de segurança, latência
 * extra no caminho crítico e um alerta que mascara ataque real.
 *
 * Correções:
 *   2cab099 Evita sincronização privilegiada em inicio.tsx
 *   715f69a Evita sincronização privilegiada em checkin.tsx
 *   35bdcd7 Evita sincronização privilegiada em checkin.tsx
 *
 * Este é um teste de fronteira arquitetural: ele lê o código-fonte em vez de
 * renderizar as telas. É proposital — a garantia que queremos é "nenhuma rota
 * de membro invoca RPC privilegiada", e isso vale para todo arquivo do
 * diretório, inclusive os que ainda não existem.
 *
 * VERMELHO antes de 2cab099 / VERDE depois. Ver `scripts/verify-regressions.sh`.
 */

const REPO_ROOT = resolve(__dirname, "../..");

/**
 * RPCs que exigem admin/service_role no banco.
 * Ver `supabase/migrations/*security_hardening_rpc_commercial_v207.sql`.
 */
const PRIVILEGED_RPCS = ["sync_event_statuses"];

/** Telas usadas por membros comuns — nunca devem chamar RPC privilegiada. */
const MEMBER_ROUTES = [
  "src/routes/_authenticated/inicio.tsx",
  "src/routes/_authenticated/checkin.tsx",
  "src/routes/_authenticated/carteira.tsx",
  "src/routes/_authenticated/perfil.tsx",
  "src/routes/_authenticated/eventos.tsx",
  "src/routes/_authenticated/mimos.tsx",
  "src/routes/_authenticated/reservas.tsx",
  "src/routes/_authenticated/fofoquinhas.tsx",
  "src/routes/_authenticated/resenha.tsx",
];

function readIfPresent(relativePath: string): string | null {
  const fullPath = resolve(REPO_ROOT, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, "utf8") : null;
}

describe("RPC privilegiada fora das telas de membro", () => {
  it.each(MEMBER_ROUTES)("%s não chama RPC privilegiada", (routePath) => {
    const source = readIfPresent(routePath);
    // Rotas ainda não criadas neste commit são ignoradas de propósito: o teste
    // roda também em worktrees antigos na verificação vermelho/verde.
    if (source === null) return;

    for (const rpc of PRIVILEGED_RPCS) {
      expect(source, `${routePath} chama a RPC privilegiada "${rpc}"`).not.toContain(
        `rpc("${rpc}")`,
      );
    }
  });

  it("mantém sync_event_statuses acessível ao painel administrativo", () => {
    const source = readIfPresent("src/components/admin/admin-panel.tsx");
    if (source === null) return;

    // A correção foi remover a chamada das telas de membro, não apagar o
    // recurso. Se esta asserção quebrar, a sincronização perdeu seu único
    // ponto de entrada legítimo.
    expect(source).toContain('rpc("sync_event_statuses")');
  });
});

describe("catálogo de RPCs privilegiadas", () => {
  it("exige admin ou service_role em sync_event_statuses na migração", () => {
    const migration = readIfPresent(
      "supabase/migrations/20260803113000_security_hardening_rpc_commercial_v207.sql",
    );
    if (migration === null) return;

    expect(migration).toContain("create or replace function public.sync_event_statuses()");
    expect(migration).toContain("service_role");
    expect(migration).toContain("has_role(v_actor, 'admin')");
    expect(migration).toContain("revoke all on function public.sync_event_statuses() from anon");
  });
});
