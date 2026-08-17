import { describe, it, expect } from "vitest";
import { fofocometroPercent, selectFofocometroGoal, type FofocometroGoal } from "@/lib/fofocometro";

/**
 * O Fofocômetro é a barra de progresso coletiva do evento: quantas fofoquinhas
 * faltam para a casa liberar o prêmio. `fofocometroPercent` alimenta a barra e
 * `selectFofocometroGoal` decide QUAL meta aparece quando existem várias.
 */

function meta(overrides: Partial<FofocometroGoal> = {}): FofocometroGoal {
  return {
    id: "meta-1",
    event_id: "ev-1",
    campaign_id: null,
    name: "Primeira fofoca",
    stage_order: 1,
    target_count: 100,
    current_count: 0,
    status: "scheduled",
    starts_at: null,
    completed_at: null,
    reward_description: null,
    ...overrides,
  };
}

describe("fofocometroPercent", () => {
  it.each([
    [0, 100, 0],
    [25, 100, 25],
    [50, 100, 50],
    [100, 100, 100],
  ])("com %d de %d devolve %d%%", (current, target, expected) => {
    expect(fofocometroPercent(meta({ current_count: current, target_count: target }))).toBe(
      expected,
    );
  });

  it("arredonda para o inteiro mais próximo", () => {
    expect(fofocometroPercent(meta({ current_count: 1, target_count: 3 }))).toBe(33);
    expect(fofocometroPercent(meta({ current_count: 2, target_count: 3 }))).toBe(67);
  });

  it("limita em 100% quando a casa passou da meta", () => {
    expect(fofocometroPercent(meta({ current_count: 250, target_count: 100 }))).toBe(100);
  });

  it("não divide por zero quando target_count é 0 (guarda Math.max(...,1))", () => {
    expect(fofocometroPercent(meta({ current_count: 0, target_count: 0 }))).toBe(0);
    expect(fofocometroPercent(meta({ current_count: 1, target_count: 0 }))).toBe(100);
  });

  it("trata target_count negativo como 1 em vez de inverter o sinal", () => {
    expect(fofocometroPercent(meta({ current_count: 3, target_count: -5 }))).toBe(100);
    expect(fofocometroPercent(meta({ current_count: 0, target_count: -5 }))).toBe(0);
  });

  it("COMPORTAMENTO ATUAL: current_count negativo produz porcentagem negativa", () => {
    // O clamp só existe no teto (`Math.min(100, ...)`). Um contador negativo,
    // que só apareceria por bug de contagem no banco, vaza para a barra.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(fofocometroPercent(meta({ current_count: -10, target_count: 100 }))).toBe(-10);
  });
});

describe("selectFofocometroGoal — precedência", () => {
  it("prefere a meta ativa mesmo quando ela não é a primeira da lista", () => {
    const agendada = meta({ id: "agendada", status: "scheduled", stage_order: 1 });
    const ativa = meta({ id: "ativa", status: "active", stage_order: 2 });

    expect(selectFofocometroGoal([agendada, ativa])?.id).toBe("ativa");
  });

  it("prefere a meta ativa mesmo havendo concluída de estágio maior", () => {
    const concluida = meta({ id: "concluida", status: "completed", stage_order: 9 });
    const ativa = meta({ id: "ativa", status: "active", stage_order: 1 });

    expect(selectFofocometroGoal([concluida, ativa])?.id).toBe("ativa");
  });

  it("cai para a agendada quando não há nenhuma ativa", () => {
    const concluida = meta({ id: "concluida", status: "completed", stage_order: 9 });
    const agendada = meta({ id: "agendada", status: "scheduled", stage_order: 2 });

    expect(selectFofocometroGoal([concluida, agendada])?.id).toBe("agendada");
  });

  it("usa a primeira ativa da lista quando existe mais de uma", () => {
    const primeira = meta({ id: "primeira", status: "active" });
    const segunda = meta({ id: "segunda", status: "active" });

    expect(selectFofocometroGoal([primeira, segunda])?.id).toBe("primeira");
  });

  it("cai para a concluída de maior stage_order quando só restam concluídas", () => {
    const goals = [
      meta({ id: "etapa-1", status: "completed", stage_order: 1 }),
      meta({ id: "etapa-3", status: "completed", stage_order: 3 }),
      meta({ id: "etapa-2", status: "completed", stage_order: 2 }),
    ];

    expect(selectFofocometroGoal(goals)?.id).toBe("etapa-3");
  });

  it("não reordena o array recebido ao escolher a concluída de maior estágio", () => {
    const goals = [
      meta({ id: "etapa-1", status: "completed", stage_order: 1 }),
      meta({ id: "etapa-3", status: "completed", stage_order: 3 }),
    ];

    selectFofocometroGoal(goals);

    expect(goals.map((goal) => goal.id)).toEqual(["etapa-1", "etapa-3"]);
  });

  it("devolve null quando só existem metas canceladas", () => {
    expect(selectFofocometroGoal([meta({ status: "cancelled" })])).toBeNull();
  });

  it("devolve null para lista vazia", () => {
    expect(selectFofocometroGoal([])).toBeNull();
  });
});

describe("selectFofocometroGoal — filtro por evento", () => {
  const daCasa = meta({ id: "da-casa", event_id: "ev-1", status: "active" });
  const deOutroEvento = meta({ id: "de-outro", event_id: "ev-2", status: "active" });

  it("considera apenas metas do evento informado", () => {
    expect(selectFofocometroGoal([deOutroEvento, daCasa], "ev-1")?.id).toBe("da-casa");
    expect(selectFofocometroGoal([daCasa, deOutroEvento], "ev-2")?.id).toBe("de-outro");
  });

  it("devolve null quando nenhuma meta pertence ao evento", () => {
    expect(selectFofocometroGoal([daCasa, deOutroEvento], "ev-99")).toBeNull();
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["string vazia", ""],
  ])("não filtra quando eventId é %s", (_rotulo, eventId) => {
    // Os três são falsy, então a lista inteira entra na disputa.
    expect(selectFofocometroGoal([deOutroEvento, daCasa], eventId)?.id).toBe("de-outro");
  });

  it("aplica a precedência dentro do evento, não globalmente", () => {
    const goals = [
      meta({ id: "ativa-outro-evento", event_id: "ev-2", status: "active" }),
      meta({ id: "agendada-do-evento", event_id: "ev-1", status: "scheduled" }),
    ];

    expect(selectFofocometroGoal(goals, "ev-1")?.id).toBe("agendada-do-evento");
  });
});
