import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";

type SecureQrProps = {
  value: string;
  shortCode: string;
  expiresAt: string;
  size?: number;
  label?: string;
  dark?: boolean;
};

function secondsUntil(expiresAt: string) {
  const timestamp = new Date(expiresAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return Math.max(0, Math.ceil((timestamp - Date.now()) / 1000));
}

export function SecureQr({
  value,
  shortCode,
  expiresAt,
  size = 176,
  label = "Aponte a câmera da equipe",
  dark = false,
}: SecureQrProps) {
  const [secondsLeft, setSecondsLeft] = useState(() => secondsUntil(expiresAt));
  const groups = useMemo(() => shortCode.match(/.{1,3}/g)?.join(" ") ?? shortCode, [shortCode]);
  const qrSize = Math.min(220, Math.max(150, size));

  useEffect(() => {
    setSecondsLeft(secondsUntil(expiresAt));
    const interval = window.setInterval(() => {
      setSecondsLeft(secondsUntil(expiresAt));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [expiresAt]);

  return (
    <div
      className={`mx-auto w-full max-w-[290px] rounded-[28px] border-[3px] p-4 text-center shadow-[5px_6px_0_var(--foreground)] ${
        dark
          ? "border-mango bg-background text-foreground"
          : "border-foreground bg-white text-foreground"
      }`}
    >
      <div className="mx-auto grid w-fit place-items-center rounded-2xl bg-white p-3">
        <QRCodeSVG
          value={value}
          size={qrSize}
          level="M"
          marginSize={1}
          bgColor="#ffffff"
          fgColor="#171126"
          title="QR Code temporário do Bafafá"
        />
      </div>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-[0.08em]">
        <ShieldCheck className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-black tracking-[0.15em]">{groups}</p>
      <p
        className={`mt-1 text-xs font-semibold ${secondsLeft === 0 ? "text-destructive" : "opacity-65"}`}
      >
        {secondsLeft > 0
          ? `Código temporário · expira em ${secondsLeft}s`
          : "Código expirado · gere outro"}
      </p>
    </div>
  );
}
