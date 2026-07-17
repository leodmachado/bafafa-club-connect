import { useCallback, useEffect, useId, useRef, useState } from "react";

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact" | "flexible";
          language?: string;
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export function getTurnstileSiteKey(): string | null {
  const key = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;
  return key?.trim() || null;
}

export function TurnstileChallenge({
  onToken,
  resetKey,
}: {
  onToken: (token: string | null) => void;
  resetKey: number;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `turnstile-${reactId}`;
  const widgetId = useRef<string | null>(null);
  const siteKey = getTurnstileSiteKey();

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(`#${elementId}`, {
        sitekey: siteKey,
        callback: (token) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
        theme: "light",
        size: "flexible",
        language: "pt-BR",
      });
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
    if (window.turnstile) render();
    else if (existing) existing.addEventListener("load", render, { once: true });
    else {
      const script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [elementId, onToken, siteKey]);

  useEffect(() => {
    if (!siteKey || !widgetId.current || !window.turnstile) return;
    window.turnstile.reset(widgetId.current);
    onToken(null);
  }, [onToken, resetKey, siteKey]);

  if (!siteKey) return null;

  return (
    <div className="rounded-2xl border-2 border-foreground/10 bg-white p-2">
      <div id={elementId} className="min-h-16" />
    </div>
  );
}

export function useAuthCaptcha() {
  const required = Boolean(getTurnstileSiteKey());
  const [token, setToken] = useState<string | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const reset = useCallback(() => {
    setToken(null);
    setResetKey((value) => value + 1);
  }, []);
  const onToken = useCallback((value: string | null) => setToken(value), []);
  return { required, token, resetKey, reset, onToken };
}
