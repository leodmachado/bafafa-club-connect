import { publicErrorMessage } from "@/lib/public-error";
import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingCard({ label = "Carregando o Bafafá…" }: { label?: string }) {
  return (
    <div className="card-festa mx-5 flex items-center gap-3 p-5 text-sm text-muted-foreground">
      <LoaderCircle className="h-5 w-5 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorCard({ message }: { message: string }) {
  return (
    <div className="card-festa mx-5 flex items-start gap-3 border border-destructive/20 bg-destructive/5 p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
      <div>
        <p className="font-display text-base">Deu ruim nessa parte.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {publicErrorMessage(message, "Não foi possível carregar essa parte. Tente novamente.")}
        </p>
      </div>
    </div>
  );
}
