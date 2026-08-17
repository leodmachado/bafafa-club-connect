import { describe, it, expect, afterEach, vi } from "vitest";
import { geolocationErrorMessage, getBestGeolocationPosition } from "@/lib/geolocation";

/**
 * `getBestGeolocationPosition` é o coração do check-in por GPS: ele fica ouvindo
 * o `watchPosition` até a precisão ficar boa o suficiente ou o tempo acabar.
 *
 * É um módulo difícil de testar porque combina três fontes de assincronia —
 * callbacks do navegador, um `setTimeout` e a Promise devolvida. A estratégia
 * aqui é substituir `navigator.geolocation` por um dublê no qual o teste
 * dispara as leituras na mão, e usar timers falsos para controlar o relógio.
 * Nada depende do GPS nem do tempo de parede.
 */

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/** Leitura de posição com a precisão desejada; o resto das coordenadas é fixo. */
function makePosition(accuracyM: number): GeolocationPosition {
  return {
    coords: {
      accuracy: accuracyM,
      latitude: -23.5505,
      longitude: -46.6333,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as unknown as GeolocationPosition;
}

/** Erro do navegador com as constantes de código que o código de produção lê. */
function makeGeoError(code: number): GeolocationPositionError {
  return {
    code,
    message: "erro simulado",
    PERMISSION_DENIED,
    POSITION_UNAVAILABLE,
    TIMEOUT,
  } as unknown as GeolocationPositionError;
}

type Watch = {
  success: PositionCallback;
  error: PositionErrorCallback | null;
  options?: PositionOptions;
};

/**
 * Instala um `navigator.geolocation` de mentira e devolve os controles para
 * empurrar leituras e erros. Os watches limpos pelo código de produção somem do
 * mapa, então uma leitura emitida depois do fim simplesmente não chega a
 * ninguém — o mesmo que acontece no navegador de verdade.
 */
function installGeolocation() {
  const watches = new Map<number, Watch>();
  let nextId = 1;

  const clearWatch = vi.fn((id: number) => {
    watches.delete(id);
  });

  const watchPosition = vi.fn(
    (
      success: PositionCallback,
      error?: PositionErrorCallback | null,
      options?: PositionOptions,
    ) => {
      const id = nextId++;
      watches.set(id, { success, error: error ?? null, options });
      return id;
    },
  );

  Object.defineProperty(globalThis.navigator, "geolocation", {
    value: { watchPosition, clearWatch, getCurrentPosition: vi.fn() },
    configurable: true,
  });

  return {
    watchPosition,
    clearWatch,
    /** Quantos watches continuam ativos (0 = o código limpou tudo). */
    activeWatches: () => watches.size,
    /** Opções passadas ao `watchPosition` na primeira chamada. */
    options: () => [...watches.values()][0]?.options,
    emitPosition(accuracyM: number) {
      for (const watch of [...watches.values()]) watch.success(makePosition(accuracyM));
    },
    emitError(code: number) {
      for (const watch of [...watches.values()]) watch.error?.(makeGeoError(code));
    },
  };
}

/** Remove a geolocalização do navegador, como num navegador que não a oferece. */
function removeGeolocation() {
  Object.defineProperty(globalThis.navigator, "geolocation", {
    value: undefined,
    configurable: true,
  });
}

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis.navigator, "geolocation");
});

describe("getBestGeolocationPosition — navegador sem suporte", () => {
  it("rejeita com GEOLOCATION_UNAVAILABLE quando não há navigator.geolocation", async () => {
    removeGeolocation();

    await expect(getBestGeolocationPosition()).rejects.toThrow("GEOLOCATION_UNAVAILABLE");
  });

  it("nem chega a agendar o timeout quando não há suporte", async () => {
    vi.useFakeTimers();
    removeGeolocation();

    await expect(getBestGeolocationPosition({ timeoutMs: 1000 })).rejects.toThrow(
      "GEOLOCATION_UNAVAILABLE",
    );
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("getBestGeolocationPosition — leitura boa o suficiente", () => {
  it("resolve assim que a precisão atinge o alvo, sem esperar o timeout", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(45);

    const posicao = await promessa;

    expect(posicao.coords.accuracy).toBe(45);
    expect(geo.activeWatches()).toBe(0);
    expect(geo.clearWatch).toHaveBeenCalled();
  });

  it("cancela o timeout ao resolver cedo", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(45);
    await promessa;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("aceita a leitura exatamente no valor do alvo (limite inclusivo)", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(80);

    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 80 } });
  });

  it("não resolve cedo com leitura pior que o alvo", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(81);

    // Ainda há watch ativo e timer pendente: o código continua esperando.
    expect(geo.activeWatches()).toBe(1);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(20_000);
    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 81 } });
  });

  it("nunca exige precisão melhor que 20 m, mesmo com alvo menor", async () => {
    // `Math.max(20, targetAccuracyM)` estabelece um piso: pedir 5 m não trava a
    // espera até o GPS chegar a 5 m — 20 m já encerra.
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 5, timeoutMs: 20_000 });
    geo.emitPosition(20);

    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 20 } });
  });

  it("com alvo abaixo do piso, uma leitura de 21 m ainda não encerra", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 5, timeoutMs: 20_000 });
    geo.emitPosition(21);

    expect(geo.activeWatches()).toBe(1);

    vi.advanceTimersByTime(20_000);
    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 21 } });
  });
});

describe("getBestGeolocationPosition — melhor leitura acumulada", () => {
  it("troca a leitura guardada quando chega outra mais precisa", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(400);
    geo.emitPosition(150);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 150 } });
  });

  it("mantém a melhor leitura quando a seguinte piora", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(120);
    geo.emitPosition(500);
    geo.emitPosition(900);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 120 } });
  });

  it.each([
    ["zero", 0],
    ["negativa", -5],
    ["NaN", Number.NaN],
    ["infinita", Number.POSITIVE_INFINITY],
  ])("descarta leitura com precisão %s", async (_rotulo, accuracy) => {
    vi.useFakeTimers();
    const geo = installGeolocation();
    const onProgress = vi.fn();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000, onProgress });
    geo.emitPosition(accuracy);
    vi.advanceTimersByTime(20_000);

    // Nenhuma leitura válida foi guardada, então o timeout rejeita.
    await expect(promessa).rejects.toThrow(/GEOLOCATION_/);
    expect(onProgress).not.toHaveBeenCalled();
  });

  it("ignora leitura inválida mas continua aproveitando as válidas", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitPosition(0);
    geo.emitPosition(200);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 200 } });
  });
});

describe("getBestGeolocationPosition — erros do navegador", () => {
  it("rejeita na hora em PERMISSION_DENIED, sem esperar o timeout", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000 });
    geo.emitError(PERMISSION_DENIED);

    await expect(promessa).rejects.toThrow("GEOLOCATION_PERMISSION_DENIED");
    expect(vi.getTimerCount()).toBe(0);
    expect(geo.clearWatch).toHaveBeenCalled();
  });

  it("descarta leitura boa que chegue depois da permissão negada", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitError(PERMISSION_DENIED);
    geo.emitPosition(10);

    await expect(promessa).rejects.toThrow("GEOLOCATION_PERMISSION_DENIED");
  });

  it("não desiste em POSITION_UNAVAILABLE — segue esperando o GPS fixar", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, timeoutMs: 20_000 });
    geo.emitError(POSITION_UNAVAILABLE);

    expect(geo.activeWatches()).toBe(1);

    geo.emitPosition(30);
    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 30 } });
  });

  it("traduz TIMEOUT do navegador quando o tempo acaba sem nenhuma leitura", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000 });
    geo.emitError(TIMEOUT);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).rejects.toThrow("GEOLOCATION_TIMEOUT");
  });

  it("traduz POSITION_UNAVAILABLE quando o tempo acaba sem nenhuma leitura", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000 });
    geo.emitError(POSITION_UNAVAILABLE);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).rejects.toThrow("GEOLOCATION_POSITION_UNAVAILABLE");
  });

  it("usa o último erro recebido para escolher a mensagem", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000 });
    geo.emitError(TIMEOUT);
    geo.emitError(POSITION_UNAVAILABLE);
    vi.advanceTimersByTime(20_000);

    await expect(promessa).rejects.toThrow("GEOLOCATION_POSITION_UNAVAILABLE");
  });

  it("COMPORTAMENTO ATUAL: silêncio total do GPS também vira GEOLOCATION_TIMEOUT", async () => {
    // Sem nenhum callback do navegador, `lastError` continua null. O código faz
    // `lastError?.code === lastError?.TIMEOUT`, ou seja `undefined === undefined`,
    // que é verdadeiro — então nunca chega ao ramo "GEOLOCATION_FAILED".
    // O texto mostrado ao membro acaba certo por acaso. Ver ACHADOS.
    vi.useFakeTimers();
    installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 20_000 });
    vi.advanceTimersByTime(20_000);

    await expect(promessa).rejects.toThrow("GEOLOCATION_TIMEOUT");
  });
});

describe("getBestGeolocationPosition — tempo e progresso", () => {
  it("respeita o timeoutMs configurado", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 5_000 });
    geo.emitPosition(300);

    vi.advanceTimersByTime(4_999);
    expect(geo.activeWatches()).toBe(1);

    vi.advanceTimersByTime(1);
    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 300 } });
  });

  it("repassa timeout e alta precisão para o watchPosition do navegador", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition({ timeoutMs: 9_000 });

    expect(geo.options()).toMatchObject({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 9_000,
    });

    geo.emitPosition(10);
    await promessa;
  });

  it("informa a precisão e o tempo decorrido em cada leitura válida", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-15T22:00:00.000Z"));
    const geo = installGeolocation();
    const onProgress = vi.fn();

    const promessa = getBestGeolocationPosition({
      targetAccuracyM: 80,
      timeoutMs: 20_000,
      onProgress,
    });

    geo.emitPosition(400);
    vi.advanceTimersByTime(3_000);
    geo.emitPosition(200);
    vi.advanceTimersByTime(17_000);
    await promessa;

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, { accuracyM: 400, elapsedMs: 0 });
    expect(onProgress).toHaveBeenNthCalledWith(2, { accuracyM: 200, elapsedMs: 3_000 });
  });

  it("informa o progresso da leitura que encerra a espera", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();
    const onProgress = vi.fn();

    const promessa = getBestGeolocationPosition({ targetAccuracyM: 80, onProgress });
    geo.emitPosition(30);
    await promessa;

    expect(onProgress).toHaveBeenCalledWith({ accuracyM: 30, elapsedMs: 0 });
  });

  it("usa 20 s como timeout padrão", async () => {
    vi.useFakeTimers();
    const geo = installGeolocation();

    const promessa = getBestGeolocationPosition();
    geo.emitPosition(300);

    vi.advanceTimersByTime(19_999);
    expect(geo.activeWatches()).toBe(1);

    vi.advanceTimersByTime(1);
    await expect(promessa).resolves.toMatchObject({ coords: { accuracy: 300 } });
  });
});

describe("geolocationErrorMessage", () => {
  it.each([
    ["GEOLOCATION_PERMISSION_DENIED", "Permita a localização precisa"],
    ["GEOLOCATION_TIMEOUT", "demorou demais"],
    ["GEOLOCATION_POSITION_UNAVAILABLE", "não conseguiu calcular sua posição"],
    ["GEOLOCATION_UNAVAILABLE", "não oferece localização"],
  ])("explica o código %s", (codigo, trecho) => {
    expect(geolocationErrorMessage(new Error(codigo))).toContain(trecho);
  });

  it("devolve mensagens diferentes para cada código conhecido", () => {
    const codigos = [
      "GEOLOCATION_PERMISSION_DENIED",
      "GEOLOCATION_TIMEOUT",
      "GEOLOCATION_POSITION_UNAVAILABLE",
      "GEOLOCATION_UNAVAILABLE",
      "GEOLOCATION_FAILED",
    ];
    const mensagens = new Set(codigos.map((codigo) => geolocationErrorMessage(new Error(codigo))));

    expect(mensagens.size).toBe(codigos.length);
  });

  it("sugere o QR alternativo no caso genérico", () => {
    expect(geolocationErrorMessage(new Error("GEOLOCATION_FAILED"))).toContain("QR alternativo");
    expect(geolocationErrorMessage(new Error("qualquer outra coisa"))).toContain("QR alternativo");
  });

  it.each([
    ["string", "GEOLOCATION_TIMEOUT"],
    ["null", null],
    ["undefined", undefined],
    ["objeto solto", { code: 1 }],
    ["número", 3],
  ])("cai no caso genérico quando o erro é %s e não uma Error", (_rotulo, erro) => {
    // Só `instanceof Error` é inspecionado — inclusive uma string com o código
    // certo não é reconhecida.
    expect(geolocationErrorMessage(erro)).toContain("QR alternativo");
  });

  it("liga a rejeição real de getBestGeolocationPosition à mensagem certa", async () => {
    removeGeolocation();

    const erro = await getBestGeolocationPosition().catch((causa: unknown) => causa);

    expect(geolocationErrorMessage(erro)).toContain("não oferece localização");
  });
});
