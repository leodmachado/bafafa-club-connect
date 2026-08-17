import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSupabaseMock } from "../helpers/supabase-mock";

/**
 * `checkCommunityContent` é o filtro de palavrão/discurso de ódio para nome de
 * exibição, @usuario e mensagens da Resenha. A decisão real acontece na RPC
 * `check_content_allowed`; aqui testamos o contrato do lado do cliente —
 * inclusive o que acontece quando a RPC falha.
 */

const mockRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    if (!mockRef.current) throw new Error("dublê do Supabase não foi configurado no teste");
    return mockRef.current;
  },
}));

function injetarSupabase(double: ReturnType<typeof createSupabaseMock>["supabase"]) {
  mockRef.current = double;
}

async function loadModeration() {
  vi.resetModules();
  return import("@/lib/content-moderation");
}

/** Monta o dublê já com a resposta desejada da RPC de moderação. */
function comRespostaDaRpc(response: { data?: unknown; error?: unknown }) {
  const mock = createSupabaseMock({ rpcResponses: { check_content_allowed: response } });
  injetarSupabase(mock.supabase);
  return mock;
}

beforeEach(() => {
  injetarSupabase(createSupabaseMock().supabase);
});

describe("checkCommunityContent — atalho para texto vazio", () => {
  it.each([
    ["string vazia", ""],
    ["só espaços", "   "],
    ["quebras de linha e tabs", "\n\t  \n"],
  ])("libera %s sem chamar a RPC", async (_rotulo, valor) => {
    const mock = comRespostaDaRpc({ data: { allowed: false } });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent(valor, "chat")).resolves.toBe("allowed");
    expect(mock.spies.rpc).not.toHaveBeenCalled();
  });
});

describe("checkCommunityContent — decisão da RPC", () => {
  it("devolve 'allowed' quando a RPC aprova", async () => {
    comRespostaDaRpc({ data: { allowed: true } });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent("Fofoqueira do Bafafã", "display_name")).resolves.toBe(
      "allowed",
    );
  });

  it("devolve 'blocked' quando a RPC reprova", async () => {
    comRespostaDaRpc({ data: { allowed: false } });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent("texto proibido", "chat")).resolves.toBe("blocked");
  });

  it.each([
    ["allowed ausente", { motivo: "palavrao" }],
    ["allowed como string 'true'", { allowed: "true" }],
    ["allowed como 1", { allowed: 1 }],
    ["data null", null],
  ])("bloqueia quando a resposta é %s (só `=== true` libera)", async (_rotulo, data) => {
    comRespostaDaRpc({ data });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent("qualquer texto", "username")).resolves.toBe("blocked");
  });

  it("repassa o valor e o contexto para a RPC", async () => {
    const mock = comRespostaDaRpc({ data: { allowed: true } });
    const { checkCommunityContent } = await loadModeration();

    await checkCommunityContent("Fulana da Resenha", "display_name");

    expect(mock.spies.rpc).toHaveBeenCalledWith("check_content_allowed", {
      _value: "Fulana da Resenha",
      _context: "display_name",
    });
  });

  it("não apara o texto antes de mandar para a RPC", async () => {
    // O `.trim()` só decide se vale a pena chamar; o valor enviado é o original.
    const mock = comRespostaDaRpc({ data: { allowed: true } });
    const { checkCommunityContent } = await loadModeration();

    await checkCommunityContent("  Fulana  ", "display_name");

    expect(mock.spies.rpc).toHaveBeenCalledWith("check_content_allowed", {
      _value: "  Fulana  ",
      _context: "display_name",
    });
  });

  it.each(["display_name", "username", "chat"] as const)(
    "funciona no contexto '%s'",
    async (contexto) => {
      const mock = comRespostaDaRpc({ data: { allowed: true } });
      const { checkCommunityContent } = await loadModeration();

      await expect(checkCommunityContent("texto", contexto)).resolves.toBe("allowed");
      expect(mock.spies.rpc).toHaveBeenCalledWith(
        "check_content_allowed",
        expect.objectContaining({ _context: contexto }),
      );
    },
  );
});

describe("checkCommunityContent — falha da RPC (fail-open)", () => {
  it("devolve 'unavailable' quando a RPC erra, em vez de 'blocked'", async () => {
    comRespostaDaRpc({ error: { message: "connection refused" } });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent("texto qualquer", "chat")).resolves.toBe("unavailable");
  });

  it("devolve 'unavailable' mesmo quando o erro vem junto de data aprovado", async () => {
    // Erro tem precedência sobre `data` — a checagem de `error` vem antes.
    comRespostaDaRpc({ data: { allowed: true }, error: { message: "timeout" } });
    const { checkCommunityContent } = await loadModeration();

    await expect(checkCommunityContent("texto", "chat")).resolves.toBe("unavailable");
  });

  it("COMPORTAMENTO ATUAL: 'unavailable' é permissivo — os callers só barram 'blocked'", async () => {
    // Toda tela faz `if (moderationStatus === "blocked")`, nunca
    // `!== "allowed"`. Ou seja, se a RPC de moderação cair, o conteúdo passa.
    // Este teste registra a escolha (fail-open) para que uma mudança futura
    // para fail-closed seja consciente. Ver ACHADOS.
    comRespostaDaRpc({ error: { message: "indisponível" } });
    const { checkCommunityContent } = await loadModeration();

    const status = await checkCommunityContent("palavrão que seria bloqueado", "chat");

    expect(status).not.toBe("blocked");
    expect(status).toBe("unavailable");
  });
});
