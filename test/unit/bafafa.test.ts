import { describe, it, expect, afterEach, vi } from "vitest";
import {
  campaignBenefitLabel,
  formatDateTime,
  formatEventDate,
  formatEventTime,
  rewardStatusLabel,
} from "@/lib/bafafa";

/**
 * `src/lib/bafafa.ts` monta os rótulos que o membro lê na carteirinha e nos
 * mimos. Um rótulo errado aqui é promessa comercial errada no balcão.
 *
 * Sobre os formatadores de data: eles usam `Intl` com o fuso da máquina. Fixar
 * a string exata ("sáb., 15 de ago.") deixaria a suíte refém da versão do ICU e
 * do TZ do CI. Então testamos propriedades estáveis — formato, presença do dia
 * correto, ausência de hora onde não deve haver — em vez do texto literal.
 */

/** Espaço não separável que o `Intl` insere depois de "R$". */
function normalizeSpaces(value: string): string {
  return value.replace(/\u00a0/g, " ");
}

const ISO = "2026-08-15T12:00:00.000Z";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatEventTime", () => {
  it("devolve hora e minuto em 24h com dois dígitos", () => {
    expect(formatEventTime(ISO)).toMatch(/^\d{2}:\d{2}$/);
  });

  it("usa o fuso local, coerente com o próprio Date", () => {
    const data = new Date(ISO);
    const esperado = `${String(data.getHours()).padStart(2, "0")}:${String(
      data.getMinutes(),
    ).padStart(2, "0")}`;

    expect(formatEventTime(ISO)).toBe(esperado);
  });

  it("distingue horários diferentes", () => {
    expect(formatEventTime("2026-08-15T12:00:00.000Z")).not.toBe(
      formatEventTime("2026-08-15T13:30:00.000Z"),
    );
  });
});

describe("formatEventDate", () => {
  it("inclui o dia do mês com dois dígitos", () => {
    const dia = String(new Date(ISO).getDate()).padStart(2, "0");
    expect(formatEventDate(ISO)).toContain(dia);
  });

  it("inclui um dia da semana abreviado", () => {
    // Meio-dia UTC garante que nenhum fuso brasileiro (UTC-2 a UTC-5) vire o dia.
    const diasDaSemana = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
    const rotulo = formatEventDate(ISO).toLowerCase();

    expect(diasDaSemana.some((dia) => rotulo.includes(dia))).toBe(true);
  });

  it("não inclui horário", () => {
    expect(formatEventDate(ISO)).not.toContain(":");
  });
});

describe("formatDateTime", () => {
  it("junta a data e a hora do evento", () => {
    const resultado = formatDateTime(ISO);

    expect(resultado).toContain(String(new Date(ISO).getDate()).padStart(2, "0"));
    expect(resultado).toContain(formatEventTime(ISO));
  });

  it("não inclui o dia da semana", () => {
    expect(formatDateTime(ISO)).not.toMatch(/dom|seg|ter|qua|qui|sex|sáb/i);
  });
});

describe("formatadores de data — entrada inválida", () => {
  it.each([
    ["formatEventDate", formatEventDate],
    ["formatEventTime", formatEventTime],
    ["formatDateTime", formatDateTime],
  ])("COMPORTAMENTO ATUAL: %s lança RangeError em data inválida", (_nome, formatador) => {
    // `Intl.DateTimeFormat.format(Invalid Date)` lança. Nenhum dos três valida a
    // entrada, então um `starts_at` corrompido derruba a renderização inteira em
    // vez de mostrar um traço. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(() => formatador("data quebrada")).toThrow(RangeError);
    expect(() => formatador("")).toThrow(RangeError);
  });
});

describe("campaignBenefitLabel — desconto percentual", () => {
  it("mostra o percentual", () => {
    expect(campaignBenefitLabel({ benefit_type: "percent_off", discount_percent: 20 })).toBe(
      "20% de desconto",
    );
  });

  it("acrescenta o produto quando existe", () => {
    expect(
      campaignBenefitLabel({
        benefit_type: "percent_off",
        discount_percent: 20,
        product_name: "Gin tônica",
      }),
    ).toBe("20% de desconto em Gin tônica");
  });

  it("formata percentual fracionário no padrão pt-BR", () => {
    expect(campaignBenefitLabel({ benefit_type: "percent_off", discount_percent: 12.5 })).toBe(
      "12,5% de desconto",
    );
  });
});

describe("campaignBenefitLabel — desconto fixo", () => {
  it("converte centavos em reais", () => {
    const rotulo = campaignBenefitLabel({ benefit_type: "fixed_off", fixed_off_cents: 1500 });
    expect(normalizeSpaces(rotulo)).toBe("R$ 15,00 de desconto");
  });

  it("acrescenta o produto quando existe", () => {
    const rotulo = campaignBenefitLabel({
      benefit_type: "fixed_off",
      fixed_off_cents: 1000,
      product_name: "Chope",
    });
    expect(normalizeSpaces(rotulo)).toBe("R$ 10,00 de desconto em Chope");
  });
});

describe("campaignBenefitLabel — tipos sem valor", () => {
  it("rotula mimo grátis", () => {
    expect(campaignBenefitLabel({ benefit_type: "freebie" })).toBe("Mimo grátis");
    expect(campaignBenefitLabel({ benefit_type: "freebie", product_name: "Caipirinha" })).toBe(
      "Mimo grátis em Caipirinha",
    );
  });

  it("rotula compre um leve outro", () => {
    expect(campaignBenefitLabel({ benefit_type: "bogo" })).toBe("Compre um e leve outro");
    expect(campaignBenefitLabel({ benefit_type: "bogo", product_name: "Long neck" })).toBe(
      "Compre um e leve outro em Long neck",
    );
  });
});

describe("campaignBenefitLabel — fallback", () => {
  it("usa 'Mimo exclusivo' para tipo desconhecido sem produto", () => {
    expect(campaignBenefitLabel({ benefit_type: "combo_novo" })).toBe("Mimo exclusivo");
    expect(campaignBenefitLabel({ benefit_type: "" })).toBe("Mimo exclusivo");
  });

  it("usa 'Benefício em X' para tipo desconhecido com produto", () => {
    expect(campaignBenefitLabel({ benefit_type: "combo_novo", product_name: "Dose dupla" })).toBe(
      "Benefício em Dose dupla",
    );
  });

  it("ignora product_name vazio e cai no rótulo genérico", () => {
    expect(campaignBenefitLabel({ benefit_type: "freebie", product_name: "" })).toBe("Mimo grátis");
    expect(campaignBenefitLabel({ benefit_type: "combo_novo", product_name: null })).toBe(
      "Mimo exclusivo",
    );
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["zero", 0],
  ])(
    "COMPORTAMENTO ATUAL: percent_off com discount_percent %s cai no fallback",
    (_rotulo, discount_percent) => {
      // A checagem é de truthiness, então 0% e null tomam o mesmo caminho — a
      // campanha "0% de desconto" vira "Mimo exclusivo". Ver ACHADOS.
      expect(campaignBenefitLabel({ benefit_type: "percent_off", discount_percent })).toBe(
        "Mimo exclusivo",
      );
    },
  );

  it("COMPORTAMENTO ATUAL: fixed_off zerado com produto vira 'Benefício em X'", () => {
    expect(
      campaignBenefitLabel({
        benefit_type: "fixed_off",
        fixed_off_cents: 0,
        product_name: "Chope",
      }),
    ).toBe("Benefício em Chope");
  });
});

describe("rewardStatusLabel", () => {
  const FUTURO = "2030-01-01T00:00:00.000Z";
  const PASSADO = "2020-01-01T00:00:00.000Z";

  it.each([
    ["redeemed", "Utilizado"],
    ["revoked", "Cancelado"],
    ["expired", "Expirado"],
  ])("traduz o status '%s' para '%s'", (status, esperado) => {
    expect(rewardStatusLabel(status)).toBe(esperado);
  });

  it("mostra 'Disponível' para mimo ativo", () => {
    expect(rewardStatusLabel("active")).toBe("Disponível");
    expect(rewardStatusLabel("issued", FUTURO)).toBe("Disponível");
  });

  it("mostra 'Expirado' quando a validade já passou, mesmo com status ativo", () => {
    expect(rewardStatusLabel("issued", PASSADO)).toBe("Expirado");
  });

  it("não expira mimo com validade no futuro", () => {
    expect(rewardStatusLabel("issued", FUTURO)).toBe("Disponível");
  });

  it("mostra 'Disponível' quando não há validade definida", () => {
    expect(rewardStatusLabel("issued", null)).toBe("Disponível");
    expect(rewardStatusLabel("issued", undefined)).toBe("Disponível");
    expect(rewardStatusLabel("issued", "")).toBe("Disponível");
  });

  it("dá precedência a 'Utilizado' sobre a validade vencida", () => {
    // O membro usou o mimo antes de vencer — o histórico tem que dizer isso.
    expect(rewardStatusLabel("redeemed", PASSADO)).toBe("Utilizado");
    expect(rewardStatusLabel("revoked", PASSADO)).toBe("Cancelado");
  });

  it("compara a validade contra o relógio, não contra o status", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-08-15T00:00:00.000Z"));
    expect(rewardStatusLabel("issued", "2026-08-16T00:00:00.000Z")).toBe("Disponível");

    vi.setSystemTime(new Date("2026-08-17T00:00:00.000Z"));
    expect(rewardStatusLabel("issued", "2026-08-16T00:00:00.000Z")).toBe("Expirado");
  });

  it("COMPORTAMENTO ATUAL: validade inválida é tratada como não vencida", () => {
    // `new Date("qualquer").getTime()` é NaN, e `NaN < Date.now()` é false, então
    // o mimo continua "Disponível". Falha para o lado generoso. Ver ACHADOS.
    expect(rewardStatusLabel("issued", "qualquer coisa")).toBe("Disponível");
  });
});
