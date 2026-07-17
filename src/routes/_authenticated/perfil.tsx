import { publicErrorMessage } from "@/lib/public-error";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type HTMLInputTypeAttribute } from "react";
import { BlockedUsersDialog } from "@/components/chat/blocked-users-dialog";
import { AppShell, ScreenHeader } from "@/components/layout/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BadgeCheck,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Eye,
  LockKeyhole,
  LogOut,
  MapPin,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  UserRoundX,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { ErrorCard, LoadingCard } from "@/components/ui/async-state";
import { removePublicImage, uploadPublicImage } from "@/lib/storage";
import {
  BadgeSticker,
  NameWithBadges,
  dedupeBadgeDefinitions,
  type BafafaBadgeDefinition,
} from "@/components/profile/bafafa-badge";
import {
  EMPTY_PROFILE_COMPLETION,
  nextProfileTask,
  parseProfileCompletion,
  type ProfileCompletionDetails,
} from "@/lib/profile-completion";

export const Route = createFileRoute("/_authenticated/perfil")({
  component: Perfil,
});

type ProfileRow = {
  avatar_url: string | null;
  display_name: string;
  username: string | null;
  city: string | null;
  neighborhood: string | null;
  bio: string | null;
  how_found_us: string | null;
  birth_date: string | null;
  whatsapp: string | null;
  phone_verified_at: string | null;
  is_public: boolean;
  show_city: boolean;
  show_checkin_count: boolean;
  show_event_preferences: boolean;
  member_since: string;
  active_title_id: string | null;
  gender_identity: string | null;
  gender_custom: string | null;
  pronouns: string | null;
  show_gender: boolean;
};

type PreferencesRow = {
  event_categories: string[];
  drink_preferences: string[];
  food_preferences: string[];
  marketing_opt_in: boolean;
  notify_in_app: boolean;
  notify_email: boolean;
  notify_whatsapp: boolean;
  notify_push: boolean;
};

type BadgeRow = {
  id: string;
  is_featured: boolean;
  is_hidden: boolean;
  awarded_at: string;
  badge_definitions: BafafaBadgeDefinition | null;
};

type TitleRow = {
  title_id: string;
  title_definitions: { name: string; description: string | null } | null;
};

const EVENT_OPTIONS = [
  "Pagode de sexta",
  "Pagode de sábado",
  "Feijoada",
  "Futebol",
  "Karaokê",
  "Eventos especiais",
];
const DRINK_OPTIONS = ["Cerveja", "Drinks", "Caipirinha", "Sem álcool"];
const FOOD_OPTIONS = ["Espetinhos", "Feijoada", "Petiscos", "Hambúrguer"];

const emptyPrefs: PreferencesRow = {
  event_categories: [],
  drink_preferences: [],
  food_preferences: [],
  marketing_opt_in: false,
  notify_in_app: true,
  notify_email: false,
  notify_whatsapp: false,
  notify_push: false,
};

function Perfil() {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [prefs, setPrefs] = useState<PreferencesRow>(emptyPrefs);
  const [badges, setBadges] = useState<BadgeRow[]>([]);
  const [titles, setTitles] = useState<TitleRow[]>([]);
  const [completionDetails, setCompletionDetails] =
    useState<ProfileCompletionDetails>(EMPTY_PROFILE_COMPLETION);
  const [checkins, setCheckins] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [avatarSelection, setAvatarSelection] = useState<File | null | undefined>(undefined);
  const [blockedUsersOpen, setBlockedUsersOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);
    setLoadError(null);

    const [
      profileResult,
      prefsResult,
      badgesResult,
      titlesResult,
      completenessResult,
      checkinsResult,
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "avatar_url,display_name,username,city,neighborhood,bio,how_found_us,birth_date,whatsapp,phone_verified_at,is_public,show_city,show_checkin_count,show_event_preferences,member_since,active_title_id,gender_identity,gender_custom,pronouns,show_gender",
        )
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("user_preferences")
        .select(
          "event_categories,drink_preferences,food_preferences,marketing_opt_in,notify_in_app,notify_email,notify_whatsapp,notify_push",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("user_badges")
        .select("id,is_featured,is_hidden,awarded_at,badge_definitions(slug,name,description,icon)")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false }),
      supabase
        .from("user_titles")
        .select("title_id,title_definitions(name,description)")
        .eq("user_id", user.id)
        .order("awarded_at", { ascending: false }),
      supabase.rpc("my_profile_completion_details"),
      supabase.from("checkins").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]);

    const firstError =
      profileResult.error ??
      prefsResult.error ??
      badgesResult.error ??
      titlesResult.error ??
      completenessResult.error ??
      checkinsResult.error;

    if (firstError) {
      setLoadError(firstError.message);
      setLoadingProfile(false);
      return;
    }
    if (!profileResult.data) {
      setLoadError("Seu perfil ainda não foi criado. Saia e entre novamente para tentar de novo.");
      setLoadingProfile(false);
      return;
    }

    setProfile(profileResult.data as ProfileRow);
    setPrefs((prefsResult.data as PreferencesRow | null) ?? emptyPrefs);
    setBadges((badgesResult.data ?? []) as unknown as BadgeRow[]);
    setTitles((titlesResult.data ?? []) as unknown as TitleRow[]);
    setCompletionDetails(parseProfileCompletion(completenessResult.data));
    setCheckins(checkinsResult.count ?? 0);
    setLoadingProfile(false);
  }, [user]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function handleSignOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) return;

    setSaving(true);
    const previousAvatarUrl = profile.avatar_url;
    let avatarUrl = previousAvatarUrl;
    let uploadedAvatarUrl: string | null = null;

    try {
      if (avatarSelection instanceof File) {
        const uploaded = await uploadPublicImage({
          bucket: "avatars",
          folder: user.id,
          file: avatarSelection,
        });
        avatarUrl = uploaded.url;
        uploadedAvatarUrl = uploaded.url;
      } else if (avatarSelection === null) {
        avatarUrl = null;
      }

      const [{ error: profileError }, { error: prefsError }] = await Promise.all([
        supabase
          .from("profiles")
          .update({
            avatar_url: avatarUrl,
            display_name: profile.display_name.trim(),
            username: profile.username?.trim() || null,
            city: profile.city?.trim() || null,
            neighborhood: profile.neighborhood?.trim() || null,
            bio: profile.bio?.trim() || null,
            how_found_us: profile.how_found_us?.trim() || null,
            birth_date: profile.birth_date || null,
            is_public: profile.is_public,
            show_city: profile.show_city,
            show_checkin_count: profile.show_checkin_count,
            show_event_preferences: profile.show_event_preferences,
            active_title_id: profile.active_title_id,
            gender_identity: profile.gender_identity,
            gender_custom:
              profile.gender_identity === "prefiro_descrever"
                ? profile.gender_custom?.trim() || null
                : null,
            pronouns: profile.pronouns?.trim() || null,
            show_gender: profile.show_gender,
          })
          .eq("id", user.id),
        supabase.rpc("set_my_preferences", {
          _event_categories: prefs.event_categories,
          _drink_preferences: prefs.drink_preferences,
          _food_preferences: prefs.food_preferences,
          _notify_in_app: prefs.notify_in_app,
          _notify_email: prefs.notify_email,
          _notify_whatsapp: prefs.notify_whatsapp,
          _notify_push: prefs.notify_push,
          _marketing_opt_in: prefs.marketing_opt_in,
          _consent_version: "1.0",
        }),
      ]);

      if (profileError || prefsError) {
        if (uploadedAvatarUrl) await removePublicImage("avatars", uploadedAvatarUrl);
        throw profileError ?? prefsError ?? new Error("Não foi possível salvar.");
      }

      if (previousAvatarUrl && previousAvatarUrl !== avatarUrl) {
        await removePublicImage("avatars", previousAvatarUrl);
      }

      setProfile({ ...profile, avatar_url: avatarUrl });
      setAvatarSelection(undefined);

      const [badgesResult, titlesResult, completenessResult] = await Promise.all([
        supabase
          .from("user_badges")
          .select(
            "id,is_featured,is_hidden,awarded_at,badge_definitions(slug,name,description,icon)",
          )
          .eq("user_id", user.id)
          .order("awarded_at", { ascending: false }),
        supabase
          .from("user_titles")
          .select("title_id,title_definitions(name,description)")
          .eq("user_id", user.id)
          .order("awarded_at", { ascending: false }),
        supabase.rpc("my_profile_completion_details"),
      ]);

      setBadges((badgesResult.data ?? []) as unknown as BadgeRow[]);
      setTitles((titlesResult.data ?? []) as unknown as TitleRow[]);
      setCompletionDetails(parseProfileCompletion(completenessResult.data));
      toast.success("Perfil salvinho.");
    } catch (error) {
      toast.error(publicErrorMessage(error, "Não foi possível salvar."));
    } finally {
      setSaving(false);
    }
  }

  function togglePreference(
    key: "event_categories" | "drink_preferences" | "food_preferences",
    value: string,
  ) {
    setPrefs((current) => {
      const list = current[key];
      return {
        ...current,
        [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value],
      };
    });
  }

  function focusNextProfileTask() {
    if (!nextTask) return;
    const key =
      nextTask.key === "identity"
        ? profile?.display_name.trim() && !profile.birth_date
          ? "identity-birth"
          : "identity-name"
        : nextTask.key;
    const target = document.querySelector<HTMLElement>(`[data-profile-key="${key}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(
      () => target?.querySelector<HTMLElement>("input, textarea, select, button")?.focus(),
      450,
    );
  }

  const completeness = completionDetails.percentage;
  const nextTask = nextProfileTask(completionDetails);
  const canValidate = roles.some((role) => role === "admin" || role === "equipe");
  const isAdmin = roles.includes("admin");
  const initial = (profile?.display_name?.[0] ?? "B").toUpperCase();
  const activeTitle = titles.find((title) => title.title_id === profile?.active_title_id)
    ?.title_definitions?.name;
  const visibleBadgeDefinitions = dedupeBadgeDefinitions(
    badges
      .filter((badge) => !badge.is_hidden && badge.badge_definitions)
      .map((badge) => badge.badge_definitions as BafafaBadgeDefinition),
  );
  const uniqueVisibleBadges = visibleBadgeDefinitions.map((definition) => ({
    id: definition.slug || definition.name,
    definition,
  }));
  const memberSince = profile?.member_since
    ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
        new Date(profile.member_since),
      )
    : "agora";

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Sua carteirinha"
        title="Carteirinha"
        tone="blue"
        action={
          <button
            onClick={handleSignOut}
            aria-label="Sair"
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-foreground bg-background text-foreground shadow-[2px_3px_0_var(--foreground)]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        }
      />

      {loadingProfile && <LoadingCard label="Abrindo sua carteirinha…" />}
      {loadError && !loadingProfile && (
        <div className="space-y-3">
          <ErrorCard message={loadError} />
          <div className="px-5">
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loadingProfile && !loadError && (
        <div className="space-y-5 px-5 pt-2">
          <section className="content-card content-card--profile overflow-hidden text-white">
            <div className="profile-card__stripe h-12 border-b-2 border-foreground" />
            <div className="relative p-4 pt-0">
              <div className="-mt-8 flex items-start gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-foreground bg-primary font-display text-2xl text-primary-foreground shadow-[2px_3px_0_var(--foreground)]">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={`Foto de ${profile.display_name}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    initial
                  )}
                </div>
                <div className="min-w-0 flex-1 pt-9">
                  <NameWithBadges
                    name={profile?.display_name ?? "Bafafã"}
                    badges={visibleBadgeDefinitions}
                    maxBadges={3}
                    className="text-xl font-black"
                  />
                  <p className="mt-0.5 truncate text-sm font-semibold text-white/75">
                    {profile?.username ? `@${profile.username}` : "Escolha seu @ no perfil"}
                  </p>
                </div>
                {profile?.username && profile.is_public && (
                  <Link
                    to="/u/$username"
                    params={{ username: profile.username }}
                    aria-label="Abrir perfil público"
                    className="mt-3 grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-foreground/30 bg-mango text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {activeTitle && (
                  <span className="rounded-full bg-foreground px-3 py-1 text-[10px] font-black uppercase tracking-wide text-background">
                    {activeTitle}
                  </span>
                )}
                {profile?.bio && (
                  <p className="w-full text-sm leading-relaxed text-white/80">{profile.bio}</p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-white/20 rounded-2xl border-2 border-white/30 bg-white/12 py-3 text-center">
                <div>
                  <p className="text-xl font-black leading-none">{checkins}</p>
                  <p className="mt-1 text-[9px] font-black uppercase text-white/65">check-ins</p>
                </div>
                <div>
                  <p className="text-xl font-black leading-none">
                    {visibleBadgeDefinitions.length}
                  </p>
                  <p className="mt-1 text-[9px] font-black uppercase text-white/65">selos</p>
                </div>
                <div>
                  <p className="text-sm font-black leading-none">{memberSince}</p>
                  <p className="mt-1 text-[9px] font-black uppercase text-white/65">no clube</p>
                </div>
              </div>
            </div>
          </section>

          <section className="content-card content-card--mission p-4 text-foreground">
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="section-kicker">Aquisição de fofoca</p>
                <p className="mt-1 font-poster text-lg">Perfil {completeness}% completo</p>
              </div>
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full border-2 border-foreground bg-white">
              <div className="h-full bg-primary" style={{ width: `${completeness}%` }} />
            </div>
            <p className="mt-2 text-xs font-semibold opacity-70">
              {completeness === 100
                ? "Perfil no grau. O selo já sabe seu nome."
                : nextTask
                  ? `Próxima fofoca: ${nextTask.label} (+${nextTask.weight}%).`
                  : "Preencha aos poucos e desbloqueie selos e títulos."}
            </p>
            {nextTask && completeness < 100 && (
              <button
                type="button"
                onClick={focusNextProfileTask}
                className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-white px-3 py-2 text-xs font-black shadow-[2px_3px_0_var(--foreground)]"
              >
                Completar agora <Sparkles className="h-3.5 w-3.5" />
              </button>
            )}
            {completionDetails.items.length > 0 && (
              <div className="mt-4 grid gap-2 rounded-2xl border-2 border-foreground/15 bg-white/80 p-3 sm:grid-cols-2">
                {completionDetails.items.map((item) => (
                  <div key={item.key} className="flex items-center gap-2 text-xs font-black">
                    {item.complete ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 opacity-35" />
                    )}
                    <span className={item.complete ? "" : "opacity-60"}>{item.label}</span>
                    <span className="ml-auto opacity-50">{item.weight}%</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          {(canValidate || isAdmin) && (
            <div className="grid gap-3 sm:grid-cols-2">
              {canValidate && (
                <Link
                  to="/staff/checkin"
                  className="sticker-card flex items-center gap-3 bg-primary p-4 text-primary-foreground"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <div>
                    <p className="font-poster text-sm">Validar códigos</p>
                    <p className="text-xs opacity-75">Check-in e mimos.</p>
                  </div>
                </Link>
              )}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="sticker-card flex items-center gap-3 bg-foreground p-4 text-background"
                >
                  <ShieldCheck className="h-5 w-5" />
                  <div>
                    <p className="font-poster text-sm">Administração</p>
                    <p className="text-xs opacity-70">Gestão do aplicativo.</p>
                  </div>
                </Link>
              )}
            </div>
          )}

          <section className="content-card bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5 text-samba" />
                <h2 className="font-display text-2xl">Meus selos</h2>
              </div>
              <span className="rounded-full bg-lagoa px-3 py-1 text-[10px] font-black uppercase">
                {visibleBadgeDefinitions.length} na coleção
              </span>
            </div>
            {uniqueVisibleBadges.length === 0 ? (
              <p className="mt-4 text-sm font-semibold text-muted-foreground">
                Seu primeiro check-in libera o primeiro selo de presença.
              </p>
            ) : (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {uniqueVisibleBadges.map((badge) => (
                  <BadgeSticker key={badge.id} badge={badge.definition} />
                ))}
              </div>
            )}
          </section>

          <form onSubmit={saveProfile} className="profile-form content-card space-y-5 bg-card p-5">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              <div>
                <p className="section-kicker text-muted-foreground">Conta mais um pouco</p>
                <h2 className="font-display text-2xl">Completar perfil</h2>
              </div>
            </div>

            {!profile ? (
              <p className="text-sm text-muted-foreground">Carregando seu perfil…</p>
            ) : (
              <>
                <div data-profile-key="avatar">
                  <ImageUploadField
                    id="profile-avatar"
                    label="Foto do perfil"
                    currentUrl={profile.avatar_url}
                    onChange={setAvatarSelection}
                    description="Escolha uma foto do computador ou celular. Ela será cortada em formato redondo."
                    round
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField
                    dataProfileKey="identity-name"
                    label="Nome"
                    value={profile.display_name}
                    onChange={(value) => setProfile({ ...profile, display_name: value })}
                    required
                  />
                  <TextField
                    dataProfileKey="username"
                    label="Nome de usuário"
                    value={profile.username ?? ""}
                    onChange={(value) => setProfile({ ...profile, username: value })}
                    placeholder="seuusuario"
                  />
                  <TextField
                    dataProfileKey="identity-birth"
                    label="Data de nascimento"
                    value={profile.birth_date ?? ""}
                    onChange={(value) => setProfile({ ...profile, birth_date: value || null })}
                    type="date"
                  />
                  <TextField
                    dataProfileKey="city"
                    label="Cidade"
                    value={profile.city ?? ""}
                    onChange={(value) => setProfile({ ...profile, city: value })}
                  />
                  <TextField
                    dataProfileKey="neighborhood"
                    label="Bairro"
                    value={profile.neighborhood ?? ""}
                    onChange={(value) => setProfile({ ...profile, neighborhood: value })}
                  />
                </div>

                <section className="profile-subpanel profile-subpanel--identity p-4">
                  <div>
                    <p className="font-black">Identidade e tratamento</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Campos opcionais e inclusivos. Não interferem nos 100% da carteirinha.
                    </p>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-sm font-black">
                        Como você se identifica?
                      </span>
                      <select
                        value={profile.gender_identity ?? ""}
                        onChange={(event) =>
                          setProfile({ ...profile, gender_identity: event.target.value || null })
                        }
                        className="bafafa-select"
                      >
                        <option value="">Não informado</option>
                        <option value="mulher">Mulher</option>
                        <option value="homem">Homem</option>
                        <option value="nao_binaria">Pessoa não binária</option>
                        <option value="outra">Outra identidade</option>
                        <option value="prefiro_descrever">Prefiro me descrever</option>
                        <option value="prefiro_nao_informar">Prefiro não informar</option>
                      </select>
                    </label>
                    <TextField
                      label="Pronomes (opcional)"
                      value={profile.pronouns ?? ""}
                      onChange={(value) => setProfile({ ...profile, pronouns: value })}
                      placeholder="ela/dela, ele/dele, elu/delu…"
                    />
                  </div>
                  {profile.gender_identity === "prefiro_descrever" && (
                    <div className="mt-3">
                      <TextField
                        label="Como prefere se descrever?"
                        value={profile.gender_custom ?? ""}
                        onChange={(value) => setProfile({ ...profile, gender_custom: value })}
                        placeholder="Escreva do seu jeito"
                      />
                    </div>
                  )}
                </section>
                <TextField
                  dataProfileKey="origin"
                  label="Como conheceu o Bafafá?"
                  value={profile.how_found_us ?? ""}
                  onChange={(value) => setProfile({ ...profile, how_found_us: value })}
                  placeholder="Amigos, Instagram, passando na praça…"
                />
                <label className="block">
                  <span className="mb-1 block text-sm font-black">Bio curta</span>
                  <textarea
                    value={profile.bio ?? ""}
                    onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
                    rows={3}
                    className={inputCls}
                  />
                </label>

                <PreferenceGroup
                  dataProfileKey="events"
                  title="Quais rolês você curte?"
                  options={EVENT_OPTIONS}
                  selected={prefs.event_categories}
                  onToggle={(value) => togglePreference("event_categories", value)}
                />
                <PreferenceGroup
                  dataProfileKey="drinks"
                  title="O que costuma beber?"
                  options={DRINK_OPTIONS}
                  selected={prefs.drink_preferences}
                  onToggle={(value) => togglePreference("drink_preferences", value)}
                />
                <PreferenceGroup
                  dataProfileKey="foods"
                  title="E pra comer?"
                  options={FOOD_OPTIONS}
                  selected={prefs.food_preferences}
                  onToggle={(value) => togglePreference("food_preferences", value)}
                />

                {titles.length > 0 && (
                  <label className="block">
                    <span className="mb-1 flex items-center gap-2 text-sm font-black">
                      <Trophy className="h-4 w-4" /> Título em destaque
                    </span>
                    <select
                      value={profile.active_title_id ?? ""}
                      onChange={(event) =>
                        setProfile({ ...profile, active_title_id: event.target.value || null })
                      }
                      className="bafafa-select"
                    >
                      <option value="">Sem título</option>
                      {titles.map((title) => (
                        <option key={title.title_id} value={title.title_id}>
                          {title.title_definitions?.name ?? "Título"}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <div className="profile-subpanel profile-subpanel--privacy space-y-3 p-4 text-sm">
                  <div>
                    <p className="font-black">Privacidade do perfil público</p>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Você escolhe quais informações sociais aparecem para outros Bafafãs.
                    </p>
                  </div>
                  <Toggle
                    label="Perfil visível para outros Bafafãs"
                    checked={profile.is_public}
                    onChange={(checked) => setProfile({ ...profile, is_public: checked })}
                  />
                  <Toggle
                    label="Mostrar minha cidade"
                    checked={profile.show_city}
                    onChange={(checked) => setProfile({ ...profile, show_city: checked })}
                  />
                  <Toggle
                    label="Mostrar quantidade de check-ins"
                    checked={profile.show_checkin_count}
                    onChange={(checked) => setProfile({ ...profile, show_checkin_count: checked })}
                  />
                  <Toggle
                    label="Mostrar meus tipos de evento preferidos"
                    checked={profile.show_event_preferences}
                    onChange={(checked) =>
                      setProfile({ ...profile, show_event_preferences: checked })
                    }
                  />
                  <Toggle
                    label="Mostrar identidade de gênero no perfil público"
                    checked={profile.show_gender}
                    onChange={(checked) => setProfile({ ...profile, show_gender: checked })}
                  />
                  <div className="my-2 h-px bg-foreground/10" />
                  <Toggle
                    label="Receber avisos dentro do app"
                    checked={prefs.notify_in_app}
                    onChange={(checked) => setPrefs({ ...prefs, notify_in_app: checked })}
                  />
                  <Toggle
                    label="Receber promoções por WhatsApp/e-mail (opcional)"
                    checked={prefs.marketing_opt_in}
                    onChange={(checked) => setPrefs({ ...prefs, marketing_opt_in: checked })}
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
                >
                  <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar perfil"}
                </button>
              </>
            )}
          </form>

          <Link
            to="/seguranca"
            className="content-card content-card--profile flex items-center gap-3 p-4 text-white"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-[2px_3px_0_var(--foreground)]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black">Segurança da conta</p>
              <p className="mt-0.5 text-xs font-semibold text-white/75">
                Senha, sessões e autenticação em duas etapas.
              </p>
            </div>
            <ShieldCheck className="h-5 w-5 shrink-0 text-white" />
          </Link>

          <section className="content-card bg-card p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-foreground bg-samba text-samba-foreground shadow-[2px_3px_0_var(--foreground)]">
                <UserRoundX className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-black">Pessoas bloqueadas</p>
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  Reveja e desfaça bloqueios feitos na Resenha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBlockedUsersOpen(true)}
                className="shrink-0 rounded-full border-2 border-foreground bg-background px-3 py-2 text-xs font-black shadow-[2px_2px_0_var(--foreground)]"
              >
                Gerenciar
              </button>
            </div>
          </section>

          <section className="card-festa p-4 text-sm text-muted-foreground">
            <p className="flex items-center gap-2 font-black text-foreground">
              <LockKeyhole className="h-4 w-4" /> Dados privados
            </p>
            <p className="mt-2">
              Telefone, nascimento, bairro, histórico de mimos e detalhes de presença nunca aparecem
              no perfil público.
            </p>
            <p className="mt-2 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Cidade, total de check-ins e preferências só
              aparecem quando você autoriza.
            </p>
            <p className="mt-2 flex items-center gap-1.5">
              <CalendarCheck2 className="h-3.5 w-3.5" /> Telefone verificado:{" "}
              {profile?.phone_verified_at ? "sim" : "será ativado no lançamento com OTP"}.
            </p>
          </section>
        </div>
      )}

      <BlockedUsersDialog open={blockedUsersOpen} onOpenChange={setBlockedUsersOpen} />
    </AppShell>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-foreground/20 bg-surface px-4 py-2.5 font-semibold outline-none focus:border-electric focus:ring-4 focus:ring-lagoa/20";

function TextField({
  dataProfileKey,
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  dataProfileKey?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: HTMLInputTypeAttribute;
}) {
  return (
    <label className="block" data-profile-key={dataProfileKey}>
      <span className="mb-1 block text-sm font-black">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        className={inputCls}
      />
    </label>
  );
}

function PreferenceGroup({
  dataProfileKey,
  title,
  options,
  selected,
  onToggle,
}: {
  dataProfileKey?: string;
  title: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <fieldset data-profile-key={dataProfileKey}>
      <legend className="text-sm font-black">{title}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option, index) => {
          const active = selected.includes(option);
          const colors = [
            "bg-mango",
            "bg-lagoa",
            "bg-samba text-white",
            "bg-secondary",
            "bg-primary text-white",
          ];
          return (
            <button
              key={option}
              type="button"
              onClick={() => onToggle(option)}
              className={`rounded-full border-2 px-3 py-2 text-xs font-black transition ${
                active
                  ? `${colors[index % colors.length]} border-foreground shadow-[2px_2px_0_var(--foreground)]`
                  : "border-foreground/15 bg-background text-muted-foreground"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-foreground/10 bg-white/55 px-3 py-2.5 font-semibold transition hover:border-foreground/25">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border-2 border-foreground transition ${checked ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full transition-transform ${checked ? "translate-x-5 bg-white" : "bg-foreground"}`}
        />
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </label>
  );
}
