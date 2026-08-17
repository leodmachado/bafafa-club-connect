import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Megaphone, RefreshCw, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";

export const Route = createFileRoute("/fofocometro/$eventId")({ component: FofocometroScreen });

type Goal = {
  id: string;
  event_id: string;
  event_name?: string;
  name: string;
  target_count: number;
  current_count: number;
  remaining_count?: number;
  status: string;
  reward_description: string | null;
  completed_at: string | null;
};

function FofocometroScreen() {
  const { eventId } = Route.useParams();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: loadError } = await supabase.rpc("event_fofocometro", {
      _event_id: eventId,
    });
    // Esta tela é pública e fica projetada na casa. Nunca exibir a mensagem
    // técnica crua do Postgres/PostgREST no telão.
    if (loadError)
      setError(publicErrorMessage(loadError, "Não foi possível atualizar o Fofocômetro agora."));
    else {
      setGoals(readGoals(data));
      setError(null);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const active =
    goals.find((goal) => goal.status === "active") ??
    goals.find((goal) => goal.status === "scheduled") ??
    goals.at(-1) ??
    null;
  const percent = active
    ? Math.min(100, Math.round((active.current_count / Math.max(active.target_count, 1)) * 100))
    : 0;
  const completed = active?.status === "completed" || percent >= 100;

  return (
    <main className="min-h-screen overflow-hidden bg-foreground p-[3vw] text-background">
      <div className="mx-auto flex min-h-[88vh] max-w-[1600px] flex-col justify-between rounded-[3rem] border-[8px] border-background bg-samba p-[4vw] shadow-[18px_20px_0_#ffca28]">
        <header className="flex items-start justify-between gap-8">
          <div>
            <p className="font-black uppercase tracking-[0.2em] text-white/70">Bafafá ao vivo</p>
            <h1 className="mt-3 font-display text-[clamp(3rem,8vw,9rem)] leading-[0.82]">
              FOFOCÔMETRO
            </h1>
            <p className="mt-4 font-poster text-[clamp(1.6rem,3vw,3.5rem)]">GELA A GENTE</p>
          </div>
          <Snowflake className="h-[clamp(5rem,10vw,12rem)] w-[clamp(5rem,10vw,12rem)]" />
        </header>

        {loading ? (
          <div className="grid flex-1 place-items-center">
            <Loader2 className="h-20 w-20 animate-spin" />
          </div>
        ) : error ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <Megaphone className="mx-auto h-20 w-20" />
              <h2 className="mt-5 font-display text-6xl">A fofoca deu uma pausa</h2>
              <p className="mt-4 text-2xl">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-mango px-8 py-4 text-xl font-black text-foreground"
              >
                <RefreshCw className="h-6 w-6" /> Atualizar
              </button>
            </div>
          </div>
        ) : !active ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <Megaphone className="mx-auto h-20 w-20" />
              <h2 className="mt-5 font-display text-[clamp(3rem,7vw,7rem)]">
                O próximo babado já vem
              </h2>
              <p className="mt-4 text-[clamp(1.3rem,2.5vw,2.5rem)]">
                A meta coletiva ainda não foi ativada para este evento.
              </p>
            </div>
          </div>
        ) : completed ? (
          <section className="my-10 grid flex-1 place-items-center rounded-[3rem] border-[8px] border-foreground bg-mango p-10 text-center text-foreground shadow-[14px_16px_0_white]">
            <div>
              <CheckCircle2 className="mx-auto h-[clamp(6rem,12vw,14rem)] w-[clamp(6rem,12vw,14rem)]" />
              <p className="mt-6 font-black uppercase tracking-[0.18em]">Meta alcançada</p>
              <h2 className="mt-3 font-display text-[clamp(4rem,9vw,10rem)] leading-[0.85]">
                DESBLOQUEOU UM BABADO FORTE
              </h2>
              {active.reward_description && (
                <p className="mt-8 font-poster text-[clamp(1.6rem,3vw,3.5rem)]">
                  {active.reward_description}
                </p>
              )}
            </div>
          </section>
        ) : (
          <section className="my-10">
            <div className="flex items-end justify-between gap-6">
              <div>
                <p className="font-black uppercase tracking-[0.16em] text-white/70">
                  {active.name}
                </p>
                <p className="mt-2 font-display text-[clamp(5rem,14vw,15rem)] leading-none">
                  {active.current_count}
                  <span className="text-[0.35em] text-white/65"> de {active.target_count}</span>
                </p>
              </div>
              <p className="pb-4 text-right font-poster text-[clamp(1.4rem,2.6vw,3rem)]">
                FALTAM {Math.max(active.target_count - active.current_count, 0)}
                <br />
                PRA LIBERAR O BABADO
              </p>
            </div>
            <div className="mt-8 h-[clamp(3rem,6vw,6rem)] overflow-hidden rounded-full border-[6px] border-background bg-foreground/30">
              <div
                className="h-full bg-mango transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </section>
        )}

        <footer className="flex items-center justify-between gap-4 border-t border-white/25 pt-6 text-[clamp(1rem,1.6vw,1.8rem)] font-black">
          <span>Conta só Fofoquinha validada no consumo.</span>
          <span>{percent}%</span>
        </footer>
      </div>
    </main>
  );
}

function readGoals(value: unknown): Goal[] {
  if (Array.isArray(value)) return value.filter(isGoal);
  if (isRecord(value) && Array.isArray(value.goals)) return value.goals.filter(isGoal);
  return isGoal(value) ? [value] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isGoal(value: unknown): value is Goal {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.event_id === "string" &&
    typeof value.name === "string" &&
    typeof value.target_count === "number" &&
    typeof value.current_count === "number" &&
    typeof value.status === "string"
  );
}
