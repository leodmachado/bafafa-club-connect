import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { BadgeCheck, CalendarCheck, MapPin, Sparkles, UserRound } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="mx-auto min-h-screen max-w-lg bg-background">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute inset-0 bg-confete opacity-40" aria-hidden />
        <div className="relative px-6 pb-14 pt-16">
          <Wordmark tone="white" />
          <h1 className="mt-10 font-display text-4xl leading-[1.05]">
            Chega mais, <span className="text-mango">Bafafã</span>.
          </h1>
          <p className="mt-4 max-w-sm text-base text-primary-foreground/90">
            Veja as promoções, encontre o evento e confirme sua presença pelo celular. Quanto mais
            você volta ao Bafafá, mais Fofoquinhas, selos e títulos aparecem na sua carteirinha.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="inline-flex items-center gap-2 rounded-full bg-mango px-5 py-3 text-sm font-bold text-mango-foreground shadow-festa transition hover:opacity-90"
            >
              Quero ser Bafafã
            </Link>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="inline-flex items-center gap-2 rounded-full border-2 border-primary-foreground/40 px-5 py-3 text-sm font-bold text-primary-foreground hover:bg-primary-foreground/10"
            >
              Já sou do clube
            </Link>
          </div>
        </div>
      </section>

      <section className="space-y-3 px-5 py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
          O que rola no clube
        </p>
        {[
          {
            icon: MapPin,
            title: "Confirme que já chegou",
            copy: "Abra o evento e faça check-in pela localização. Se o GPS falhar, a equipe valida seu QR.",
            tone: "bg-primary text-primary-foreground",
          },
          {
            icon: Sparkles,
            title: "Descubra as Fofoquinhas",
            copy: "Promoções, vantagens e missões do clube aparecem conforme você participa.",
            tone: "bg-samba text-samba-foreground",
          },
          {
            icon: UserRound,
            title: "Complete seu perfil aos poucos",
            copy: "Nada de formulário gigante. Conte suas preferências no seu ritmo.",
            tone: "bg-lagoa text-lagoa-foreground",
          },
          {
            icon: BadgeCheck,
            title: "Ganhe selos e títulos",
            copy: "Primeiro check-in, perfil completo e frequência viram conquistas no clube.",
            tone: "bg-mango text-mango-foreground",
          },
        ].map(({ icon: Icon, title, copy, tone }) => (
          <article key={title} className="card-festa flex gap-4 p-4">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone}`}>
              <Icon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg leading-tight">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="px-5 pb-16">
        <div className="card-festa bg-foreground p-6 text-background">
          <p className="font-display text-2xl leading-tight">
            Chegue. Faça check-in. Desbloqueie a Fofoquinha.
          </p>
          <p className="mt-2 text-sm opacity-80">
            Cadastro gratuito para maiores de 18 anos. Promoções têm regras e validade informadas no
            aplicativo.
          </p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-mango px-5 py-3 text-sm font-bold text-mango-foreground"
          >
            Criar meu cadastro
          </Link>
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Bafafá Bar — Natal/RN · © {new Date().getFullYear()}
        </p>
      </section>
    </div>
  );
}
