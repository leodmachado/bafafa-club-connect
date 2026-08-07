import { cn } from "@/lib/utils";

interface BafafaSignProps {
  className?: string;
  size?: "compact" | "hero" | "full";
  showCaption?: boolean;
}

/** Placa oficial reutilizável: mantém a logo dentro da moldura visual do Bafafá. */
export function BafafaSign({ className, size = "hero", showCaption = false }: BafafaSignProps) {
  return (
    <span className={cn("inline-flex min-w-0 flex-col items-start", className)}>
      <span
        className={cn(
          "bafafa-sign",
          size === "compact" && "bafafa-sign--compact",
          size === "full" && "bafafa-sign--full",
        )}
      >
        <span className="bafafa-sign__nail bafafa-sign__nail--left" aria-hidden="true" />
        <span className="bafafa-sign__nail bafafa-sign__nail--right" aria-hidden="true" />
        <img
          src="/brand/logo-bafafa.png"
          alt="Bafafá Bar"
          className="relative z-[1] h-auto w-full object-contain"
        />
      </span>
      {showCaption && (
        <span className="mt-2 font-poster text-[0.65rem] uppercase tracking-[0.16em] text-muted-foreground">
          Clube dos Bafafãs · Natal/RN
        </span>
      )}
    </span>
  );
}
