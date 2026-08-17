import { describe, it, expect } from "vitest";
import { effectiveEventStatus, withEffectiveEventStatus } from "@/lib/event-status";

/**
 * `src/lib/event-status.ts` decide se um evento aparece como agendado, rolando
 * ou encerrado. É o que libera check-in e chat na tela do membro, então os
 * limites exatos (`starts_at` e `ends_at`) importam.
 *
 * Todos os testes injetam `referenceTime` — a função aceita o parâmetro de
 * propósito, então não há motivo para mexer no relógio global.
 */

const INICIO = Date.parse("2026-08-15T22:00:00.000Z");
const FIM = Date.parse("2026-08-16T04:00:00.000Z");
const UM_MINUTO = 60 * 1000;
const OITO_HORAS = 8 * 60 * 60 * 1000;

function evento(overrides: Partial<Parameters<typeof effectiveEventStatus>[0]> = {}) {
  return {
    status: "published",
    starts_at: new Date(INICIO).toISOString(),
    ends_at: new Date(FIM).toISOString(),
    ...overrides,
  };
}

describe("effectiveEventStatus — limites de horário", () => {
  it("é 'scheduled' antes do início", () => {
    expect(effectiveEventStatus(evento(), INICIO - UM_MINUTO)).toBe("scheduled");
  });

  it("vira 'ongoing' no instante exato de starts_at (limite inclusivo)", () => {
    expect(effectiveEventStatus(evento(), INICIO)).toBe("ongoing");
  });

  it("ainda é 'scheduled' um milissegundo antes de starts_at", () => {
    expect(effectiveEventStatus(evento(), INICIO - 1)).toBe("scheduled");
  });

  it("é 'ongoing' no meio da festa", () => {
    expect(effectiveEventStatus(evento(), (INICIO + FIM) / 2)).toBe("ongoing");
  });

  it("ainda é 'ongoing' no instante exato de ends_at (limite inclusivo)", () => {
    expect(effectiveEventStatus(evento(), FIM)).toBe("ongoing");
  });

  it("vira 'ended' um milissegundo depois de ends_at", () => {
    expect(effectiveEventStatus(evento(), FIM + 1)).toBe("ended");
  });
});

describe("effectiveEventStatus — duração padrão de 8h", () => {
  it("usa 8 horas a partir do início quando ends_at é null", () => {
    const semFim = evento({ ends_at: null });
    expect(effectiveEventStatus(semFim, INICIO + OITO_HORAS)).toBe("ongoing");
    expect(effectiveEventStatus(semFim, INICIO + OITO_HORAS + 1)).toBe("ended");
  });

  it("usa 8 horas quando ends_at está ausente do objeto", () => {
    const semFim = { status: "published", starts_at: new Date(INICIO).toISOString() };
    expect(effectiveEventStatus(semFim, INICIO + OITO_HORAS - 1)).toBe("ongoing");
    expect(effectiveEventStatus(semFim, INICIO + OITO_HORAS + 1)).toBe("ended");
  });

  it("cai para as 8 horas padrão quando ends_at é uma data inválida", () => {
    const fimQuebrado = evento({ ends_at: "amanhã de madrugada" });
    expect(effectiveEventStatus(fimQuebrado, INICIO + OITO_HORAS)).toBe("ongoing");
    expect(effectiveEventStatus(fimQuebrado, INICIO + OITO_HORAS + 1)).toBe("ended");
  });

  it("trata ends_at como string vazia igual a ausente (8h padrão)", () => {
    // "" é falsy, então nem chega a virar Date.
    const fimVazio = evento({ ends_at: "" });
    expect(effectiveEventStatus(fimVazio, INICIO + OITO_HORAS)).toBe("ongoing");
  });
});

describe("effectiveEventStatus — status que não são recalculados", () => {
  it.each(["draft", "cancelled"])(
    "devolve '%s' sem olhar o relógio, mesmo durante o horário do evento",
    (status) => {
      const passthrough = evento({ status });
      expect(effectiveEventStatus(passthrough, INICIO)).toBe(status);
      expect(effectiveEventStatus(passthrough, FIM + 1)).toBe(status);
      expect(effectiveEventStatus(passthrough, INICIO - UM_MINUTO)).toBe(status);
    },
  );

  it("preserva um draft mesmo com starts_at inválido", () => {
    expect(effectiveEventStatus({ status: "draft", starts_at: "não é data" }, INICIO)).toBe(
      "draft",
    );
  });

  it("devolve o status gravado quando starts_at é inválido", () => {
    // Sem início confiável não dá para calcular nada — o valor do banco vale.
    expect(effectiveEventStatus({ status: "published", starts_at: "" }, INICIO)).toBe("published");
    expect(effectiveEventStatus({ status: "ongoing", starts_at: "qualquer coisa" }, INICIO)).toBe(
      "ongoing",
    );
  });

  it("recalcula status vindo do banco que ficou desatualizado", () => {
    // O banco ainda diz "ongoing", mas o evento acabou há horas.
    expect(effectiveEventStatus(evento({ status: "ongoing" }), FIM + OITO_HORAS)).toBe("ended");
    // E o inverso: banco diz "ended", mas a festa ainda nem começou.
    expect(effectiveEventStatus(evento({ status: "ended" }), INICIO - UM_MINUTO)).toBe("scheduled");
  });
});

describe("effectiveEventStatus — dados incoerentes", () => {
  it("COMPORTAMENTO ATUAL: ends_at anterior a starts_at faz o evento nascer encerrado", () => {
    // Não há validação de ordem: no instante do início já vale
    // `referenceTime > endsAt`, então o evento nunca fica "ongoing".
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const invertido = evento({ ends_at: new Date(INICIO - UM_MINUTO).toISOString() });
    expect(effectiveEventStatus(invertido, INICIO)).toBe("ended");
    expect(effectiveEventStatus(invertido, INICIO - UM_MINUTO * 10)).toBe("scheduled");
  });
});

describe("withEffectiveEventStatus", () => {
  it("devolve uma cópia com o status recalculado", () => {
    const original = { ...evento({ status: "ongoing" }), id: "ev-1", nome: "Bafafã de sexta" };

    const resultado = withEffectiveEventStatus(original, FIM + 1);

    expect(resultado.status).toBe("ended");
    expect(resultado.id).toBe("ev-1");
    expect(resultado.nome).toBe("Bafafã de sexta");
  });

  it("não altera o objeto original", () => {
    const original = evento({ status: "published" });

    withEffectiveEventStatus(original, FIM + 1);

    expect(original.status).toBe("published");
  });
});
