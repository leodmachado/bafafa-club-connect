import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CalendarHeart,
  LockKeyhole,
  MapPin,
  MessageCircleMore,
  Music2,
  TicketCheck,
} from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import {
  BadgeSticker,
  NameWithBadges,
  dedupeBadgeDefinitions,
  type BafafaBadgeDefinition,
} from "@/components/profile/bafafa-badge";
import { supabase } from "@/integrations/supabase/client";

type PublicProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  member_since: string;
  active_title: string | null;
  badges: BafafaBadgeDefinition[];
  badge_count: number;
  checkin_count: number | null;
  event_preferences: string[];
  gender: string | null;
  pronouns: string | null;
};

export const Route = createFileRoute("/u/$username")({
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { username } = Route.useParams();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void supabase.rpc("get_public_profile", { _username: username }).then(({ data }) => {
      if (!mounted) return;
      setProfile((data as unknown as PublicProfile | null) ?? null);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [username]);

  const badges = useMemo(() => dedupeBadgeDefinitions(profile?.badges ?? []), [profile?.badges]);

  return (
    <div className="app-canvas min-h-screen px-4 py-6">
      <main className="mx-auto max-w-lg">
        <div className="mb-5 flex items-center justify-between gap-4">
          <Wordmark variant="short" />
          <Link
            to="/"
            className="rounded-xl border-2 border-foreground bg-background px-3 py-2 text-xs font-black shadow-[2px_3px_0_var(--foreground)]"
          >
            Entrar no clube
          </Link>
        </div>

        {loading ? (
          <div className="card-festa p-8 text-center text-sm font-bold text-muted-foreground">
            Procurando essa figurinha…
          </div>
        ) : !profile ? (
          <section className="poster-card checker-texture p-6 text-foreground">
            <span className="cut-label bg-white">perfil fechado</span>
            <LockKeyhole className="mt-5 h-8 w-8" />
            <h1 className="mt-3 font-display text-4xl leading-none">
              Essa figurinha não está no álbum público.
            </h1>
            <p className="mt-3 text-sm font-semibold opacity-70">
              O perfil pode estar privado, sem nome de usuário ou ter mudado de endereço.
            </p>
          </section>
        ) : (
          <div className="space-y-4">
            <section className="overflow-hidden rounded-[2rem] border-2 border-foreground/20 bg-card shadow-[0_7px_0_rgba(20,16,40,0.13)]">
              <div className="brick-texture h-24 border-b-2 border-foreground/15" />
              <div className="relative px-5 pb-5">
                <div className="-mt-12 grid h-24 w-24 place-items-center overflow-hidden rounded-full border-[4px] border-foreground bg-primary font-display text-4xl text-primary-foreground shadow-[3px_4px_0_var(--foreground)]">
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (profile.display_name[0]?.toUpperCase() ?? "B")
                  )}
                </div>

                <div className="mt-4">
                  <NameWithBadges
                    name={profile.display_name}
                    badges={badges}
                    className="font-poster text-2xl"
                    maxBadges={3}
                  />
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    @{profile.username}
                  </p>
                  {profile.active_title && (
                    <span className="mt-3 inline-flex rounded-full bg-foreground px-3 py-1 text-[10px] font-black uppercase tracking-wide text-background">
                      {profile.active_title}
                    </span>
                  )}
                  {profile.bio && (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {profile.bio}
                    </p>
                  )}
                  {(profile.gender || profile.pronouns) && (
                    <p className="mt-3 text-xs font-bold text-muted-foreground">
                      {[profile.gender, profile.pronouns].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-muted-foreground">
                    {profile.city && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-brick" /> {profile.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" /> No clube desde{" "}
                      {new Intl.DateTimeFormat("pt-BR", {
                        month: "short",
                        year: "numeric",
                      }).format(new Date(profile.member_since))}
                    </span>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 divide-x divide-foreground/10 rounded-2xl bg-muted/45 py-3 text-center">
                  <div>
                    <p className="text-xl font-black leading-none">
                      {profile.checkin_count ?? "—"}
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase text-muted-foreground">
                      check-ins
                    </p>
                  </div>
                  <div>
                    <p className="text-xl font-black leading-none">
                      {profile.badge_count ?? badges.length}
                    </p>
                    <p className="mt-1 text-[9px] font-black uppercase text-muted-foreground">
                      selos
                    </p>
                  </div>
                  <div>
                    <Music2 className="mx-auto h-5 w-5 text-samba" />
                    <p className="mt-1 text-[9px] font-black uppercase text-muted-foreground">
                      Bafafã
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {profile.event_preferences?.length > 0 && (
              <section className="sticker-card bg-card p-4">
                <div className="flex items-center gap-2">
                  <CalendarHeart className="h-5 w-5 text-brick" />
                  <div>
                    <p className="section-kicker text-muted-foreground">Rolês preferidos</p>
                    <h2 className="font-display text-xl">Onde essa pessoa aparece</h2>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.event_preferences.map((preference) => (
                    <span
                      key={preference}
                      className="rounded-full border-2 border-foreground/15 bg-background px-3 py-1.5 text-xs font-black"
                    >
                      {preference}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="sticker-card bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <BadgeCheck className="h-5 w-5 text-samba" />
                  <div>
                    <p className="section-kicker text-muted-foreground">Coleção pública</p>
                    <h2 className="font-display text-xl">Selos à mostra</h2>
                  </div>
                </div>
                <span className="rounded-full bg-lagoa px-3 py-1 text-[10px] font-black uppercase">
                  {badges.length}
                </span>
              </div>
              {badges.length ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {badges.map((badge) => (
                    <BadgeSticker key={badge.slug || badge.name} badge={badge} />
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm font-semibold text-muted-foreground">
                  Essa pessoa ainda está começando a coleção.
                </p>
              )}
            </section>

            <section className="rounded-3xl border-2 border-foreground/15 bg-foreground p-5 text-background">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mango text-foreground">
                  <MessageCircleMore className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-display text-xl">Encontrou na Resenha?</p>
                  <p className="mt-1 text-xs font-semibold opacity-70">
                    Nome, título e selos ajudam a reconhecer os Bafafãs sem revelar dados privados.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-bold opacity-70">
                <TicketCheck className="h-4 w-4" /> Só quem faz check-in participa da conversa do
                evento.
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
