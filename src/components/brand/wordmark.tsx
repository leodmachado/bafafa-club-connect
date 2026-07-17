import { cn } from "@/lib/utils";

interface WordmarkProps {
  className?: string;
  variant?: "full" | "short";
  tone?: "primary" | "white" | "foreground";
}

/** Logo oficial enviada pelo Bafafá. Mantém proporção e cores originais. */
export function Wordmark({ className, variant = "full", tone = "primary" }: WordmarkProps) {
  return (
    <div className={cn("inline-flex min-w-0 flex-col items-start", className)}>
      <span
        className={cn(
          "inline-flex rounded-xl p-1.5",
          tone === "white" ? "bg-white" : tone === "foreground" ? "bg-background" : "bg-white",
        )}
      >
        <img
          src="/brand/logo-bafafa.png"
          alt="Bafafá Bar"
          className={cn("h-auto w-36 object-contain", variant === "short" && "w-24")}
        />
      </span>
      {variant === "full" && (
        <span className="mt-1.5 font-poster text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          Clube dos Bafafãs · Natal/RN
        </span>
      )}
    </div>
  );
}
