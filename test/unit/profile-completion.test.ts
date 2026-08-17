import { describe, it, expect } from "vitest";
import {
  EMPTY_PROFILE_COMPLETION,
  nextProfileTask,
  parseProfileCompletion,
} from "@/lib/profile-completion";

/**
 * `parseProfileCompletion` recebe um `jsonb` vindo de RPC do Supabase — ou seja,
 * `unknown` de verdade. Se ele explodir, a tela de perfil não renderiza. Os
 * testes abaixo jogam entrada hostil para garantir que ele sempre devolve a
 * forma esperada.
 */

describe("parseProfileCompletion — entrada inválida", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "75%"],
    ["número", 42],
    ["booleano", true],
    ["zero", 0],
  ])("devolve o objeto vazio para %s", (_rotulo, entrada) => {
    expect(parseProfileCompletion(entrada)).toEqual(EMPTY_PROFILE_COMPLETION);
  });

  it("COMPORTAMENTO ATUAL: array não é rejeitado, apenas cai no resultado vazio", () => {
    // `typeof [] === "object"`, então a guarda inicial deixa passar. O efeito
    // prático é o mesmo (items vazio, 0%), mas por acidente e não por checagem.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(parseProfileCompletion([{ key: "foto", label: "Foto" }])).toEqual({
      percentage: 0,
      items: [],
      next_key: null,
    });
  });

  it("não devolve a constante EMPTY_PROFILE_COMPLETION por referência", () => {
    // Um objeto compartilhado poderia ser mutado por quem consome. Aqui vale
    // apenas para o caminho de objeto válido — os inválidos devolvem a constante.
    const resultado = parseProfileCompletion({});
    expect(resultado).not.toBe(EMPTY_PROFILE_COMPLETION);
    expect(resultado).toEqual(EMPTY_PROFILE_COMPLETION);
  });
});

describe("parseProfileCompletion — percentage", () => {
  it("mantém percentual numérico dentro da faixa", () => {
    expect(parseProfileCompletion({ percentage: 60 }).percentage).toBe(60);
  });

  it("converte percentual em string, como o jsonb às vezes devolve", () => {
    expect(parseProfileCompletion({ percentage: "75" }).percentage).toBe(75);
  });

  it("limita acima de 100 e abaixo de 0", () => {
    expect(parseProfileCompletion({ percentage: 150 }).percentage).toBe(100);
    expect(parseProfileCompletion({ percentage: -20 }).percentage).toBe(0);
    expect(parseProfileCompletion({ percentage: "999" }).percentage).toBe(100);
  });

  it("assume 0 quando percentage está ausente ou é null", () => {
    expect(parseProfileCompletion({}).percentage).toBe(0);
    expect(parseProfileCompletion({ percentage: null }).percentage).toBe(0);
  });

  it("COMPORTAMENTO ATUAL: percentual não numérico vira NaN em vez de 0", () => {
    // `Math.max(0, Math.min(100, NaN))` é NaN — o clamp não protege contra isso.
    // Na UI o NaN chega em `style={{ width: `${percentage}%` }}`.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(parseProfileCompletion({ percentage: "muito" }).percentage).toBeNaN();
    expect(parseProfileCompletion({ percentage: Number.NaN }).percentage).toBeNaN();
  });
});

describe("parseProfileCompletion — items", () => {
  it("converte itens bem formados", () => {
    const detalhes = parseProfileCompletion({
      percentage: 50,
      items: [
        { key: "foto", label: "Adicione uma foto", weight: 30, complete: false },
        { key: "aniversario", label: "Informe o aniversário", weight: 20, complete: true },
      ],
      next_key: "foto",
    });

    expect(detalhes.items).toEqual([
      { key: "foto", label: "Adicione uma foto", weight: 30, complete: false },
      { key: "aniversario", label: "Informe o aniversário", weight: 20, complete: true },
    ]);
    expect(detalhes.next_key).toBe("foto");
  });

  it("descarta itens malformados sem derrubar os válidos", () => {
    const detalhes = parseProfileCompletion({
      items: [
        null,
        "foto",
        42,
        { label: "sem chave" },
        { key: "sem-label" },
        { key: 10, label: "chave numérica" },
        { key: "ok", label: "Item válido" },
      ],
    });

    expect(detalhes.items).toHaveLength(1);
    expect(detalhes.items[0].key).toBe("ok");
  });

  it("usa lista vazia quando items não é array", () => {
    expect(parseProfileCompletion({ items: "foto,aniversario" }).items).toEqual([]);
    expect(parseProfileCompletion({ items: { foto: true } }).items).toEqual([]);
    expect(parseProfileCompletion({ items: null }).items).toEqual([]);
  });

  it.each([
    ["booleano true", true, true],
    ["a string 'true'", "true", true],
    ["booleano false", false, false],
    ["a string 'false'", "false", false],
    ["o número 1", 1, false],
    ["ausente", undefined, false],
  ])("interpreta complete = %s como %s", (_rotulo, complete, esperado) => {
    const detalhes = parseProfileCompletion({ items: [{ key: "k", label: "L", complete }] });
    expect(detalhes.items[0].complete).toBe(esperado);
  });

  it("converte weight em string e usa 0 quando ausente", () => {
    const detalhes = parseProfileCompletion({
      items: [
        { key: "a", label: "A", weight: "30" },
        { key: "b", label: "B" },
        { key: "c", label: "C", weight: null },
      ],
    });

    expect(detalhes.items.map((item) => item.weight)).toEqual([30, 0, 0]);
  });

  it("COMPORTAMENTO ATUAL: weight não numérico vira NaN", () => {
    const detalhes = parseProfileCompletion({
      items: [{ key: "a", label: "A", weight: "pesado" }],
    });
    expect(detalhes.items[0].weight).toBeNaN();
  });
});

describe("parseProfileCompletion — next_key", () => {
  it.each([
    ["número", 3],
    ["null", null],
    ["objeto", {}],
    ["ausente", undefined],
  ])("devolve null quando next_key é %s", (_rotulo, next_key) => {
    expect(parseProfileCompletion({ next_key }).next_key).toBeNull();
  });
});

describe("nextProfileTask", () => {
  it("devolve o primeiro item incompleto na ordem da lista", () => {
    const detalhes = parseProfileCompletion({
      items: [
        { key: "foto", label: "Foto", complete: true },
        { key: "bio", label: "Bio", complete: false },
        { key: "fone", label: "Telefone", complete: false },
      ],
    });

    expect(nextProfileTask(detalhes)?.key).toBe("bio");
  });

  it("devolve null quando tudo está completo", () => {
    const detalhes = parseProfileCompletion({
      items: [{ key: "foto", label: "Foto", complete: true }],
    });

    expect(nextProfileTask(detalhes)).toBeNull();
  });

  it("devolve null para perfil sem itens", () => {
    expect(nextProfileTask(EMPTY_PROFILE_COMPLETION)).toBeNull();
  });

  it("COMPORTAMENTO ATUAL: ignora next_key e pode discordar dele", () => {
    // O banco manda `next_key`, mas `nextProfileTask` recalcula pela ordem dos
    // itens. Se os dois divergirem, cada lugar da UI mostra uma tarefa
    // diferente. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const detalhes = parseProfileCompletion({
      next_key: "fone",
      items: [
        { key: "bio", label: "Bio", complete: false },
        { key: "fone", label: "Telefone", complete: false },
      ],
    });

    expect(detalhes.next_key).toBe("fone");
    expect(nextProfileTask(detalhes)?.key).toBe("bio");
  });
});
