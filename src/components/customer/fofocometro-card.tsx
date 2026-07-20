import { Link } from "@tanstack/react-router";
import { CheckCircle2, Megaphone, Snowflake, Sparkles } from "lucide-react";
import { fofocometroPercent, type FofocometroGoal } from "@/lib/fofocometro";

type Props = {
  goal: FofocometroGoal;
  compact?: boolean;
  showAction?: boolean;
};

export function FofocometroCard({ goal, compact = false, showAction = true }: Props) {
  const percent = fofocometroPercent(goal);
  const completed = goal.status === "completed" || percent >= 100;
  const remaining = Math.max(goal.target_count - goal.current_count, 0);

  return (
    <article
      className={`${compact ? "rounded-2xl" : "poster-card"} overflow-hidden border-2 border-foreground bg-samba text-white shadow-[4px_5px_0_var(--foreground)]`}
    >
      <div className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="section-kicker text-white/70">Fofocômetro Gela a Gente</p>
            <h3 className={`${compact ? "text-2xl" : "text-4xl"} mt-1 font-display leading-none`}>
              {completed ? "Babado desbloqueado" : goal.name}
            </h3>
          </div>
          {completed ? (
            <CheckCircle2 className="h-8 w-8 shrink-0 text-mango" />
          ) : (
            <Snowflake className="h-8 w-8 shrink-0 text-mango" />
          )}
        </div>

        {completed ? (
          <div className="mt-4 rounded-2xl border-2 border-foreground bg-mango p-4 text-foreground">
            <p className="font-display text-3xl leading-none">DESBLOQUEOU UM BABADO FORTE</p>
            {goal.reward_description && (
              <p className="mt-2 text-sm font-black">{goal.reward_description}</p>
            )}
          </div>
        ) : (
          <>
            <div className="mt-4 flex items-end justify-between gap-3">
              <p className="font-display text-5xl leading-none">
                {goal.current_count}
                <span className="text-2xl text-white/65"> de {goal.target_count}</span>
              </p>
              <p className="text-right text-xs font-black uppercase tracking-wide text-white/80">
                Faltam {remaining}
                <br />
                pra liberar
              </p>
            </div>
            <div className="mt-4 h-4 overflow-hidden rounded-full border-2 border-white bg-foreground/30">
              <div
                className="h-full bg-mango transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs font-black text-white/75">
              <span>{percent}% da meta</span>
              <span>Conta Fofoquinha validada</span>
            </div>
          </>
        )}

        {showAction && !completed && (
          <Link
            to="/mimos"
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-mango px-4 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
          >
            <Sparkles className="h-4 w-4" /> Ver Fofoquinhas que ajudam
          </Link>
        )}

        {showAction && completed && (
          <div className="mt-4 flex items-center gap-2 text-sm font-black text-white/85">
            <Megaphone className="h-4 w-4" /> A galera completou a meta da noite.
          </div>
        )}
      </div>
    </article>
  );
}
