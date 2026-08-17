import { describe, it, expect, afterEach, vi } from "vitest";
import { parseHouseSession } from "@/lib/house-session";

/**
 * `parseHouseSession` normaliza a linha da "Sessão da Casa" que vem por RPC.
 * Ela é a fonte de verdade para liberar check-in, chat e geolocalização, então
 * um campo que chega faltando não pode virar `undefined` solto na UI.
 */

const AGORA = new Date("2026-08-15T22:00:00.000Z");

function linhaCompleta() {
  return {
    id: "sess-1",
    name: "Bafafã de sexta",
    starts_at: "2026-08-15T22:00:00.000Z",
    ends_at: "2026-08-16T04:00:00.000Z",
    checkin_opens_at: "2026-08-15T21:00:00.000Z",
    checkin_closes_at: "2026-08-16T02:00:00.000Z",
    chat_opens_at: "2026-08-15T20:00:00.000Z",
    chat_closes_at: "2026-08-16T06:00:00.000Z",
    checkin_enabled: true,
    chat_enabled: true,
    geolocation_checkin_enabled: true,
    geofence_radius_m: 250,
    max_location_accuracy_m: 120,
    venue_address: "Rua da Resenha, 100",
    checked_in: true,
    checkin_open: true,
    chat_open: false,
    status: "ongoing",
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("parseHouseSession — rejeição de entrada inválida", () => {
  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string", "sess-1"],
    ["número", 42],
    ["booleano", false],
    ["array", [{ id: "sess-1" }]],
    ["array vazio", []],
  ])("devolve null para %s", (_rotulo, entrada) => {
    expect(parseHouseSession(entrada)).toBeNull();
  });

  it("devolve null quando não há id", () => {
    expect(parseHouseSession({ name: "Sem id" })).toBeNull();
  });

  it.each([
    ["número", 1],
    ["null", null],
    ["objeto", {}],
  ])("devolve null quando o id é %s em vez de string", (_rotulo, id) => {
    expect(parseHouseSession({ id })).toBeNull();
  });

  it("aceita id como string vazia", () => {
    // A guarda é de tipo, não de conteúdo. Registrado como aresta conhecida.
    expect(parseHouseSession({ id: "" })?.id).toBe("");
  });
});

describe("parseHouseSession — linha completa", () => {
  it("preserva todos os campos quando a RPC devolve tudo", () => {
    expect(parseHouseSession(linhaCompleta())).toEqual(linhaCompleta());
  });

  it("descarta campos desconhecidos vindos do banco", () => {
    const resultado = parseHouseSession({ ...linhaCompleta(), coluna_nova: "surpresa" });
    expect(resultado).not.toHaveProperty("coluna_nova");
  });
});

describe("parseHouseSession — valores padrão", () => {
  it("usa 'Sessão da Casa' quando o nome falta ou não é string", () => {
    expect(parseHouseSession({ id: "s" })?.name).toBe("Sessão da Casa");
    expect(parseHouseSession({ id: "s", name: 42 })?.name).toBe("Sessão da Casa");
    expect(parseHouseSession({ id: "s", name: null })?.name).toBe("Sessão da Casa");
  });

  it("usa o instante atual nas datas ausentes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);

    const sessao = parseHouseSession({ id: "s" });

    expect(sessao?.starts_at).toBe(AGORA.toISOString());
    expect(sessao?.checkin_opens_at).toBe(AGORA.toISOString());
    expect(sessao?.checkin_closes_at).toBe(AGORA.toISOString());
    expect(sessao?.chat_opens_at).toBe(AGORA.toISOString());
    expect(sessao?.chat_closes_at).toBe(AGORA.toISOString());
  });

  it("usa null em ends_at ausente, e não a data atual", () => {
    // `ends_at` null significa "sem fim definido" — o cálculo de status depende
    // dessa distinção (ver test/unit/event-status.test.ts).
    expect(parseHouseSession({ id: "s" })?.ends_at).toBeNull();
    expect(parseHouseSession({ id: "s", ends_at: 12345 })?.ends_at).toBeNull();
  });

  it.each([
    "checkin_enabled",
    "chat_enabled",
    "geolocation_checkin_enabled",
    "checked_in",
    "checkin_open",
    "chat_open",
  ])("assume false para a flag ausente %s (fail-safe)", (flag) => {
    const sessao = parseHouseSession({ id: "s" }) as unknown as Record<string, unknown>;
    expect(sessao[flag]).toBe(false);
  });

  it("converte flags 'truthy' vindas do banco em booleano", () => {
    const sessao = parseHouseSession({ id: "s", checkin_enabled: 1, chat_enabled: "sim" });
    expect(sessao?.checkin_enabled).toBe(true);
    expect(sessao?.chat_enabled).toBe(true);
  });

  it("usa raio de geofence de 180 m e precisão de 250 m por padrão", () => {
    const sessao = parseHouseSession({ id: "s" });
    expect(sessao?.geofence_radius_m).toBe(180);
    expect(sessao?.max_location_accuracy_m).toBe(250);
  });

  it("respeita raio zero em vez de trocá-lo pelo padrão", () => {
    // `?? 180` só substitui null/undefined, então 0 sobrevive — o que importa
    // se a casa quiser desligar a checagem de distância.
    expect(parseHouseSession({ id: "s", geofence_radius_m: 0 })?.geofence_radius_m).toBe(0);
  });

  it("converte raio numérico em string", () => {
    expect(parseHouseSession({ id: "s", geofence_radius_m: "300" })?.geofence_radius_m).toBe(300);
  });

  it("COMPORTAMENTO ATUAL: raio não numérico vira NaN em vez do padrão", () => {
    // `Number("perto")` é NaN, e toda comparação de distância com NaN é falsa —
    // ou seja, o check-in por geolocalização passaria a recusar todo mundo.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(parseHouseSession({ id: "s", geofence_radius_m: "perto" })?.geofence_radius_m).toBeNaN();
  });

  it("usa 'scheduled' como status padrão", () => {
    expect(parseHouseSession({ id: "s" })?.status).toBe("scheduled");
    expect(parseHouseSession({ id: "s", status: 3 })?.status).toBe("scheduled");
  });
});

describe("parseHouseSession — venue_address", () => {
  it("mantém o endereço quando há conteúdo", () => {
    expect(parseHouseSession({ id: "s", venue_address: "Rua X, 10" })?.venue_address).toBe(
      "Rua X, 10",
    );
  });

  it.each([
    ["string vazia", ""],
    ["só espaços", "   "],
    ["ausente", undefined],
    ["null", null],
    ["número", 10],
  ])("devolve null para endereço %s", (_rotulo, venue_address) => {
    expect(parseHouseSession({ id: "s", venue_address })?.venue_address).toBeNull();
  });

  it("não apara os espaços das pontas do endereço válido", () => {
    // A checagem usa `.trim()`, mas o valor guardado é o original.
    expect(parseHouseSession({ id: "s", venue_address: "  Rua X  " })?.venue_address).toBe(
      "  Rua X  ",
    );
  });
});
