export type GeolocationProgress = {
  accuracyM: number;
  elapsedMs: number;
};

type BestPositionOptions = {
  targetAccuracyM?: number;
  timeoutMs?: number;
  onProgress?: (progress: GeolocationProgress) => void;
};

/**
 * Aguarda mais de uma leitura do navegador e retorna a melhor posição encontrada.
 * Em celulares, a primeira leitura costuma vir da rede/Wi-Fi e melhora depois que o
 * GPS consegue fixar o sinal.
 */
export function getBestGeolocationPosition({
  targetAccuracyM = 80,
  timeoutMs = 20_000,
  onProgress,
}: BestPositionOptions = {}): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("GEOLOCATION_UNAVAILABLE"));
      return;
    }

    const startedAt = Date.now();
    let bestPosition: GeolocationPosition | null = null;
    let lastError: GeolocationPositionError | null = null;
    let watchId: number | null = null;
    let timer: number | null = null;
    let finished = false;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer !== null) window.clearTimeout(timer);
    };

    const finish = (position?: GeolocationPosition, error?: Error) => {
      if (finished) return;
      finished = true;
      cleanup();
      if (position) resolve(position);
      else reject(error ?? new Error("GEOLOCATION_FAILED"));
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const accuracyM = position.coords.accuracy;
        if (!Number.isFinite(accuracyM) || accuracyM <= 0) return;

        if (!bestPosition || accuracyM < bestPosition.coords.accuracy) {
          bestPosition = position;
        }

        onProgress?.({ accuracyM, elapsedMs: Date.now() - startedAt });

        if (accuracyM <= Math.max(20, targetAccuracyM)) {
          finish(position);
        }
      },
      (geoError) => {
        lastError = geoError;
        if (geoError.code === geoError.PERMISSION_DENIED) {
          finish(undefined, new Error("GEOLOCATION_PERMISSION_DENIED"));
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    );

    timer = window.setTimeout(() => {
      if (bestPosition) {
        finish(bestPosition);
        return;
      }

      const code =
        lastError?.code === lastError?.TIMEOUT
          ? "GEOLOCATION_TIMEOUT"
          : lastError?.code === lastError?.POSITION_UNAVAILABLE
            ? "GEOLOCATION_POSITION_UNAVAILABLE"
            : "GEOLOCATION_FAILED";
      finish(undefined, new Error(code));
    }, timeoutMs);
  });
}

export function geolocationErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  switch (code) {
    case "GEOLOCATION_PERMISSION_DENIED":
      return "Permita a localização precisa no navegador para usar o check-in rápido.";
    case "GEOLOCATION_TIMEOUT":
      return "A localização demorou demais. Vá para uma área mais aberta e tente novamente.";
    case "GEOLOCATION_POSITION_UNAVAILABLE":
      return "O aparelho não conseguiu calcular sua posição. Ative a localização precisa e tente novamente.";
    case "GEOLOCATION_UNAVAILABLE":
      return "Este aparelho ou navegador não oferece localização.";
    default:
      return "Não conseguimos obter sua localização. Você também pode usar o QR alternativo.";
  }
}
