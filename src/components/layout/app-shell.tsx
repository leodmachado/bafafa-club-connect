import type { ReactNode } from "react";
import { MapPin, Sparkles } from "lucide-react";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-canvas min-h-screen sm:py-5">
      <div className="mx-auto flex min-h-screen max-w-lg flex-col overflow-hidden bg-background sm:min-h-[calc(100vh-2.5rem)] sm:rounded-[2rem] sm:border-2 sm:border-foreground/15 sm:shadow-soft">
        <main className="flex-1 pb-28">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}

export function ScreenHeader({
  title,
  eyebrow,
  action,
  tone = "plain",
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  action?: ReactNode;
  tone?: "plain" | "brick" | "blue" | "green";
}) {
  const toneClass =
    tone === "brick"
      ? "brick-texture text-white"
      : tone === "blue"
        ? "grid-texture bg-electric text-white"
        : tone === "green"
          ? "grid-texture bg-primary text-primary-foreground"
          : "";

  return (
    <header className={`relative mb-2 overflow-hidden px-5 pb-5 pt-7 ${toneClass}`}>
      {tone !== "plain" && (
        <>
          <Sparkles className="absolute right-5 top-5 h-5 w-5 opacity-70" />
          <div className="plaza-line absolute inset-x-0 bottom-0" />
        </>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p
              className={`section-kicker ${tone === "plain" ? "text-muted-foreground" : "opacity-80"}`}
            >
              {eyebrow}
            </p>
          )}
          <h1 className="mt-1 truncate font-display text-4xl leading-none">{title}</h1>
          {tone !== "plain" && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-bold opacity-75">
              <MapPin className="h-3.5 w-3.5" /> Praça Dr. Amaro de Souza · Lagoa Nova
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
