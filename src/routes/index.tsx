import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { MapPin, MessageCircleMore, Sparkles } from "lucide-react";
import { BafafaSign } from "@/components/brand/bafafa-sign";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: LandingPage,
});

const HIGHLIGHTS = [
  { icon: MapPin, label: "Check-in pelo celular", tone: "bg-primary text-primary-foreground" },
  { icon: Sparkles, label: "Fofoquinhas e benefícios", tone: "bg-mango text-mango-foreground" },
  {
    icon: MessageCircleMore,
    label: "Resenha da comunidade",
    tone: "bg-samba text-samba-foreground",
  },
];

function LandingPage() {
  return (
    <main className="app-canvas relative mx-auto flex min-h-dvh max-w-lg flex-col overflow-hidden bg-background px-5 pb-6 pt-6 sm:px-7 sm:pb-8 sm:pt-8">
      <div className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-mango/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-24 h-56 w-56 rounded-full bg-lagoa/20 blur-3xl" />

      <header className="relative flex justify-center">
        <BafafaSign size="full" />
      </header>

      <section className="relative flex flex-1 flex-col justify-center py-7 sm:py-10">
        <div className="mx-auto w-full max-w-md text-center">
          <p className="section-kicker text-primary">Clube do Bafafã</p>
          <h1 className="mt-3 font-display text-[2.65rem] leading-[0.98] tracking-tight sm:text-5xl">
            O Bafafá começa antes de você chegar.
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-[15px] font-semibold leading-relaxed text-muted-foreground sm:text-base">
            Faça check-in, descubra Fofoquinhas e acompanhe o que está rolando no bar pelo celular.
          </p>
        </div>

        <div className="mx-auto mt-6 grid w-full max-w-md gap-2.5">
          {HIGHLIGHTS.map(({ icon: Icon, label, tone }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-card/90 px-3.5 py-3 shadow-sm"
            >
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border-2 border-foreground ${tone}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-black">{label}</span>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-7 grid w-full max-w-md gap-2.5">
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-flex min-h-13 items-center justify-center rounded-2xl border-2 border-foreground bg-primary px-6 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] transition active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            Entrar no Clube
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-black underline decoration-2 underline-offset-4"
          >
            Já tenho cadastro
          </Link>
        </div>
      </section>

      <footer className="relative border-t border-foreground/10 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
        <p>Cadastro gratuito para maiores de 18 anos.</p>
        <p className="mt-1.5">
          <Link to="/privacidade" hash="termos" className="font-bold underline underline-offset-4">
            Termos
          </Link>
          <span aria-hidden> · </span>
          <Link
            to="/privacidade"
            hash="privacidade"
            className="font-bold underline underline-offset-4"
          >
            Privacidade
          </Link>
          <span aria-hidden> · </span>
          <Link
            to="/privacidade"
            hash="comunidade"
            className="font-bold underline underline-offset-4"
          >
            Regras da Comunidade
          </Link>
        </p>
      </footer>
    </main>
  );
}
