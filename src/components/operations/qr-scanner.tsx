import { publicErrorMessage } from "@/lib/public-error";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";
import { Camera, CameraOff, Loader2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type QrScannerProps = {
  active: boolean;
  busy?: boolean;
  onScan: (value: string) => void | Promise<void>;
  onError?: (message: string) => void;
};

export function QrScanner({ active, busy = false, onScan, onError }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastValueRef = useRef<string>("");
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stop = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
  }, []);

  const start = useCallback(async () => {
    if (!active || busy || !videoRef.current) return;
    const videoElement = videoRef.current;
    if (!navigator.mediaDevices?.getUserMedia) {
      const message = "A câmera não está disponível neste navegador. Use o código manual.";
      setCameraError(message);
      onError?.(message);
      return;
    }

    stop();
    setStarting(true);
    setCameraError(null);
    lastValueRef.current = "";
    try {
      const reader = new BrowserQRCodeReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 1200,
      });
      controlsRef.current = await reader.decodeFromConstraints(
        {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoElement,
        (result) => {
          if (!result || busy) return;
          const text = result.getText().trim();
          if (!text || text === lastValueRef.current) return;
          lastValueRef.current = text;
          stop();
          void onScan(text);
        },
      );
    } catch (error) {
      const browserMessage =
        error instanceof DOMException && error.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere a câmera nas configurações do navegador ou use o código manual."
          : error instanceof DOMException && error.name === "NotFoundError"
            ? "Nenhuma câmera foi encontrada neste aparelho. Use o código manual."
            : "Não foi possível abrir a câmera. Confira a permissão do navegador.";
      const message = publicErrorMessage(error, browserMessage);
      setCameraError(message);
      onError?.(message);
    } finally {
      setStarting(false);
    }
  }, [active, busy, onError, onScan, stop]);

  useEffect(() => {
    if (active && !busy) void start();
    else stop();
    return stop;
  }, [active, busy, start, stop]);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border-[3px] border-foreground bg-foreground shadow-[5px_6px_0_var(--mango)] sm:aspect-[4/3]">
        <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-gradient-to-b from-black/20 via-transparent to-black/35">
          <div className="relative h-52 w-52 rounded-[30px] border-[3px] border-mango shadow-[0_0_0_999px_rgba(0,0,0,.18)]">
            <span className="absolute left-4 right-4 top-1/2 h-0.5 animate-pulse bg-mango shadow-[0_0_12px_var(--mango)]" />
          </div>
        </div>
        <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-background/95 px-3 py-2 text-xs font-black text-foreground">
          <ScanLine className="h-4 w-4 text-primary" /> Enquadre o QR
        </div>
        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-foreground/75 text-white">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin" />
              <p className="mt-2 text-sm font-bold">Abrindo a câmera…</p>
            </div>
          </div>
        )}
      </div>
      {cameraError ? (
        <div className="rounded-2xl border-2 border-destructive/25 bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-black text-destructive">
            <CameraOff className="h-4 w-4" /> Câmera indisponível
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{cameraError}</p>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <Camera className="h-4 w-4" /> A leitura acontece automaticamente.
        </p>
      )}
      {!starting && cameraError && (
        <button
          type="button"
          onClick={() => void start()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-mango px-4 py-3 text-sm font-black shadow-[3px_4px_0_var(--foreground)]"
        >
          <Camera className="h-4 w-4" /> Tentar abrir novamente
        </button>
      )}
    </div>
  );
}
