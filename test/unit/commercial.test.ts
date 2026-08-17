import { describe, it, expect } from "vitest";
import { formatMoneyFromCents, formatPhoneBR, normalizePhoneE164BR } from "@/lib/commercial";

/**
 * `src/lib/commercial.ts` formata dinheiro e telefone de cliente real — é o que
 * aparece no CRM e no WhatsApp da casa. Erro aqui vira cobrança errada ou
 * mensagem que não chega.
 *
 * Vários casos abaixo documentam o comportamento ATUAL, não o desejado. Estão
 * marcados com "COMPORTAMENTO ATUAL" e listados em
 * `docs/ACHADOS_DOS_TESTES_2026-08.md`.
 */

/**
 * O `Intl` do pt-BR separa "R$" do número com espaço não separável (U+00A0).
 * Comparar com espaço comum falharia por um caractere invisível, então
 * normalizamos antes de comparar em vez de colar U+00A0 nas asserções.
 */
function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

describe("formatMoneyFromCents", () => {
  it.each([
    [0, "R$ 0,00"],
    [1, "R$ 0,01"],
    [999, "R$ 9,99"],
    [123456, "R$ 1.234,56"],
    [-500, "-R$ 5,00"],
  ])("formata %d centavos como %s", (cents, expected) => {
    expect(normalizeSpaces(formatMoneyFromCents(cents))).toBe(expected);
  });

  it("trata null e undefined como zero em vez de quebrar a tela", () => {
    expect(normalizeSpaces(formatMoneyFromCents(null))).toBe("R$ 0,00");
    expect(normalizeSpaces(formatMoneyFromCents(undefined))).toBe("R$ 0,00");
  });

  it("aceita bigint, que é como o Postgres devolve colunas int8", () => {
    expect(normalizeSpaces(formatMoneyFromCents(123456n))).toBe("R$ 1.234,56");
    expect(normalizeSpaces(formatMoneyFromCents(-123456n))).toBe("-R$ 1.234,56");
  });

  it("sempre mostra duas casas decimais, mesmo em valores redondos", () => {
    expect(normalizeSpaces(formatMoneyFromCents(10000))).toBe("R$ 100,00");
  });

  it("arredonda centavos fracionários em vez de truncar", () => {
    // 12345,6 centavos = R$ 123,456 -> arredonda para cima.
    expect(normalizeSpaces(formatMoneyFromCents(12345.6))).toBe("R$ 123,46");
    expect(normalizeSpaces(formatMoneyFromCents(12345.4))).toBe("R$ 123,45");
  });

  it("mantém o agrupamento de milhar em valores grandes", () => {
    expect(normalizeSpaces(formatMoneyFromCents(1_000_000_00))).toBe("R$ 1.000.000,00");
  });

  it("COMPORTAMENTO ATUAL: bigint acima de Number.MAX_SAFE_INTEGER perde precisão", () => {
    // O código faz `Number(value)` sem checar faixa. Não é um problema prático
    // para uma casa noturna (seriam ~90 quatrilhões de reais), mas registra que
    // a conversão é silenciosa.
    const acimaDoSeguro = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
    expect(formatMoneyFromCents(acimaDoSeguro)).toBe(
      formatMoneyFromCents(BigInt(Number.MAX_SAFE_INTEGER) + 1n),
    );
  });
});

describe("formatPhoneBR", () => {
  it.each([
    ["", ""],
    ["1", "1"],
    ["11", "11"],
    ["119", "(11) 9"],
    ["1198765", "(11) 98765"],
  ])("formata parcialmente enquanto o usuário digita: %s -> %s", (input, expected) => {
    expect(formatPhoneBR(input)).toBe(expected);
  });

  it("formata celular de 11 dígitos com DDD", () => {
    expect(formatPhoneBR("11987654321")).toBe("(11) 98765-4321");
  });

  it("ignora máscara já aplicada e reformata", () => {
    expect(formatPhoneBR("(11) 98765-4321")).toBe("(11) 98765-4321");
  });

  it("descarta o prefixo internacional +55", () => {
    expect(formatPhoneBR("+55 11 98765-4321")).toBe("(11) 98765-4321");
  });

  it("descarta dígitos além do 11º", () => {
    expect(formatPhoneBR("11987654321999")).toBe("(11) 98765-4321");
  });

  it("devolve string vazia para entrada sem nenhum dígito", () => {
    expect(formatPhoneBR("abc")).toBe("");
    expect(formatPhoneBR("()- ")).toBe("");
  });

  it("COMPORTAMENTO ATUAL: agrupa fixo de 10 dígitos de forma errada", () => {
    // (11) 3265-4321 seria o correto para telefone fixo. A função sempre corta
    // no 7º dígito, então sai "(11) 32654-321". Ver ACHADOS.
    expect(formatPhoneBR("1132654321")).toBe("(11) 32654-321");
  });

  it("COMPORTAMENTO ATUAL: come o DDD 55 achando que é código do país", () => {
    // O `.replace(/^55/, "")` roda antes de saber o tamanho do número, então
    // números do DDD 55 (Santa Maria/RS) perdem o próprio DDD. Ver ACHADOS.
    expect(formatPhoneBR("5511111111")).toBe("(11) 11111-1");
  });

  it("COMPORTAMENTO ATUAL: não remove zeros à esquerda (diferente de normalizePhoneE164BR)", () => {
    expect(formatPhoneBR("0011987654321")).toBe("(00) 11987-6543");
  });
});

describe("normalizePhoneE164BR", () => {
  it("adiciona +55 a celular de 11 dígitos", () => {
    expect(normalizePhoneE164BR("11987654321")).toBe("+5511987654321");
  });

  it("adiciona +55 a fixo de 10 dígitos", () => {
    expect(normalizePhoneE164BR("1132654321")).toBe("+551132654321");
  });

  it("preserva número que já vem com código do país", () => {
    expect(normalizePhoneE164BR("5511987654321")).toBe("+5511987654321");
    expect(normalizePhoneE164BR("+55 (11) 98765-4321")).toBe("+5511987654321");
  });

  it("remove zeros à esquerda do discagem interurbana", () => {
    expect(normalizePhoneE164BR("011987654321")).toBe("+5511987654321");
    expect(normalizePhoneE164BR("000011987654321")).toBe("+5511987654321");
  });

  it("não confunde DDD 55 com código do país em número de 10 dígitos", () => {
    // "5512345678" tem só 10 dígitos, então cai na regra de DDD e vira
    // +55 55 1234-5678 — o resultado correto.
    expect(normalizePhoneE164BR("5512345678")).toBe("+555512345678");
  });

  it("ignora máscara, espaços e pontuação", () => {
    expect(normalizePhoneE164BR("(11) 9 8765-4321")).toBe("+5511987654321");
  });

  it("COMPORTAMENTO ATUAL: entrada sem dígitos vira apenas '+'", () => {
    // Nenhum caller trata esse retorno como inválido. Ver ACHADOS.
    expect(normalizePhoneE164BR("")).toBe("+");
    expect(normalizePhoneE164BR("abc")).toBe("+");
  });

  it("COMPORTAMENTO ATUAL: número com quantidade inesperada de dígitos sai sem DDI", () => {
    // Celular digitado sem DDD (9 dígitos) não é rejeitado — vira "+987654321".
    expect(normalizePhoneE164BR("987654321")).toBe("+987654321");
  });

  it("COMPORTAMENTO ATUAL: número estrangeiro é transformado em brasileiro", () => {
    // +1 202 555 0100 (EUA) tem 11 dígitos, então recebe +55 na frente.
    // Ver ACHADOS — é o achado mais sério deste módulo.
    expect(normalizePhoneE164BR("+1 202 555 0100")).toBe("+5512025550100");
  });
});
