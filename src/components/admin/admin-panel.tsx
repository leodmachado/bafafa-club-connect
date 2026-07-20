import { publicErrorMessage } from "@/lib/public-error";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Crown,
  Copy,
  Edit3,
  Eye,
  ExternalLink,
  Gift,
  House,
  ListOrdered,
  Loader2,
  MessageCircleMore,
  Newspaper,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  ShieldCheck,
  TimerOff,
  Target,
  Trash2,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { campaignBenefitLabel, formatDateTime } from "@/lib/bafafa";
import { effectiveEventStatus, withEffectiveEventStatus } from "@/lib/event-status";
import { removePublicImage, uploadPublicImage } from "@/lib/storage";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { ManagementDashboard } from "@/components/admin/management-dashboard";
import { SecurityDashboard } from "@/components/admin/security-dashboard";
import { CommercialDashboard } from "@/components/admin/commercial-dashboard";
import { GoogleVenueSearch } from "@/components/admin/venue-picker";

export type AdminSection =
  | "overview"
  | "management"
  | "commercial"
  | "house_sessions"
  | "events"
  | "campaigns"
  | "content"
  | "clients"
  | "checkins"
  | "chat"
  | "team"
  | "security"
  | "audit";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventUpdate = Database["public"]["Tables"]["events"]["Update"];
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type VenueInsert = Database["public"]["Tables"]["venues"]["Insert"];
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type CampaignLinkClickRow = Database["public"]["Tables"]["campaign_link_clicks"]["Row"];
type FeedPostRow = Database["public"]["Tables"]["feed_posts"]["Row"];
type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PreferenceRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type CheckinRow = Database["public"]["Tables"]["checkins"]["Row"];
type RoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type RewardRow = Database["public"]["Tables"]["user_rewards"]["Row"];
type RedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"];
type AuditRow = Database["public"]["Tables"]["audit_logs"]["Row"];
type BadgeDefinitionRow = Database["public"]["Tables"]["badge_definitions"]["Row"];
type UserBadgeRow = Database["public"]["Tables"]["user_badges"]["Row"];
type ChatReportRow = Database["public"]["Tables"]["event_chat_reports"]["Row"];
type ChatMessageRow = Database["public"]["Tables"]["event_chat_messages"]["Row"];
type ProfileCompletionRow = { user_id: string; percentage: number; details: unknown };
type PrivateChatReportRow = {
  report_id: string;
  message_id: string;
  thread_id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  message_body: string;
  author_name: string;
  reporter_name: string;
};

type AdminData = {
  events: EventRow[];
  venues: VenueRow[];
  campaigns: CampaignRow[];
  campaignLinkClicks: CampaignLinkClickRow[];
  feedPosts: FeedPostRow[];
  profiles: ProfileRow[];
  preferences: PreferenceRow[];
  checkins: CheckinRow[];
  roles: RoleRow[];
  rewards: RewardRow[];
  redemptions: RedemptionRow[];
  audits: AuditRow[];
  badgeDefinitions: BadgeDefinitionRow[];
  userBadges: UserBadgeRow[];
  profileCompletions: ProfileCompletionRow[];
  chatReports: ChatReportRow[];
  chatMessages: ChatMessageRow[];
  privateChatReports: PrivateChatReportRow[];
};

const EMPTY_DATA: AdminData = {
  events: [],
  venues: [],
  campaigns: [],
  campaignLinkClicks: [],
  feedPosts: [],
  profiles: [],
  preferences: [],
  checkins: [],
  roles: [],
  rewards: [],
  redemptions: [],
  audits: [],
  badgeDefinitions: [],
  userBadges: [],
  profileCompletions: [],
  chatReports: [],
  chatMessages: [],
  privateChatReports: [],
};

const NAV_ITEMS: Array<{ key: AdminSection; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "Visão geral", icon: BarChart3 },
  { key: "management", label: "Gestão e piloto", icon: Target },
  { key: "commercial", label: "CRM e vendas", icon: ShoppingBag },
  { key: "house_sessions", label: "Sessão da Casa", icon: House },
  { key: "events", label: "Eventos", icon: CalendarDays },
  { key: "campaigns", label: "Campanhas", icon: Gift },
  { key: "content", label: "Feed", icon: Newspaper },
  { key: "clients", label: "Clientes", icon: Users },
  { key: "checkins", label: "Check-ins", icon: CheckCircle2 },
  { key: "chat", label: "Resenha", icon: MessageCircleMore },
  { key: "team", label: "Equipe", icon: UserCog },
  { key: "security", label: "Segurança", icon: ShieldCheck },
  { key: "audit", label: "Auditoria", icon: ClipboardList },
];

export function AdminPanel({ currentUserId }: { currentUserId: string }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [data, setData] = useState<AdminData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError(null);

    await supabase.rpc("sync_event_statuses");

    const [
      events,
      venues,
      campaigns,
      campaignLinkClicks,
      feedPosts,
      profiles,
      preferences,
      checkins,
      roles,
      rewards,
      redemptions,
      audits,
      badgeDefinitions,
      userBadges,
      profileCompletions,
      chatReports,
      chatMessages,
      privateChatReports,
    ] = await Promise.all([
      supabase.from("events").select("*").order("starts_at", { ascending: false }),
      supabase.from("venues").select("*").order("name"),
      supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
      supabase
        .from("campaign_link_clicks")
        .select("*")
        .order("clicked_at", { ascending: false })
        .limit(5000),
      supabase.from("feed_posts").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("*").is("deleted_at", null).order("created_at", {
        ascending: false,
      }),
      supabase.from("user_preferences").select("*"),
      supabase.from("checkins").select("*").order("created_at", { ascending: false }).limit(1000),
      supabase.from("user_roles").select("*"),
      supabase
        .from("user_rewards")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase
        .from("reward_redemptions")
        .select("*")
        .order("redeemed_at", { ascending: false })
        .limit(1000),
      supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("badge_definitions").select("*").order("sort_order"),
      supabase.from("user_badges").select("*"),
      supabase.rpc("admin_profile_completion_overview"),
      supabase
        .from("event_chat_reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("event_chat_messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.rpc("admin_private_chat_report_queue"),
    ]);

    const firstError = [
      events,
      venues,
      campaigns,
      campaignLinkClicks,
      feedPosts,
      profiles,
      preferences,
      checkins,
      roles,
      rewards,
      redemptions,
      audits,
      badgeDefinitions,
      userBadges,
      profileCompletions,
      chatReports,
      chatMessages,
      privateChatReports,
    ]
      .map((result) => result.error)
      .find(Boolean);

    if (firstError) {
      setError(firstError.message);
      toast.error("Não foi possível carregar o painel.");
    } else {
      setData({
        events: (events.data ?? []).map((event) => withEffectiveEventStatus(event)),
        venues: venues.data ?? [],
        campaigns: campaigns.data ?? [],
        campaignLinkClicks: campaignLinkClicks.data ?? [],
        feedPosts: feedPosts.data ?? [],
        profiles: profiles.data ?? [],
        preferences: preferences.data ?? [],
        checkins: checkins.data ?? [],
        roles: roles.data ?? [],
        rewards: rewards.data ?? [],
        redemptions: redemptions.data ?? [],
        audits: audits.data ?? [],
        badgeDefinitions: badgeDefinitions.data ?? [],
        userBadges: userBadges.data ?? [],
        profileCompletions: (profileCompletions.data ?? []) as ProfileCompletionRow[],
        chatReports: chatReports.data ?? [],
        chatMessages: chatMessages.data ?? [],
        privateChatReports: (privateChatReports.data ?? []) as PrivateChatReportRow[],
      });
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <div className="app-canvas min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b-2 border-foreground bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Wordmark variant="short" />
            <div className="hidden min-w-0 sm:block">
              <p className="section-kicker text-muted-foreground">Painel administrativo</p>
              <p className="truncate font-display text-2xl leading-none">Clube dos Bafafãs</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadData(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
            <Link
              to="/inicio"
              className="rounded-full border border-input px-4 py-2 text-sm font-semibold hover:bg-muted"
            >
              Voltar ao app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <nav className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-black transition ${
                section === key
                  ? "border-foreground bg-mango text-foreground shadow-[2px_3px_0_var(--foreground)]"
                  : "border-foreground/15 bg-card text-muted-foreground hover:bg-muted"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="card-festa grid min-h-64 place-items-center p-8">
            <div className="text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
              <p className="mt-3 text-sm text-muted-foreground">Organizando o Bafafá…</p>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-destructive/35 bg-destructive/10 p-6">
            <p className="font-display text-xl">Deu ruim no painel.</p>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Button className="mt-4" onClick={() => void loadData()}>
              Tentar novamente
            </Button>
          </div>
        ) : (
          <>
            {section === "overview" && <Overview data={data} />}
            {section === "management" && (
              <ManagementDashboard data={data} currentUserId={currentUserId} />
            )}
            {section === "commercial" && <CommercialDashboard events={data.events} />}
            {section === "house_sessions" && (
              <HouseSessionsManager
                events={data.events}
                venues={data.venues}
                onChanged={() => void loadData(true)}
              />
            )}
            {section === "events" && (
              <EventsManager
                events={data.events}
                venues={data.venues}
                onChanged={() => void loadData(true)}
              />
            )}
            {section === "campaigns" && (
              <CampaignsManager
                campaigns={data.campaigns}
                campaignLinkClicks={data.campaignLinkClicks}
                events={data.events}
                rewards={data.rewards}
                redemptions={data.redemptions}
                profiles={data.profiles}
                feedPosts={data.feedPosts}
                onChanged={() => void loadData(true)}
              />
            )}
            {section === "content" && (
              <FeedContentManager
                posts={data.feedPosts}
                currentUserId={currentUserId}
                onChanged={() => void loadData(true)}
              />
            )}
            {section === "clients" && (
              <ClientsManager data={data} onChanged={() => void loadData(true)} />
            )}
            {section === "checkins" && <CheckinsManager data={data} />}
            {section === "chat" && (
              <ChatModerationManager data={data} onChanged={() => void loadData(true)} />
            )}
            {section === "team" && (
              <TeamManager
                profiles={data.profiles}
                roles={data.roles}
                currentUserId={currentUserId}
                onChanged={() => void loadData(true)}
              />
            )}
            {section === "security" && <SecurityDashboard />}
            {section === "audit" && <AuditManager data={data} />}
          </>
        )}
      </div>
    </div>
  );
}

function Overview({ data }: { data: AdminData }) {
  const now = Date.now();
  const metrics = [
    {
      label: "Clientes cadastrados",
      value: data.profiles.length,
      copy: `${data.profiles.filter((profile) => profile.created_at && new Date(profile.created_at).getTime() > now - 7 * 86400000).length} nos últimos 7 dias`,
      icon: Users,
    },
    {
      label: "Próximos eventos",
      value: data.events.filter((event) => new Date(event.starts_at).getTime() >= now).length,
      copy: `${data.events.filter((event) => event.status === "ongoing").length} rolando agora`,
      icon: CalendarDays,
    },
    {
      label: "Check-ins",
      value: data.checkins.length,
      copy: `${data.checkins.filter((checkin) => new Date(checkin.created_at).getTime() > now - 7 * 86400000).length} nos últimos 7 dias`,
      icon: CheckCircle2,
    },
    {
      label: "Mimos utilizados",
      value: data.rewards.filter((reward) => reward.status === "redeemed").length,
      copy: `${data.rewards.filter((reward) => reward.status === "available").length} ainda disponíveis`,
      icon: Gift,
    },
  ];

  const profileCompletionByUser = new Map(
    data.profileCompletions.map((row) => [row.user_id, Number(row.percentage ?? 0)]),
  );

  const latestEvents = [...data.events]
    .filter((event) => new Date(event.starts_at).getTime() >= now - 86400000)
    .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          O Bafafá em números
        </p>
        <h1 className="mt-1 font-display text-3xl sm:text-4xl">Visão geral</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, copy, icon: Icon }, index) => (
          <div key={label} className="sticker-card bg-card p-5">
            <div
              className={`grid h-11 w-11 place-items-center rounded-full ${
                ["bg-primary text-primary-foreground", "bg-mango", "bg-samba", "bg-sky text-white"][
                  index
                ]
              }`}
            >
              <Icon className="h-5 w-5" />
            </div>
            <p className="mt-5 text-sm font-bold text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-4xl">{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{copy}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="card-festa p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Agenda
              </p>
              <h2 className="mt-1 font-display text-2xl">Próximos eventos</h2>
            </div>
            <CalendarDays className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-5 space-y-3">
            {latestEvents.length === 0 ? (
              <EmptyMessage>Cadastre o primeiro evento para preencher a agenda.</EmptyMessage>
            ) : (
              latestEvents.map((event) => (
                <div key={event.id} className="rounded-2xl border border-input p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{event.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDateTime(event.starts_at)} · {event.attraction || event.category}
                      </p>
                    </div>
                    <StatusPill status={effectiveEventStatus(event)} />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card-festa p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Aquisição de dados
          </p>
          <h2 className="mt-1 font-display text-2xl">Perfis completos</h2>
          <div className="mt-5 space-y-3">
            {[100, 60, 40].map((threshold) => {
              const count = data.profiles.filter(
                (profile) => (profileCompletionByUser.get(profile.id) ?? 0) >= threshold,
              ).length;
              return (
                <div key={threshold} className="rounded-2xl bg-muted p-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold">
                      {threshold === 100 ? "100% completos" : `${threshold}% ou mais`}
                    </span>
                    <span className="font-display text-xl">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function HouseSessionsManager({
  events,
  venues,
  onChanged,
}: {
  events: EventRow[];
  venues: VenueRow[];
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const sessions = events
    .filter((event) => event.experience_type === "house_session")
    .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());

  async function closeSession(session: EventRow) {
    if (!window.confirm("Encerrar agora o check-in e a Resenha desta Sessão da Casa?")) return;
    setWorkingId(session.id);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("events")
      .update({
        status: "ended",
        ends_at: nowIso,
        checkin_closes_at: nowIso,
        chat_closes_at: nowIso,
        checkin_enabled: false,
        chat_enabled: false,
      })
      .eq("id", session.id);
    setWorkingId(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Sessão da Casa encerrada.");
    onChanged();
  }

  return (
    <SectionLayout
      eyebrow="Operação interna"
      title="Sessão da Casa"
      description="Abra o check-in e a Resenha sem publicar um evento para os clientes. A sessão começa e termina nos horários definidos."
      action={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova sessão
        </Button>
      }
    >
      <div className="rounded-2xl border-2 border-primary/15 bg-primary/5 p-4 text-sm">
        <p className="font-black">Como funciona</p>
        <p className="mt-1 text-muted-foreground">
          A Sessão da Casa é invisível na Agenda. Ela existe apenas para controlar presença,
          Resenha, moderação e histórico operacional.
        </p>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {sessions.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyMessage>Nenhuma Sessão da Casa criada.</EmptyMessage>
          </div>
        ) : (
          sessions.map((session) => {
            const busy = workingId === session.id;
            const status = effectiveEventStatus(session, Date.now());
            return (
              <article key={session.id} className="card-festa p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="section-kicker text-muted-foreground">Uso interno</p>
                    <h3 className="mt-1 font-display text-2xl leading-none">{session.name}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {formatDateTime(session.starts_at)} até{" "}
                      {formatDateTime(session.ends_at ?? session.starts_at)}
                    </p>
                  </div>
                  <StatusPill status={status} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-primary/10 px-3 py-1.5 text-primary">
                    Check-in {session.checkin_enabled ? "ativo" : "desativado"}
                  </span>
                  <span className="rounded-full bg-samba/15 px-3 py-1.5 text-samba">
                    Resenha {session.chat_enabled ? "ativa" : "desativada"}
                  </span>
                  <span className="rounded-full bg-muted px-3 py-1.5">Oculta do público</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(session);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" /> Editar
                  </Button>
                  {!["ended", "cancelled"].includes(status) && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void closeSession(session)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TimerOff className="h-4 w-4" />
                      )}
                      Encerrar agora
                    </Button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      <HouseSessionDialog
        open={dialogOpen}
        session={editing}
        venues={venues}
        onOpenChange={setDialogOpen}
        onSaved={onChanged}
      />
    </SectionLayout>
  );
}

function HouseSessionDialog({
  open,
  session,
  venues,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  session: EventRow | null;
  venues: VenueRow[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const startsAt = toIso(textValue(form, "starts_at"));
    const endsAt = toIso(textValue(form, "ends_at"));
    const checkinOpensAt = toIso(textValue(form, "checkin_opens_at"));
    const checkinClosesAt = toIso(textValue(form, "checkin_closes_at"));
    const chatOpensAt = toIso(textValue(form, "chat_opens_at"));
    const chatClosesAt = toIso(textValue(form, "chat_closes_at"));
    if (new Date(endsAt) <= new Date(startsAt)) {
      return toast.error("O encerramento precisa ser depois da abertura.");
    }
    if (new Date(checkinClosesAt) <= new Date(checkinOpensAt)) {
      return toast.error("O encerramento do check-in precisa ser depois da abertura.");
    }
    if (new Date(chatClosesAt) <= new Date(chatOpensAt)) {
      return toast.error("O encerramento da Resenha precisa ser depois da abertura.");
    }
    if (
      new Date(checkinOpensAt) < new Date(startsAt) ||
      new Date(checkinClosesAt) > new Date(endsAt) ||
      new Date(chatOpensAt) < new Date(startsAt) ||
      new Date(chatClosesAt) > new Date(endsAt)
    ) {
      return toast.error(
        "Os horários de check-in e Resenha precisam ficar dentro da abertura e do encerramento da casa.",
      );
    }

    const venueId = nullableText(form, "venue_id");
    const venue = venues.find((item) => item.id === venueId) ?? null;
    const latitude = venue?.latitude ?? session?.venue_latitude ?? null;
    const longitude = venue?.longitude ?? session?.venue_longitude ?? null;
    if (latitude === null || longitude === null) {
      return toast.error(
        "Selecione um local com latitude e longitude configuradas antes de abrir a Sessão da Casa.",
      );
    }
    const name =
      nullableText(form, "name") ??
      `Sessão da Casa · ${new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }).format(new Date(startsAt))}`;

    const payload: EventInsert = {
      name,
      slug: session?.slug ?? `sessao-da-casa-${Date.now()}`,
      category: "Sessão da Casa",
      description: "Sessão operacional interna para check-in e Resenha.",
      starts_at: startsAt,
      ends_at: endsAt,
      checkin_opens_at: checkinOpensAt,
      checkin_closes_at: checkinClosesAt,
      chat_opens_at: chatOpensAt,
      chat_closes_at: chatClosesAt,
      checkin_enabled: form.get("checkin_enabled") === "on",
      chat_enabled: form.get("chat_enabled") === "on",
      geolocation_checkin_enabled: true,
      geofence_radius_m: numberValue(
        form,
        "geofence_radius_m",
        venue?.default_geofence_radius_m ?? 180,
      ),
      max_location_accuracy_m: numberValue(
        form,
        "max_location_accuracy_m",
        venue?.default_max_accuracy_m ?? 250,
      ),
      venue_id: venue?.id ?? null,
      venue_name: venue?.name ?? "Bafafá Bar",
      venue_address: venue?.address ?? "Praça Dr. Amaro de Souza · Lagoa Nova",
      venue_latitude: latitude,
      venue_longitude: longitude,
      venue_google_place_id: venue?.google_place_id ?? null,
      experience_type: "house_session",
      public_visible: false,
      status: "published",
    };

    setSaving(true);
    const result = session
      ? await supabase.from("events").update(payload).eq("id", session.id)
      : await supabase.from("events").insert(payload);
    setSaving(false);
    if (result.error) return toast.error(publicErrorMessage(result.error));
    toast.success(session ? "Sessão da Casa atualizada." : "Sessão da Casa criada.");
    onOpenChange(false);
    onSaved();
  }

  const baseStart = session?.starts_at ?? new Date().toISOString();
  const baseEnd =
    session?.ends_at ?? new Date(new Date(baseStart).getTime() + 8 * 60 * 60 * 1000).toISOString();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {session ? "Editar Sessão da Casa" : "Nova Sessão da Casa"}
          </DialogTitle>
          <DialogDescription>
            Defina quando a presença e a Resenha ficam disponíveis. Nada aparece como evento para o
            cliente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nome interno, opcional"
              name="name"
              defaultValue={session?.name}
              placeholder="Sessão da Casa · Sexta"
            />
            <div className="space-y-2">
              <Label htmlFor="house-venue">Local</Label>
              <select
                id="house-venue"
                name="venue_id"
                defaultValue={session?.venue_id ?? venues.find((item) => item.is_active)?.id ?? ""}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Local padrão do Bafafá</option>
                {venues
                  .filter((venue) => venue.is_active)
                  .map((venue) => (
                    <option key={venue.id} value={venue.id}>
                      {venue.name}
                    </option>
                  ))}
              </select>
            </div>
            <Field
              label="Abertura da casa"
              name="starts_at"
              type="datetime-local"
              defaultValue={toLocalInput(baseStart)}
              required
            />
            <Field
              label="Encerramento da casa"
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(baseEnd)}
              required
            />
            <Field
              label="Check-in abre"
              name="checkin_opens_at"
              type="datetime-local"
              defaultValue={toLocalInput(session?.checkin_opens_at ?? baseStart)}
              required
            />
            <Field
              label="Check-in fecha"
              name="checkin_closes_at"
              type="datetime-local"
              defaultValue={toLocalInput(session?.checkin_closes_at ?? baseEnd)}
              required
            />
            <Field
              label="Resenha abre"
              name="chat_opens_at"
              type="datetime-local"
              defaultValue={toLocalInput(session?.chat_opens_at ?? baseStart)}
              required
            />
            <Field
              label="Resenha fecha"
              name="chat_closes_at"
              type="datetime-local"
              defaultValue={toLocalInput(session?.chat_closes_at ?? baseEnd)}
              required
            />
            <Field
              label="Raio permitido, em metros"
              name="geofence_radius_m"
              type="number"
              min="30"
              max="1500"
              defaultValue={session?.geofence_radius_m ?? 180}
              required
            />
            <Field
              label="Precisão máxima, em metros"
              name="max_location_accuracy_m"
              type="number"
              min="20"
              max="1000"
              defaultValue={session?.max_location_accuracy_m ?? 250}
              required
            />
          </div>
          <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">Check-in ativo</p>
              <p className="text-xs text-muted-foreground">
                Permite confirmar presença no período.
              </p>
            </div>
            <Switch name="checkin_enabled" defaultChecked={session?.checkin_enabled ?? true} />
          </label>
          <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">Resenha ativa</p>
              <p className="text-xs text-muted-foreground">
                A conversa só abre para quem fez check-in.
              </p>
            </div>
            <Switch name="chat_enabled" defaultChecked={session?.chat_enabled ?? true} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar sessão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventsManager({
  events,
  venues,
  onChanged,
}: {
  events: EventRow[];
  venues: VenueRow[];
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [previewing, setPreviewing] = useState<EventRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const publicEvents = events.filter(
    (event) => event.experience_type !== "house_session" && event.public_visible !== false,
  );

  const filtered = publicEvents.filter((event) => {
    const matchesSearch = `${event.name} ${event.category} ${event.attraction ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const automaticStatus = effectiveEventStatus(event, now);
    return matchesSearch && (statusFilter === "all" || automaticStatus === statusFilter);
  });

  async function updateStatus(event: EventRow, status: string) {
    setWorkingId(event.id);
    const nowIso = new Date().toISOString();
    const payload: EventUpdate = {
      status,
      ...(status === "ended"
        ? {
            ends_at: nowIso,
            checkin_closes_at: event.checkin_closes_at ?? nowIso,
            chat_closes_at: event.chat_closes_at ?? nowIso,
          }
        : {}),
    };
    const { error } = await supabase.from("events").update(payload).eq("id", event.id);
    setWorkingId(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(
      status === "published"
        ? "Evento publicado."
        : status === "ongoing"
          ? "Evento marcado como rolando."
          : "Status atualizado.",
    );
    onChanged();
  }

  async function duplicate(event: EventRow) {
    setWorkingId(event.id);
    const { data, error } = await supabase.rpc("duplicate_event_with_campaigns", {
      _event_id: event.id,
    });
    setWorkingId(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Cópia criada como rascunho, com campanhas pausadas.");
    onChanged();
    if (data) {
      const duplicatedId = String(data);
      window.setTimeout(() => {
        const duplicated = events.find((item) => item.id === duplicatedId);
        if (duplicated) {
          setEditing(duplicated);
          setDialogOpen(true);
        }
      }, 0);
    }
  }

  async function closeCheckin(event: EventRow) {
    if (!window.confirm(`Encerrar o check-in de “${event.name}” agora?`)) return;
    setWorkingId(event.id);
    const { error } = await supabase.rpc("close_event_checkin", { _event_id: event.id });
    setWorkingId(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Check-in encerrado agora.");
    onChanged();
  }

  async function remove(event: EventRow) {
    if (!window.confirm(`Remover o evento “${event.name}” da agenda?`)) return;
    const [checkins, campaigns] = await Promise.all([
      supabase
        .from("checkins")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
      supabase
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event.id),
    ]);
    if (checkins.error || campaigns.error) {
      return toast.error(
        checkins.error?.message ??
          campaigns.error?.message ??
          "Não foi possível verificar o evento.",
      );
    }
    if ((checkins.count ?? 0) > 0 || (campaigns.count ?? 0) > 0) {
      const { error } = await supabase
        .from("events")
        .update({ status: "cancelled", checkin_enabled: false, chat_enabled: false })
        .eq("id", event.id);
      if (error) return toast.error(publicErrorMessage(error));
      toast.success("Evento cancelado para preservar o histórico.");
    } else {
      const { error } = await supabase.from("events").delete().eq("id", event.id);
      if (error) return toast.error(publicErrorMessage(error));
      toast.success("Evento excluído.");
    }
    onChanged();
  }

  return (
    <SectionLayout
      eyebrow="Agenda do bar"
      title="Eventos"
      description="Trabalhe em rascunho, pré-visualize, publique e controle a operação sem apagar o histórico."
      action={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Novo evento
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[1fr_220px]">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar evento ou atração" />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os status</option>
          <option value="draft">Rascunhos</option>
          <option value="scheduled">Agendados</option>
          <option value="ongoing">Rolando agora</option>
          <option value="ended">Encerrados</option>
          <option value="cancelled">Cancelados</option>
        </select>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {filtered.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyMessage>Nenhum evento encontrado.</EmptyMessage>
          </div>
        ) : (
          filtered.map((event) => {
            const busy = workingId === event.id;
            const checkinClosed = Boolean(
              event.checkin_closes_at && new Date(event.checkin_closes_at).getTime() <= Date.now(),
            );
            return (
              <article key={event.id} className="card-festa overflow-hidden">
                {event.image_url ? (
                  <img src={event.image_url} alt="" className="aspect-[16/7] w-full object-cover" />
                ) : (
                  <div className="grid-texture h-20 bg-electric" />
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        {event.category}
                      </p>
                      <h3 className="mt-1 font-display text-2xl leading-tight">{event.name}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {formatDateTime(event.starts_at)}
                        {event.attraction ? ` · ${event.attraction}` : ""}
                      </p>
                    </div>
                    <StatusPill status={effectiveEventStatus(event, now)} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span
                      className={`rounded-full px-3 py-1.5 ${event.checkin_enabled && !checkinClosed ? "bg-primary/15 text-primary" : "bg-muted"}`}
                    >
                      Check-in{" "}
                      {event.checkin_enabled
                        ? checkinClosed
                          ? "encerrado"
                          : "ativo"
                        : "desativado"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1.5 ${event.chat_enabled ? "bg-samba text-white" : "bg-muted"}`}
                    >
                      Resenha {event.chat_enabled ? "ativa" : "desativada"}
                    </span>
                    {event.checkin_opens_at && (
                      <span className="rounded-full bg-muted px-3 py-1.5">
                        Abre {formatDateTime(event.checkin_opens_at)}
                      </span>
                    )}
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewing(event)}>
                      <Eye className="h-4 w-4" /> Prévia
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(event);
                        setDialogOpen(true);
                      }}
                    >
                      <Edit3 className="h-4 w-4" /> Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void duplicate(event)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}{" "}
                      Duplicar
                    </Button>
                    {event.status === "draft" && (
                      <Button
                        size="sm"
                        disabled={busy}
                        onClick={() => void updateStatus(event, "published")}
                      >
                        <Play className="h-4 w-4" /> Publicar
                      </Button>
                    )}
                    {!["draft", "cancelled"].includes(effectiveEventStatus(event, now)) && (
                      <span className="inline-flex items-center rounded-md bg-primary/10 px-3 py-2 text-xs font-bold text-primary">
                        Status automático pela data
                      </span>
                    )}
                    {effectiveEventStatus(event, now) === "ongoing" && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => void updateStatus(event, "ended")}
                      >
                        <TimerOff className="h-4 w-4" /> Encerrar agora
                      </Button>
                    )}
                    {event.checkin_enabled &&
                      !checkinClosed &&
                      !["ended", "cancelled"].includes(effectiveEventStatus(event, now)) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => void closeCheckin(event)}
                        >
                          <TimerOff className="h-4 w-4 text-brick" /> Fechar check-in
                        </Button>
                      )}
                    <Button variant="ghost" size="sm" onClick={() => void remove(event)}>
                      <Trash2 className="h-4 w-4 text-destructive" /> Excluir
                    </Button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
      <EventDialog
        open={dialogOpen}
        event={editing}
        venues={venues}
        onOpenChange={setDialogOpen}
        onSaved={onChanged}
      />
      <EventPreviewDialog
        event={previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />
    </SectionLayout>
  );
}

function EventDialog({
  open,
  event,
  venues,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  event: EventRow | null;
  venues: VenueRow[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [imageSelection, setImageSelection] = useState<File | null | undefined>(undefined);
  const [localVenues, setLocalVenues] = useState<VenueRow[]>(venues);
  const [selectedVenueId, setSelectedVenueId] = useState(event?.venue_id ?? "");
  const [venueName, setVenueName] = useState(event?.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(event?.venue_address ?? "");
  const [venuePlaceId, setVenuePlaceId] = useState(event?.venue_google_place_id ?? "");
  const [venueLatitude, setVenueLatitude] = useState(
    event?.venue_latitude === null || event?.venue_latitude === undefined
      ? ""
      : String(event.venue_latitude),
  );
  const [venueLongitude, setVenueLongitude] = useState(
    event?.venue_longitude === null || event?.venue_longitude === undefined
      ? ""
      : String(event.venue_longitude),
  );
  const [geofenceRadius, setGeofenceRadius] = useState(String(event?.geofence_radius_m ?? 80));
  const [maxAccuracy, setMaxAccuracy] = useState(String(event?.max_location_accuracy_m ?? 250));
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);

  useEffect(() => {
    setLocalVenues(venues);
  }, [venues]);

  useEffect(() => {
    if (!open) return;
    setImageSelection(undefined);
    setSelectedVenueId(event?.venue_id ?? "");
    setVenueName(event?.venue_name ?? "");
    setVenueAddress(event?.venue_address ?? "");
    setVenuePlaceId(event?.venue_google_place_id ?? "");
    setVenueLatitude(
      event?.venue_latitude === null || event?.venue_latitude === undefined
        ? ""
        : String(event.venue_latitude),
    );
    setVenueLongitude(
      event?.venue_longitude === null || event?.venue_longitude === undefined
        ? ""
        : String(event.venue_longitude),
    );
    setGeofenceRadius(String(event?.geofence_radius_m ?? 80));
    setMaxAccuracy(String(event?.max_location_accuracy_m ?? 250));
  }, [open, event]);

  function applyVenue(venue: VenueRow | null) {
    setSelectedVenueId(venue?.id ?? "");
    setVenueName(venue?.name ?? "");
    setVenueAddress(venue?.address ?? "");
    setVenuePlaceId(venue?.google_place_id ?? "");
    setVenueLatitude(venue ? String(venue.latitude) : "");
    setVenueLongitude(venue ? String(venue.longitude) : "");
    setGeofenceRadius(String(venue?.default_geofence_radius_m ?? 80));
    setMaxAccuracy(String(venue?.default_max_accuracy_m ?? 250));
  }

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const name = textValue(form, "name");
    const startsAt = textValue(form, "starts_at");
    const endsAt = nullableIso(form, "ends_at");
    const checkinOpensAt = nullableIso(form, "checkin_opens_at");
    const checkinClosesAt = nullableIso(form, "checkin_closes_at");
    const chatOpensAt = nullableIso(form, "chat_opens_at");
    const chatClosesAt = nullableIso(form, "chat_closes_at");
    const geoEnabled = form.get("geolocation_checkin_enabled") === "on";
    const parsedVenueLatitude = venueLatitude.trim() ? Number(venueLatitude) : null;
    const parsedVenueLongitude = venueLongitude.trim() ? Number(venueLongitude) : null;

    if (endsAt && new Date(endsAt) <= new Date(toIso(startsAt)))
      return toast.error("O fim do evento precisa ser depois do início.");
    if (checkinOpensAt && checkinClosesAt && new Date(checkinClosesAt) <= new Date(checkinOpensAt))
      return toast.error("O encerramento do check-in precisa ser depois da abertura.");
    if (chatOpensAt && chatClosesAt && new Date(chatClosesAt) <= new Date(chatOpensAt))
      return toast.error("O encerramento da Resenha precisa ser depois da abertura.");
    if (
      geoEnabled &&
      (parsedVenueLatitude === null ||
        parsedVenueLongitude === null ||
        !Number.isFinite(parsedVenueLatitude) ||
        !Number.isFinite(parsedVenueLongitude))
    )
      return toast.error("Escolha um local válido para ativar o check-in por localização.");

    setSaving(true);
    const slug = textValue(form, "slug") || slugify(name);
    const previousImageUrl = event?.image_url ?? null;
    let imageUrl = previousImageUrl;
    let uploadedImageUrl: string | null = null;

    try {
      if (imageSelection instanceof File) {
        const uploaded = await uploadPublicImage({
          bucket: "event-images",
          folder: "events",
          file: imageSelection,
        });
        imageUrl = uploaded.url;
        uploadedImageUrl = uploaded.url;
      } else if (imageSelection === null) imageUrl = null;

      const payload: EventInsert = {
        name,
        slug,
        category: textValue(form, "category"),
        description: nullableText(form, "description"),
        attraction: nullableText(form, "attraction"),
        image_url: imageUrl,
        starts_at: toIso(startsAt),
        ends_at: endsAt,
        checkin_opens_at: checkinOpensAt,
        checkin_closes_at: checkinClosesAt,
        checkin_enabled: form.get("checkin_enabled") === "on",
        geolocation_checkin_enabled: geoEnabled,
        venue_id: selectedVenueId || null,
        venue_name: venueName.trim() || null,
        venue_address: venueAddress.trim() || null,
        venue_google_place_id: venuePlaceId.trim() || null,
        venue_latitude: parsedVenueLatitude,
        venue_longitude: parsedVenueLongitude,
        geofence_radius_m: Math.max(Number(geofenceRadius) || 80, 20),
        max_location_accuracy_m: Math.max(Number(maxAccuracy) || 250, 20),
        chat_opens_at: chatOpensAt,
        chat_closes_at: chatClosesAt,
        chat_enabled: form.get("chat_enabled") === "on",
        status: textValue(form, "status"),
        instructions: nullableText(form, "instructions"),
      };
      const result = event
        ? await supabase.from("events").update(payload).eq("id", event.id)
        : await supabase.from("events").insert(payload);
      if (result.error) {
        if (uploadedImageUrl) await removePublicImage("event-images", uploadedImageUrl);
        throw result.error;
      }
      if (previousImageUrl && previousImageUrl !== imageUrl)
        await removePublicImage("event-images", previousImageUrl);
      toast.success(
        event
          ? "Evento atualizado."
          : payload.status === "draft"
            ? "Rascunho criado."
            : "Evento criado.",
      );
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(publicErrorMessage(error, "Não foi possível salvar o evento."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {event ? "Editar evento" : "Novo evento"}
          </DialogTitle>
          <DialogDescription>
            Salve como rascunho para revisar antes de aparecer para os clientes.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <ImageUploadField
            key={`${event?.id ?? "new"}-${open ? "open" : "closed"}`}
            id="event-image"
            label="Imagem do evento"
            currentUrl={event?.image_url}
            onChange={setImageSelection}
            description="Escolha uma foto horizontal do computador ou celular."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do evento" name="name" defaultValue={event?.name} required />
            <Field
              label="Slug"
              name="slug"
              defaultValue={event?.slug}
              placeholder="gerado-automaticamente"
            />
            <Field
              label="Categoria"
              name="category"
              defaultValue={event?.category ?? "Pagode"}
              required
            />
            <Field label="Atração" name="attraction" defaultValue={event?.attraction} />
            <Field
              label="Início"
              name="starts_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.starts_at)}
              required
            />
            <Field
              label="Fim"
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.ends_at)}
            />
            <Field
              label="Abertura do check-in"
              name="checkin_opens_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.checkin_opens_at)}
            />
            <Field
              label="Encerramento do check-in"
              name="checkin_closes_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.checkin_closes_at)}
            />
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="event-venue">Local do evento</Label>
                  <select
                    id="event-venue"
                    value={selectedVenueId}
                    onChange={(inputEvent) => {
                      const id = inputEvent.target.value;
                      applyVenue(localVenues.find((venue) => venue.id === id) ?? null);
                    }}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Local ainda não cadastrado</option>
                    {localVenues
                      .filter((venue) => venue.is_active)
                      .map((venue) => (
                        <option key={venue.id} value={venue.id}>
                          {venue.name} — {venue.address}
                        </option>
                      ))}
                  </select>
                </div>
                <Button type="button" variant="outline" onClick={() => setVenueDialogOpen(true)}>
                  <Plus className="h-4 w-4" /> Novo local
                </Button>
              </div>
              {venueName && (
                <div className="rounded-2xl border-2 border-primary/15 bg-primary/5 p-4">
                  <p className="font-bold">{venueName}</p>
                  {venueAddress && (
                    <p className="mt-1 text-sm text-muted-foreground">{venueAddress}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
                    <span>Raio: {geofenceRadius} m</span>
                    <span>•</span>
                    <span>Precisão: até {maxAccuracy} m</span>
                    {venueLatitude && venueLongitude && (
                      <>
                        <span>•</span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${venueLatitude},${venueLongitude}`)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary underline underline-offset-2"
                        >
                          Ver no Google Maps
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <details className="rounded-2xl border border-input bg-muted/40 p-4 sm:col-span-2">
              <summary className="cursor-pointer font-bold">
                Ajustes avançados da geolocalização
              </summary>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="venue-latitude">Latitude</Label>
                  <Input
                    id="venue-latitude"
                    type="number"
                    step="0.000001"
                    min="-90"
                    max="90"
                    value={venueLatitude}
                    onChange={(inputEvent) => {
                      setVenueLatitude(inputEvent.target.value);
                      setSelectedVenueId("");
                    }}
                    placeholder="Ex.: -5.812345"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="venue-longitude">Longitude</Label>
                  <Input
                    id="venue-longitude"
                    type="number"
                    step="0.000001"
                    min="-180"
                    max="180"
                    value={venueLongitude}
                    onChange={(inputEvent) => {
                      setVenueLongitude(inputEvent.target.value);
                      setSelectedVenueId("");
                    }}
                    placeholder="Ex.: -35.205678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="geofence-radius">Raio permitido (metros)</Label>
                  <Input
                    id="geofence-radius"
                    type="number"
                    min="20"
                    max="500"
                    value={geofenceRadius}
                    onChange={(inputEvent) => setGeofenceRadius(inputEvent.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="max-location-accuracy">Precisão máxima do GPS (metros)</Label>
                  <Input
                    id="max-location-accuracy"
                    type="number"
                    min="20"
                    max="500"
                    value={maxAccuracy}
                    onChange={(inputEvent) => setMaxAccuracy(inputEvent.target.value)}
                  />
                </div>
              </div>
            </details>
            <Field
              label="Abertura da Resenha"
              name="chat_opens_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.chat_opens_at)}
            />
            <Field
              label="Encerramento da Resenha"
              name="chat_closes_at"
              type="datetime-local"
              defaultValue={toLocalInput(event?.chat_closes_at)}
            />
            <div className="space-y-2">
              <Label htmlFor="event-status">Status</Label>
              <select
                id="event-status"
                name="status"
                defaultValue={
                  event && ["scheduled", "published", "ongoing", "ended"].includes(event.status)
                    ? "published"
                    : (event?.status ?? "draft")
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="draft">Rascunho</option>
                <option value="published">Publicado — status muda automaticamente pela data</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
          <TextField label="Descrição" name="description" defaultValue={event?.description} />
          <TextField label="Instruções" name="instructions" defaultValue={event?.instructions} />
          <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">Check-in habilitado</p>
              <p className="text-xs text-muted-foreground">
                Permite gerar e validar código neste evento.
              </p>
            </div>
            <Switch name="checkin_enabled" defaultChecked={event?.checkin_enabled ?? true} />
          </label>
          <label className="flex items-center justify-between rounded-2xl border-2 border-primary/20 bg-primary/10 p-4">
            <div className="pr-4">
              <p className="font-bold">Check-in rápido por localização</p>
              <p className="text-xs text-muted-foreground">
                Usa o GPS uma única vez. QR continua como alternativa e para validar benefícios.
              </p>
            </div>
            <Switch
              name="geolocation_checkin_enabled"
              defaultChecked={event?.geolocation_checkin_enabled ?? false}
            />
          </label>
          <label className="flex items-center justify-between rounded-2xl border-2 border-samba/25 bg-samba/10 p-4">
            <div className="pr-4">
              <p className="flex items-center gap-2 font-bold">
                <MessageCircleMore className="h-4 w-4 text-samba" /> Resenha do evento
              </p>
              <p className="text-xs text-muted-foreground">Só participa quem fez check-in.</p>
            </div>
            <Switch name="chat_enabled" defaultChecked={event?.chat_enabled ?? false} />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar evento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <VenueDialog
        open={venueDialogOpen}
        onOpenChange={setVenueDialogOpen}
        onCreated={(venue) => {
          setLocalVenues((current) => [...current.filter((item) => item.id !== venue.id), venue]);
          applyVenue(venue);
          setVenueDialogOpen(false);
        }}
      />
    </Dialog>
  );
}

function VenueDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (venue: VenueRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("80");
  const [accuracy, setAccuracy] = useState("250");

  useEffect(() => {
    if (!open) return;
    setName("");
    setAddress("");
    setPlaceId("");
    setLatitude("");
    setLongitude("");
    setRadius("80");
    setAccuracy("250");
  }, [open]);

  async function submitVenue(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);
    if (!name.trim() || !address.trim())
      return toast.error("Informe o nome e o endereço do local.");
    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude))
      return toast.error("Escolha um local válido no Google Maps ou use a localização atual.");

    setSaving(true);
    const payload: VenueInsert = {
      name: name.trim(),
      address: address.trim(),
      google_place_id: placeId.trim() || null,
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      default_geofence_radius_m: Math.max(Number(radius) || 80, 20),
      default_max_accuracy_m: Math.max(Number(accuracy) || 250, 20),
      is_active: true,
    };
    const result = await supabase.from("venues").insert(payload).select("*").single();
    setSaving(false);
    if (result.error || !result.data) {
      if (import.meta.env.DEV) console.error("venue_insert_failed", result.error);
      return toast.error(publicErrorMessage(result.error, "Não foi possível salvar o local."));
    }
    toast.success("Local cadastrado. Nos próximos eventos, basta selecioná-lo.");
    onCreated(result.data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Cadastrar local</DialogTitle>
          <DialogDescription>
            Cadastre uma vez e reutilize em todos os eventos. A busca do Google Maps preenche as
            coordenadas automaticamente.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submitVenue} className="space-y-4">
          <GoogleVenueSearch
            onSelected={(place) => {
              setName(place.name);
              setAddress(place.address);
              setPlaceId(place.placeId ?? "");
              setLatitude(String(place.latitude));
              setLongitude(String(place.longitude));
            }}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="venue-name">Nome do local</Label>
              <Input
                id="venue-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="venue-address">Endereço</Label>
              <Input
                id="venue-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Praça Dr. Amaro de Souza, Lagoa Nova, Natal/RN"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-latitude">Latitude</Label>
              <Input
                id="new-venue-latitude"
                type="number"
                step="0.000001"
                min="-90"
                max="90"
                value={latitude}
                onChange={(event) => setLatitude(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-longitude">Longitude</Label>
              <Input
                id="new-venue-longitude"
                type="number"
                step="0.000001"
                min="-180"
                max="180"
                value={longitude}
                onChange={(event) => setLongitude(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-radius">Raio padrão (metros)</Label>
              <Input
                id="new-venue-radius"
                type="number"
                min="20"
                max="500"
                value={radius}
                onChange={(event) => setRadius(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-venue-accuracy">Precisão máxima (metros)</Label>
              <Input
                id="new-venue-accuracy"
                type="number"
                min="20"
                max="500"
                value={accuracy}
                onChange={(event) => setAccuracy(event.target.value)}
              />
            </div>
          </div>
          {latitude && longitude && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-bold text-primary underline underline-offset-4"
            >
              Conferir ponto no Google Maps
            </a>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar local"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EventPreviewDialog({
  event,
  onOpenChange,
}: {
  event: EventRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(event)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden rounded-[30px] border-[3px] border-foreground p-0">
        {event && (
          <>
            {event.image_url ? (
              <img src={event.image_url} alt="" className="aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="grid-texture h-40 bg-electric" />
            )}
            <div className="p-6">
              <span className="cut-label bg-mango">{event.category}</span>
              <h2 className="mt-5 font-display text-4xl leading-none">{event.name}</h2>
              {event.attraction && (
                <p className="mt-2 font-black text-primary">{event.attraction}</p>
              )}
              <p className="mt-3 text-sm font-semibold text-muted-foreground">
                {formatDateTime(event.starts_at)}
              </p>
              {event.description && (
                <p className="mt-4 text-sm leading-relaxed">{event.description}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
                <span className="rounded-full bg-muted px-3 py-1.5">
                  Check-in {event.checkin_enabled ? "sim" : "não"}
                </span>
                <span className="rounded-full bg-muted px-3 py-1.5">
                  Resenha {event.chat_enabled ? "sim" : "não"}
                </span>
              </div>
              <Button className="mt-6 w-full" onClick={() => onOpenChange(false)}>
                Fechar prévia
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CampaignsManager({
  campaigns,
  campaignLinkClicks,
  events,
  rewards,
  redemptions,
  profiles,
  onChanged,
}: {
  campaigns: CampaignRow[];
  campaignLinkClicks: CampaignLinkClickRow[];
  feedPosts: FeedPostRow[];
  events: EventRow[];
  rewards: RewardRow[];
  redemptions: RedemptionRow[];
  profiles: ProfileRow[];
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignRow | null>(null);
  const [previewing, setPreviewing] = useState<CampaignRow | null>(null);
  const [organizerOpen, setOrganizerOpen] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const eventById = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);
  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const rewardById = useMemo(
    () => new Map(rewards.map((reward) => [reward.id, reward])),
    [rewards],
  );
  const redeemedRewardIds = useMemo(
    () => new Set(redemptions.map((item) => item.reward_id)),
    [redemptions],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  function metrics(campaignId: string) {
    const rows = rewards.filter((reward) => reward.campaign_id === campaignId);
    const redeemed = rows.filter(
      (reward) => reward.status === "redeemed" || redeemedRewardIds.has(reward.id),
    ).length;
    const expired = rows.filter(
      (reward) =>
        reward.status === "expired" ||
        (reward.status !== "redeemed" &&
          Boolean(reward.expires_at) &&
          new Date(reward.expires_at!).getTime() <= now),
    ).length;
    const available = rows.filter(
      (reward) =>
        reward.status === "available" &&
        !redeemedRewardIds.has(reward.id) &&
        (!reward.expires_at || new Date(reward.expires_at).getTime() > now),
    ).length;
    return { granted: rows.length, redeemed, expired, available };
  }

  async function setStatus(campaign: CampaignRow, status: string) {
    setWorkingId(campaign.id);
    const { error } = await supabase.from("campaigns").update({ status }).eq("id", campaign.id);
    setWorkingId(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(
      status === "paused"
        ? "Campanha pausada."
        : status === "active"
          ? "Campanha ativada."
          : "Campanha encerrada.",
    );
    onChanged();
  }

  async function remove(campaign: CampaignRow) {
    if (!window.confirm(`Remover a campanha “${campaign.name}”?`)) return;
    const count = rewards.filter((reward) => reward.campaign_id === campaign.id).length;
    if (count > 0) {
      await setStatus(campaign, "ended");
      return;
    }
    const { error } = await supabase.from("campaigns").delete().eq("id", campaign.id);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Campanha excluída.");
    onChanged();
  }

  const latestRedemptions = [...redemptions]
    .sort((a, b) => new Date(b.redeemed_at).getTime() - new Date(a.redeemed_at).getTime())
    .slice(0, 10);

  return (
    <SectionLayout
      eyebrow="Mimos e promoções"
      title="Campanhas"
      description="Crie o benefício, acompanhe o uso e pause a campanha sem apagar o histórico."
      action={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setOrganizerOpen(true)}>
            <ListOrdered className="h-4 w-4" /> Organizar o Início
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Nova campanha
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {campaigns.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyMessage>Nenhuma campanha criada.</EmptyMessage>
          </div>
        ) : (
          campaigns.map((campaign) => {
            const event = campaign.event_id ? eventById.get(campaign.event_id) : null;
            const counts = metrics(campaign.id);
            const externalClicks = campaignLinkClicks.filter(
              (click) => click.campaign_id === campaign.id,
            ).length;
            const remaining =
              campaign.total_available === null
                ? null
                : Math.max(0, campaign.total_available - counts.granted);
            const busy = workingId === campaign.id;
            const activeUntil = campaign.ends_at ? new Date(campaign.ends_at).getTime() : null;
            return (
              <article
                key={campaign.id}
                className="ticket-card checker-texture p-5 text-foreground"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-70">
                      {event?.name ?? "Sem evento"}
                    </p>
                    <h3 className="mt-1 font-display text-3xl leading-none">{campaign.name}</h3>
                  </div>
                  <StatusPill status={campaign.status} />
                </div>
                <p className="mt-4 font-poster text-xl">{campaignBenefitLabel(campaign)}</p>
                {campaign.description && (
                  <p className="mt-2 text-sm font-semibold opacity-70">{campaign.description}</p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricMini label="Liberados" value={counts.granted} />
                  <MetricMini label="Disponíveis" value={counts.available} />
                  <MetricMini label="Utilizados" value={counts.redeemed} />
                  <MetricMini label="Expirados" value={counts.expired} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                  <span className="rounded-full bg-white/75 px-3 py-1.5">
                    Validade: {formatRewardDuration(campaign.reward_valid_hours)}
                  </span>
                  <span className="rounded-full bg-white/75 px-3 py-1.5">
                    Por cliente: {campaign.per_user_limit}
                  </span>
                  <span className="rounded-full bg-white/75 px-3 py-1.5">
                    Início:{" "}
                    {campaign.home_visible
                      ? campaign.home_sort_order
                        ? `posição ${campaign.home_sort_order}`
                        : "ordem automática"
                      : "fora do Início"}
                  </span>
                  {campaign.redemption_mode !== "app" && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/75 px-3 py-1.5">
                        <ExternalLink className="h-3 w-3" /> Link externo
                      </span>
                      <span className="rounded-full bg-white/75 px-3 py-1.5">
                        Cliques: {externalClicks}
                      </span>
                    </>
                  )}
                  {remaining !== null && (
                    <span
                      className={`rounded-full px-3 py-1.5 ${remaining === 0 ? "bg-destructive text-white" : "bg-white/75"}`}
                    >
                      Restam: {remaining}
                    </span>
                  )}
                  {campaign.status === "active" && activeUntil && activeUntil > now && (
                    <span className="rounded-full bg-foreground px-3 py-1.5 text-background">
                      Termina em {formatDuration(activeUntil - now)}
                    </span>
                  )}
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewing(campaign)}>
                    <Eye className="h-4 w-4" /> Prévia
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(campaign);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" /> Editar
                  </Button>
                  {campaign.status === "active" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void setStatus(campaign, "paused")}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}{" "}
                      Pausar
                    </Button>
                  ) : campaign.status === "paused" ? (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void setStatus(campaign, "active")}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}{" "}
                      Ativar
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => void remove(campaign)}>
                    <Trash2 className="h-4 w-4 text-destructive" /> Excluir
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <section className="card-festa mt-6 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-muted-foreground">Operação</p>
            <h3 className="mt-1 font-display text-2xl">Últimos mimos utilizados</h3>
          </div>
          <Gift className="h-6 w-6 text-primary" />
        </div>
        <div className="mt-4 divide-y divide-border">
          {latestRedemptions.length === 0 ? (
            <EmptyMessage>Nenhum mimo utilizado ainda.</EmptyMessage>
          ) : (
            latestRedemptions.map((redemption) => {
              const reward = rewardById.get(redemption.reward_id);
              const campaign = reward
                ? campaigns.find((item) => item.id === reward.campaign_id)
                : null;
              return (
                <div
                  key={redemption.id}
                  className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:gap-4"
                >
                  <p className="font-black">
                    {profileById.get(redemption.user_id)?.display_name ?? "Bafafã"}
                  </p>
                  <p className="text-muted-foreground">{campaign?.name ?? "Campanha"}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(redemption.redeemed_at)}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      <CampaignHomeOrganizerDialog
        open={organizerOpen}
        campaigns={campaigns}
        onOpenChange={setOrganizerOpen}
        onChanged={onChanged}
      />
      <CampaignDialog
        open={dialogOpen}
        campaign={editing}
        events={events}
        onOpenChange={setDialogOpen}
        onSaved={onChanged}
      />
      <CampaignPreviewDialog
        campaign={previewing}
        event={previewing?.event_id ? (eventById.get(previewing.event_id) ?? null) : null}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />
    </SectionLayout>
  );
}

function CampaignHomeOrganizerDialog({
  open,
  campaigns,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  campaigns: CampaignRow[];
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const eligible = useMemo(
    () =>
      campaigns
        .filter((campaign) => ["global", "milestone"].includes(campaign.campaign_kind))
        .sort((a, b) => {
          const aManual = a.home_sort_order !== null;
          const bManual = b.home_sort_order !== null;
          if (aManual !== bManual) return aManual ? -1 : 1;
          if (aManual && bManual && a.home_sort_order !== b.home_sort_order) {
            return Number(a.home_sort_order) - Number(b.home_sort_order);
          }
          const kindOrder = { global: 0, milestone: 1 } as Record<string, number>;
          const kindDiff = (kindOrder[a.campaign_kind] ?? 9) - (kindOrder[b.campaign_kind] ?? 9);
          if (kindDiff !== 0) return kindDiff;
          return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
        }),
    [campaigns],
  );
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrderedIds(eligible.map((campaign) => campaign.id));
    setHiddenIds(
      new Set(eligible.filter((campaign) => !campaign.home_visible).map((campaign) => campaign.id)),
    );
  }, [eligible, open]);

  function move(id: string, direction: -1 | 1) {
    setOrderedIds((current) => {
      const index = current.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function moveTop(id: string) {
    setOrderedIds((current) => [id, ...current.filter((item) => item !== id)]);
  }

  function toggleHidden(id: string) {
    setHiddenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    let visiblePosition = 0;
    const results = await Promise.all(
      orderedIds.map((id) => {
        const hidden = hiddenIds.has(id);
        if (!hidden) visiblePosition += 1;
        return supabase
          .from("campaigns")
          .update({
            home_visible: !hidden,
            home_sort_order: hidden ? null : visiblePosition,
          })
          .eq("id", id);
      }),
    );
    setSaving(false);
    const firstError = results.map((result) => result.error).find(Boolean);
    if (firstError) return toast.error(publicErrorMessage(firstError));
    toast.success("Ordem do Início atualizada.");
    onOpenChange(false);
    onChanged();
  }

  async function restoreAutomaticOrder() {
    if (eligible.length === 0) return;
    if (!window.confirm("Voltar todas as Fofoquinhas para a ordem automática?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("campaigns")
      .update({ home_sort_order: null })
      .in(
        "id",
        eligible.map((campaign) => campaign.id),
      );
    setSaving(false);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Ordem automática restaurada.");
    onOpenChange(false);
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Organizar o Início</DialogTitle>
          <DialogDescription>
            Organize a ordem das Fofoquinhas no feed. Quando a casa estiver aberta, o check-in pode
            aparecer antes como ação prioritária.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {orderedIds.length === 0 ? (
            <EmptyMessage>Nenhuma Fofoquinha geral ou missão disponível.</EmptyMessage>
          ) : (
            orderedIds.map((id, index) => {
              const campaign = eligible.find((item) => item.id === id);
              if (!campaign) return null;
              const hidden = hiddenIds.has(id);
              return (
                <article
                  key={id}
                  className={`rounded-2xl border-2 p-4 ${
                    hidden
                      ? "border-foreground/10 bg-muted opacity-60"
                      : "border-foreground/20 bg-card"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-foreground bg-mango font-black">
                      {hidden ? "–" : index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="section-kicker text-muted-foreground">
                        {campaign.campaign_kind === "global" ? "Promoção geral" : "Missão"}
                      </p>
                      <h3 className="mt-1 font-black">{campaign.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {hidden ? "Oculta do Início" : campaignBenefitLabel(campaign)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === 0 || hidden}
                      onClick={() => move(id, -1)}
                    >
                      <ArrowUp className="h-4 w-4" /> Subir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === orderedIds.length - 1 || hidden}
                      onClick={() => move(id, 1)}
                    >
                      <ArrowDown className="h-4 w-4" /> Descer
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={index === 0 || hidden}
                      onClick={() => moveTop(id)}
                    >
                      <ListOrdered className="h-4 w-4" /> Topo das Fofoquinhas
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleHidden(id)}>
                      {hidden ? "Mostrar no Início" : "Retirar do Início"}
                    </Button>
                  </div>
                </article>
              );
            })
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => void restoreAutomaticOrder()}
          >
            Usar ordem automática
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={saving || orderedIds.length === 0}
              onClick={() => void save()}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar ordem
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CampaignDialog({
  open,
  campaign,
  events,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  campaign: CampaignRow | null;
  events: EventRow[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [benefitType, setBenefitType] = useState(campaign?.benefit_type ?? "percent_off");
  const [campaignKind, setCampaignKind] = useState(campaign?.campaign_kind ?? "global");
  const [triggerType, setTriggerType] = useState(campaign?.trigger_type ?? "none");
  const [redemptionMode, setRedemptionMode] = useState(campaign?.redemption_mode ?? "app");
  const [durationUnit, setDurationUnit] = useState<"minutes" | "hours">("hours");
  const [durationValue, setDurationValue] = useState("24");
  const selectableEvents = useMemo(
    () =>
      events.filter(
        (event) =>
          event.experience_type !== "house_session" &&
          event.public_visible !== false &&
          !["cancelled"].includes(event.status),
      ),
    [events],
  );

  useEffect(() => {
    if (!open) return;
    setBenefitType(campaign?.benefit_type ?? "percent_off");
    setCampaignKind(campaign?.campaign_kind ?? (campaign?.event_id ? "event" : "global"));
    setTriggerType(campaign?.trigger_type ?? (campaign?.event_id ? "event_checkin" : "none"));
    setRedemptionMode(campaign?.redemption_mode ?? "app");
    const storedHours = Number(campaign?.reward_valid_hours ?? 24);
    const useMinutes = storedHours < 1 || !Number.isInteger(storedHours);
    setDurationUnit(useMinutes ? "minutes" : "hours");
    setDurationValue(String(useMinutes ? Math.round(storedHours * 60) : storedHours));
  }, [open, campaign]);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const form = new FormData(formEvent.currentTarget);
    const startsAt = toIso(textValue(form, "starts_at"));
    const endsAt = nullableIso(form, "ends_at");
    if (endsAt && new Date(endsAt) <= new Date(startsAt))
      return toast.error("O fim da campanha precisa ser depois do início.");
    const totalAvailable = nullableNumber(form, "total_available");
    const perUser = numberValue(form, "per_user_limit", 1);
    const requiresCheckin = campaignKind !== "milestone" && form.get("requires_checkin") === "on";
    if (totalAvailable !== null && perUser > totalAvailable)
      return toast.error("O limite por cliente não pode ser maior que o limite total.");
    const externalUrl = nullableText(form, "external_url");
    if (redemptionMode !== "app" && !externalUrl)
      return toast.error("Informe o link do site onde a promoção será vendida.");
    if (externalUrl && !/^https?:\/\//i.test(externalUrl))
      return toast.error("O link externo precisa começar com http:// ou https://.");

    setSaving(true);
    const payload: CampaignInsert = {
      event_id: campaignKind === "event" ? nullableText(form, "event_id") : null,
      campaign_kind: campaignKind,
      trigger_type:
        campaignKind === "event"
          ? "event_checkin"
          : campaignKind === "global"
            ? "none"
            : triggerType,
      trigger_target: campaignKind === "milestone" ? numberValue(form, "trigger_target", 1) : 1,
      trigger_category:
        triggerType === "category_checkins" ? nullableText(form, "trigger_category") : null,
      feed_priority: campaign?.feed_priority ?? 0,
      home_sort_order: campaign?.home_sort_order ?? null,
      home_visible: campaignKind === "event" ? false : form.get("home_visible") === "on",
      feed_visible: campaignKind !== "event",
      is_pinned: campaign?.is_pinned ?? false,
      redemption_mode: redemptionMode,
      external_url: redemptionMode === "app" ? null : externalUrl,
      external_button_label:
        redemptionMode === "app"
          ? (campaign?.external_button_label ?? "Garantir minha promoção")
          : (nullableText(form, "external_button_label") ?? "Garantir minha promoção"),
      external_open_new_tab: form.get("external_open_new_tab") === "on",
      name: textValue(form, "name"),
      description: nullableText(form, "description"),
      benefit_type: textValue(form, "benefit_type"),
      discount_percent: nullableNumber(form, "discount_percent"),
      discount_max_cents: moneyToCents(form, "discount_max"),
      fixed_off_cents: moneyToCents(form, "fixed_off"),
      product_name: nullableText(form, "product_name"),
      instructions: nullableText(form, "instructions"),
      starts_at: startsAt,
      ends_at: endsAt,
      reward_valid_hours:
        durationUnit === "minutes"
          ? Math.max(Number(durationValue) || 1, 1) / 60
          : Math.max(Number(durationValue) || 1, 1),
      total_available: totalAvailable,
      per_user_limit: perUser,
      requires_checkin: campaignKind === "milestone" ? false : requiresCheckin,
      requires_min_profile: form.get("requires_min_profile") === "on",
      requires_staff_validation:
        campaignKind === "event"
          ? true
          : campaignKind === "global"
            ? requiresCheckin && form.get("requires_staff_validation") === "on"
            : triggerType === "profile_completion"
              ? false
              : form.get("requires_staff_validation") === "on",
      status: textValue(form, "status"),
      public_rules: nullableText(form, "public_rules"),
      internal_rules: nullableText(form, "internal_rules"),
    };
    const result = campaign
      ? await supabase.from("campaigns").update(payload).eq("id", campaign.id)
      : await supabase.from("campaigns").insert(payload);
    setSaving(false);
    if (result.error) {
      if (import.meta.env.DEV) console.error("campaign_save_failed", result.error, payload);
      return toast.error(
        publicErrorMessage(
          result.error,
          "Não foi possível salvar a campanha. Confira período, limites, benefício e regras.",
        ),
      );
    }
    toast.success(campaign ? "Campanha atualizada." : "Campanha criada.");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {campaign ? "Editar campanha" : "Nova campanha"}
          </DialogTitle>
          <DialogDescription>
            Crie uma Fofoquinha geral ou uma missão. Promoções de evento ficam guardadas, mas
            ocultas do aplicativo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-kind">Formato</Label>
              <select
                id="campaign-kind"
                name="campaign_kind"
                value={campaignKind}
                onChange={(event) => {
                  const value = event.target.value;
                  setCampaignKind(value);
                  setTriggerType(
                    value === "event"
                      ? "event_checkin"
                      : value === "milestone"
                        ? "distinct_checkins"
                        : "none",
                  );
                }}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="global">Promoção geral</option>
                <option value="milestone">Missão / marco do cliente</option>
                <option value="event">Promoção ligada a evento, oculta no app</option>
              </select>
            </div>
            {campaignKind === "event" && (
              <div className="space-y-2">
                <Label htmlFor="campaign-event">Evento</Label>
                <select
                  id="campaign-event"
                  name="event_id"
                  defaultValue={campaign?.event_id ?? selectableEvents[0]?.id ?? ""}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  required
                >
                  <option value="">Selecione</option>
                  {selectableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name} — {formatDateTime(event.starts_at)}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {campaignKind === "milestone" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="trigger-type">Regra da missão</Label>
                  <select
                    id="trigger-type"
                    name="trigger_type"
                    value={triggerType}
                    onChange={(event) => setTriggerType(event.target.value)}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="distinct_checkins">Presenças em dias diferentes</option>
                    <option value="total_checkins">Quantidade total de presenças</option>
                    <option value="profile_completion">Percentual do perfil</option>
                    <option value="category_checkins">Check-ins por categoria</option>
                  </select>
                </div>
                <Field
                  label={
                    triggerType === "profile_completion"
                      ? "Meta do perfil (%)"
                      : "Quantidade necessária"
                  }
                  name="trigger_target"
                  type="number"
                  min="1"
                  max={triggerType === "profile_completion" ? "100" : "1000"}
                  defaultValue={
                    campaign?.trigger_target ?? (triggerType === "profile_completion" ? 100 : 3)
                  }
                  required
                />
                {triggerType === "category_checkins" && (
                  <Field
                    label="Categoria interna da programação"
                    name="trigger_category"
                    defaultValue={campaign?.trigger_category}
                    placeholder="Feijoada"
                    required
                  />
                )}
              </>
            )}
            <Field label="Nome da campanha" name="name" defaultValue={campaign?.name} required />
            <Field
              label="Produto participante"
              name="product_name"
              defaultValue={campaign?.product_name}
            />
            <div className="space-y-2">
              <Label htmlFor="benefit-type">Tipo de mimo</Label>
              <select
                id="benefit-type"
                name="benefit_type"
                value={benefitType}
                onChange={(event) => setBenefitType(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="percent_off">Desconto percentual</option>
                <option value="fixed_off">Desconto em reais</option>
                <option value="freebie">Produto cortesia</option>
                <option value="bogo">Compre um e leve outro</option>
                <option value="custom">Benefício personalizado</option>
              </select>
            </div>
            {benefitType === "percent_off" && (
              <Field
                label="Desconto (%)"
                name="discount_percent"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={campaign?.discount_percent}
                required
              />
            )}
            {benefitType === "fixed_off" && (
              <Field
                label="Desconto (R$)"
                name="fixed_off"
                type="number"
                min="0"
                step="0.01"
                defaultValue={centsToMoney(campaign?.fixed_off_cents)}
                required
              />
            )}
            <Field
              label="Desconto máximo (R$)"
              name="discount_max"
              type="number"
              min="0"
              step="0.01"
              defaultValue={centsToMoney(campaign?.discount_max_cents)}
            />
            <div className="space-y-2">
              <Label htmlFor="reward-valid-value">Validade após liberar</Label>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input
                  id="reward-valid-value"
                  type="number"
                  min="1"
                  step="1"
                  value={durationValue}
                  onChange={(event) => setDurationValue(event.target.value)}
                  required
                />
                <select
                  aria-label="Unidade da validade"
                  value={durationUnit}
                  onChange={(event) => setDurationUnit(event.target.value as "minutes" | "hours")}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="minutes">minutos</option>
                  <option value="hours">horas</option>
                </select>
              </div>
            </div>
            <Field
              label="Limite total"
              name="total_available"
              type="number"
              min="1"
              defaultValue={campaign?.total_available}
              placeholder="Sem limite"
            />
            <Field
              label="Limite por cliente"
              name="per_user_limit"
              type="number"
              min="1"
              defaultValue={campaign?.per_user_limit ?? 1}
              required
            />
            <Field
              label="Início"
              name="starts_at"
              type="datetime-local"
              defaultValue={
                toLocalInput(campaign?.starts_at) || toLocalInput(new Date().toISOString())
              }
              required
            />
            <Field
              label="Fim"
              name="ends_at"
              type="datetime-local"
              defaultValue={toLocalInput(campaign?.ends_at)}
            />
            <div className="space-y-2">
              <Label htmlFor="campaign-status">Status</Label>
              <select
                id="campaign-status"
                name="status"
                defaultValue={campaign?.status ?? "active"}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="active">Ativa</option>
                <option value="paused">Pausada</option>
                <option value="ended">Encerrada</option>
              </select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="redemption-mode">Como o cliente usa esta Fofoquinha?</Label>
              <select
                id="redemption-mode"
                name="redemption_mode"
                value={redemptionMode}
                onChange={(event) => setRedemptionMode(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="app">Validar pelo aplicativo</option>
                <option value="external">Comprar em site externo</option>
                <option value="both">Oferecer as duas opções</option>
              </select>
            </div>
            {redemptionMode !== "app" && (
              <>
                <Field
                  label="Link do site externo"
                  name="external_url"
                  type="url"
                  defaultValue={campaign?.external_url}
                  placeholder="https://..."
                  required
                />
                <Field
                  label="Texto do botão"
                  name="external_button_label"
                  defaultValue={campaign?.external_button_label ?? "Garantir minha promoção"}
                  required
                />
              </>
            )}
          </div>
          <TextField label="Descrição" name="description" defaultValue={campaign?.description} />
          <TextField
            label="Regras para o cliente"
            name="public_rules"
            defaultValue={campaign?.public_rules}
          />
          <TextField
            label="Instruções para a equipe"
            name="instructions"
            defaultValue={campaign?.instructions}
          />
          <TextField
            label="Regras internas"
            name="internal_rules"
            defaultValue={campaign?.internal_rules}
          />

          <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">Mostrar no Início</p>
              <p className="text-xs text-muted-foreground">
                Exibe esta Fofoquinha no feed principal. A posição é definida em “Organizar o
                Início”.
              </p>
            </div>
            <Switch
              name="home_visible"
              defaultChecked={campaignKind === "event" ? false : (campaign?.home_visible ?? true)}
              disabled={campaignKind === "event"}
            />
          </label>
          {redemptionMode !== "app" && (
            <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
              <div>
                <p className="font-bold">Abrir o site em outra aba</p>
                <p className="text-xs text-muted-foreground">
                  Mantém o Bafafá Connect aberto para o cliente voltar.
                </p>
              </div>
              <Switch
                name="external_open_new_tab"
                defaultChecked={campaign?.external_open_new_tab ?? true}
              />
            </label>
          )}
          {campaignKind !== "milestone" && (
            <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
              <div>
                <p className="font-bold">
                  {campaignKind === "global" ? "Exigir presença no período" : "Exigir check-in"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {campaignKind === "global"
                    ? "Libera a vantagem depois de qualquer check-in válido durante a campanha."
                    : "Libera o mimo somente após presença validada no evento."}
                </p>
              </div>
              <Switch
                name="requires_checkin"
                defaultChecked={campaign?.requires_checkin ?? campaignKind === "event"}
              />
            </label>
          )}
          {campaignKind !== "event" && triggerType !== "profile_completion" && (
            <label className="flex items-center justify-between rounded-2xl border-2 border-primary/15 bg-primary/5 p-4">
              <div className="pr-4">
                <p className="font-bold">Contar somente presenças confirmadas pela equipe</p>
                <p className="text-xs text-muted-foreground">
                  {campaignKind === "milestone"
                    ? "Desativado, todos os check-ins que aparecem no perfil contam. Ative apenas se quiser exigir confirmação da equipe por QR."
                    : "Ative para liberar a vantagem somente depois que a equipe confirmar a presença por QR."}
                </p>
              </div>
              <Switch
                name="requires_staff_validation"
                defaultChecked={campaign?.requires_staff_validation ?? false}
              />
            </label>
          )}
          <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
            <div>
              <p className="font-bold">Exigir perfil mínimo</p>
              <p className="text-xs text-muted-foreground">Exige pelo menos 40% do perfil.</p>
            </div>
            <Switch
              name="requires_min_profile"
              defaultChecked={campaign?.requires_min_profile ?? campaignKind !== "milestone"}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Salvando…" : "Salvar campanha"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CampaignPreviewDialog({
  campaign,
  event,
  onOpenChange,
}: {
  campaign: CampaignRow | null;
  event: EventRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={Boolean(campaign)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-[30px] border-[3px] border-foreground">
        {campaign && (
          <div className="ticket-card checker-texture p-5 text-foreground">
            <span className="cut-label bg-white">mimo do Bafafá</span>
            <h2 className="mt-5 font-display text-4xl leading-none">{campaign.name}</h2>
            <p className="mt-4 font-poster text-2xl">{campaignBenefitLabel(campaign)}</p>
            {campaign.description && (
              <p className="mt-2 text-sm font-semibold opacity-70">{campaign.description}</p>
            )}
            {event && <p className="mt-4 text-sm font-black">Rolê: {event.name}</p>}
            <p className="mt-2 text-xs font-bold opacity-70">
              Validade após liberar: {formatRewardDuration(campaign.reward_valid_hours)}
            </p>
            {campaign.public_rules && (
              <p className="mt-4 rounded-xl border-2 border-foreground/15 bg-white/70 p-3 text-xs font-semibold">
                {campaign.public_rules}
              </p>
            )}
            <Button className="mt-5 w-full" onClick={() => onOpenChange(false)}>
              Fechar prévia
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MetricMini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border-2 border-foreground/15 bg-white/70 p-2 text-center">
      <p className="font-display text-2xl leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.08em] opacity-65">{label}</p>
    </div>
  );
}

function formatDuration(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  return minutes ? `${hours}h ${minutes}min` : `${hours}h`;
}

function ClientsManager({ data, onChanged }: { data: AdminData; onChanged: () => void }) {
  const [search, setSearch] = useState("");
  const [busyFounder, setBusyFounder] = useState<string | null>(null);
  const preferenceByUser = useMemo(
    () => new Map(data.preferences.map((preference) => [preference.user_id, preference])),
    [data.preferences],
  );
  const profileCompletionByUser = useMemo(
    () => new Map(data.profileCompletions.map((row) => [row.user_id, Number(row.percentage ?? 0)])),
    [data.profileCompletions],
  );
  const checkinsByUser = useMemo(
    () => countBy(data.checkins, (checkin) => checkin.user_id),
    [data.checkins],
  );
  const rewardsByUser = useMemo(
    () => countBy(data.rewards, (reward) => reward.user_id),
    [data.rewards],
  );
  const rolesByUser = useMemo(() => groupRoles(data.roles), [data.roles]);
  const founderBadge = data.badgeDefinitions.find((badge) => badge.slug === "bafafa-fundador");
  const founderUserIds = useMemo(
    () =>
      new Set(
        data.userBadges
          .filter((badge) => badge.badge_id === founderBadge?.id)
          .map((badge) => badge.user_id),
      ),
    [data.userBadges, founderBadge?.id],
  );

  const clients = data.profiles.filter((profile) =>
    `${profile.display_name} ${profile.username ?? ""} ${profile.city ?? ""} ${profile.neighborhood ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function toggleFounder(userId: string) {
    const enabled = !founderUserIds.has(userId);
    setBusyFounder(userId);
    const { error } = await supabase.rpc("admin_set_manual_badge", {
      _user_id: userId,
      _badge_slug: "bafafa-fundador",
      _enabled: enabled,
    });
    setBusyFounder(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(enabled ? "Selo Sócio Fundador concedido." : "Selo Sócio Fundador removido.");
    onChanged();
  }

  return (
    <SectionLayout
      eyebrow="CRM inicial"
      title="Clientes"
      description="Dados declarados, perfil, presença, benefícios e o selo especial atribuído somente pela administração."
    >
      <div className="mb-4 sticker-card checker-texture p-4 text-sm font-semibold text-foreground">
        <p className="flex items-center gap-2 font-poster text-lg">
          <Crown className="h-5 w-5" /> Sócio Fundador
        </p>
        <p className="mt-1 opacity-75">
          É um selo manual e especial. Os outros selos continuam sendo concedidos automaticamente
          pelas regras do app.
        </p>
      </div>
      <SearchField
        value={search}
        onChange={setSearch}
        placeholder="Buscar nome, usuário, cidade ou bairro"
      />
      <div className="mt-4 overflow-hidden rounded-3xl border-2 border-foreground/15 bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-foreground text-[10px] uppercase tracking-[0.14em] text-background">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Localização</th>
                <th className="px-4 py-3">Perfil</th>
                <th className="px-4 py-3">Check-ins</th>
                <th className="px-4 py-3">Mimos</th>
                <th className="px-4 py-3">Sócio Fundador</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((profile) => {
                const completeness = profileCompletionByUser.get(profile.id) ?? 0;
                const isFounder = founderUserIds.has(profile.id);
                return (
                  <tr key={profile.id} className="hover:bg-muted/40">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-foreground bg-primary font-display text-lg text-white">
                          {profile.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            (profile.display_name[0]?.toUpperCase() ?? "B")
                          )}
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 font-bold">
                            {profile.display_name}
                            {isFounder && (
                              <span
                                title="Sócio Fundador"
                                className="grid h-6 w-6 place-items-center rounded-full border-2 border-foreground bg-mango shadow-[1px_2px_0_var(--foreground)]"
                              >
                                <Crown className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {profile.username ? `@${profile.username}` : "Sem usuário"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">
                      {[profile.city, profile.neighborhood].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-bold">{completeness}%</span>
                      <div className="mt-1 h-2 w-24 overflow-hidden rounded-full border border-foreground/20 bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${completeness}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-4 font-display text-2xl">
                      {checkinsByUser.get(profile.id) ?? 0}
                    </td>
                    <td className="px-4 py-4 font-display text-2xl">
                      {rewardsByUser.get(profile.id) ?? 0}
                    </td>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        disabled={busyFounder === profile.id || !founderBadge}
                        onClick={() => void toggleFounder(profile.id)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border-2 border-foreground px-3 py-2 text-xs font-black shadow-[2px_3px_0_var(--foreground)] disabled:opacity-50 ${
                          isFounder
                            ? "bg-mango text-foreground"
                            : "bg-background text-muted-foreground"
                        }`}
                      >
                        {busyFounder === profile.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Crown className="h-4 w-4" />
                        )}
                        {isFounder ? "Concedido" : "Conceder"}
                      </button>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {(rolesByUser.get(profile.id) ?? ["gratuito"]).map((role) => (
                          <span
                            key={role}
                            className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold"
                          >
                            {role}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {formatDateTime(profile.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {clients.length === 0 && <EmptyMessage>Nenhum cliente encontrado.</EmptyMessage>}
      </div>
    </SectionLayout>
  );
}

function CheckinsManager({ data }: { data: AdminData }) {
  const eventById = useMemo(
    () => new Map(data.events.map((event) => [event.id, event])),
    [data.events],
  );
  const profileById = useMemo(
    () => new Map(data.profiles.map((profile) => [profile.id, profile])),
    [data.profiles],
  );
  const [eventFilter, setEventFilter] = useState("all");

  const filtered = data.checkins.filter(
    (checkin) => eventFilter === "all" || checkin.event_id === eventFilter,
  );

  return (
    <SectionLayout
      eyebrow="Presenças confirmadas"
      title="Check-ins"
      description="Acompanhe quem entrou em cada evento e quem realizou a validação."
      action={
        <Link
          to="/staff/checkin"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <ShieldCheck className="h-4 w-4" /> Abrir validador
        </Link>
      }
    >
      <div className="mb-4 max-w-sm space-y-2">
        <Label htmlFor="checkin-event-filter">Filtrar por evento</Label>
        <select
          id="checkin-event-filter"
          value={eventFilter}
          onChange={(event) => setEventFilter(event.target.value)}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Todos os eventos</option>
          {data.events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded-3xl border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Evento</th>
                <th className="px-4 py-3">Horário</th>
                <th className="px-4 py-3">Método</th>
                <th className="px-4 py-3">Validado por</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((checkin) => (
                <tr key={checkin.id}>
                  <td className="px-4 py-4 font-bold">
                    {profileById.get(checkin.user_id)?.display_name || "Bafafã"}
                  </td>
                  <td className="px-4 py-4">
                    {eventById.get(checkin.event_id)?.name || "Evento removido"}
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDateTime(checkin.created_at)}
                  </td>
                  <td className="px-4 py-4">{checkin.method}</td>
                  <td className="px-4 py-4 text-muted-foreground">
                    {checkin.staff_id
                      ? profileById.get(checkin.staff_id)?.display_name || "Equipe"
                      : "Sistema"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <EmptyMessage>Nenhum check-in registrado.</EmptyMessage>}
      </div>
    </SectionLayout>
  );
}

function ChatModerationManager({ data, onChanged }: { data: AdminData; onChanged: () => void }) {
  const profileById = useMemo(
    () => new Map(data.profiles.map((profile) => [profile.id, profile])),
    [data.profiles],
  );
  const eventById = useMemo(
    () => new Map(data.events.map((event) => [event.id, event])),
    [data.events],
  );
  const messageById = useMemo(
    () => new Map(data.chatMessages.map((message) => [message.id, message])),
    [data.chatMessages],
  );
  const openReports = data.chatReports.filter((report) => report.status === "open");
  const openPrivateReports = data.privateChatReports.filter((report) => report.status === "open");

  async function moderate(messageId: string, restore: boolean, reason?: string) {
    const { error } = await supabase.rpc("moderate_event_chat_message", {
      _message_id: messageId,
      _restore: restore,
      _reason: reason ?? undefined,
    });
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(restore ? "Mensagem restaurada." : "Mensagem ocultada da Resenha.");
    onChanged();
  }

  async function moderatePrivate(
    reportId: string,
    action: "remove_message" | "close_conversation" | "dismiss",
  ) {
    const { error } = await supabase.rpc("moderate_private_chat_report", {
      _report_id: reportId,
      _action: action,
    });
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(
      action === "dismiss"
        ? "Denúncia encerrada sem remover a mensagem."
        : action === "close_conversation"
          ? "Mensagem removida e conversa encerrada."
          : "Mensagem privada removida.",
    );
    onChanged();
  }

  return (
    <SectionLayout
      eyebrow="Conversa durante o evento"
      title="Resenha"
      description="Acompanhe denúncias e modere mensagens. O chat só abre para pessoas com check-in válido."
    >
      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <section className="card-festa p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-muted-foreground">Fila de moderação</p>
              <h3 className="mt-1 font-display text-2xl">Denúncias abertas</h3>
            </div>
            <span className="cut-label bg-secondary">{openReports.length}</span>
          </div>
          <div className="mt-5 space-y-3">
            {openReports.length === 0 ? (
              <EmptyMessage>Nenhuma denúncia aguardando análise.</EmptyMessage>
            ) : (
              openReports.map((report) => {
                const message = messageById.get(report.message_id);
                const author = message ? profileById.get(message.user_id) : null;
                const reporter = profileById.get(report.reporter_id);
                const event = message ? eventById.get(message.event_id) : null;
                return (
                  <article
                    key={report.id}
                    className="rounded-2xl border-2 border-foreground/15 bg-background p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-black">{event?.name ?? "Evento"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Autor: {author?.display_name ?? "Usuário"} · denúncia de{" "}
                          {reporter?.display_name ?? "Bafafã"}
                        </p>
                      </div>
                      <StatusPill status={report.reason} />
                    </div>
                    <blockquote className="mt-3 rounded-xl bg-muted p-3 text-sm font-semibold">
                      {message?.body ?? "Mensagem não disponível."}
                    </blockquote>
                    {report.details && (
                      <p className="mt-2 text-xs text-muted-foreground">{report.details}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        onClick={() => void moderate(report.message_id, false, report.reason)}
                      >
                        Ocultar mensagem
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void moderate(report.message_id, true)}
                      >
                        Manter e encerrar
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <section className="card-festa p-5">
          <p className="section-kicker text-muted-foreground">Últimas mensagens</p>
          <h3 className="mt-1 font-display text-2xl">Visão rápida</h3>
          <div className="mt-5 space-y-3">
            {data.chatMessages.slice(0, 30).map((message) => (
              <article key={message.id} className="rounded-2xl border border-input p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-black">
                      {profileById.get(message.user_id)?.display_name ?? "Bafafã"} ·{" "}
                      {eventById.get(message.event_id)?.name ?? "Evento"}
                    </p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {message.body}
                    </p>
                  </div>
                  <StatusPill status={message.status} />
                </div>
                <div className="mt-3 flex gap-2">
                  {message.status === "visible" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void moderate(message.id, false, "Ação administrativa")}
                    >
                      Ocultar
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void moderate(message.id, true)}
                    >
                      Restaurar
                    </Button>
                  )}
                </div>
              </article>
            ))}
            {data.chatMessages.length === 0 && (
              <EmptyMessage>A Resenha ainda não recebeu mensagens.</EmptyMessage>
            )}
          </div>
        </section>
      </div>

      <section className="card-festa mt-5 p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="section-kicker text-muted-foreground">Conversa com consentimento</p>
            <h3 className="mt-1 font-display text-2xl">Denúncias de mensagens privadas</h3>
          </div>
          <span className="cut-label bg-samba text-samba-foreground">
            {openPrivateReports.length}
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          A moderação vê somente a mensagem denunciada, o motivo e as pessoas envolvidas. O restante
          da conversa permanece privado.
        </p>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {openPrivateReports.length === 0 ? (
            <div className="lg:col-span-2">
              <EmptyMessage>Nenhuma denúncia privada aguardando análise.</EmptyMessage>
            </div>
          ) : (
            openPrivateReports.map((report) => (
              <article
                key={report.report_id}
                className="rounded-2xl border-2 border-foreground/15 bg-background p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">Mensagem de {report.author_name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Denúncia de {report.reporter_name} · {formatDateTime(report.created_at)}
                    </p>
                  </div>
                  <StatusPill status={report.reason} />
                </div>
                <blockquote className="mt-3 rounded-xl bg-muted p-3 text-sm font-semibold">
                  {report.message_body}
                </blockquote>
                {report.details && (
                  <p className="mt-2 text-xs text-muted-foreground">{report.details}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void moderatePrivate(report.report_id, "remove_message")}
                  >
                    Remover mensagem
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void moderatePrivate(report.report_id, "close_conversation")}
                  >
                    Encerrar conversa
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void moderatePrivate(report.report_id, "dismiss")}
                  >
                    Manter e encerrar
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </SectionLayout>
  );
}

function TeamManager({
  profiles,
  roles,
  currentUserId,
  onChanged,
}: {
  profiles: ProfileRow[];
  roles: RoleRow[];
  currentUserId: string;
  onChanged: () => void;
}) {
  const [search, setSearch] = useState("");
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const rolesByUser = useMemo(() => groupRoles(roles), [roles]);

  const filtered = profiles.filter((profile) =>
    `${profile.display_name} ${profile.username ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  async function toggleRole(userId: string, role: "equipe" | "admin") {
    setBusyUser(`${userId}:${role}`);
    const hasCurrentRole = rolesByUser.get(userId)?.includes(role) ?? false;
    const result = hasCurrentRole
      ? await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", role)
      : await supabase.from("user_roles").insert({ user_id: userId, role });
    setBusyUser(null);
    if (result.error) return toast.error(publicErrorMessage(result.error));
    toast.success(hasCurrentRole ? "Acesso removido." : "Acesso concedido.");
    onChanged();
  }

  return (
    <SectionLayout
      eyebrow="Permissões"
      title="Equipe"
      description="Funcionários validam check-ins e mimos. Administradores gerenciam todo o sistema."
    >
      <div className="mb-4 rounded-2xl bg-mango/45 p-4 text-sm">
        A pessoa precisa criar uma conta normal antes de receber acesso de equipe.
      </div>
      <SearchField value={search} onChange={setSearch} placeholder="Buscar pessoa cadastrada" />
      <div className="mt-4 grid gap-3">
        {filtered.map((profile) => {
          const userRoles = rolesByUser.get(profile.id) ?? [];
          const isSelf = profile.id === currentUserId;
          return (
            <div
              key={profile.id}
              className="card-festa flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-bold">{profile.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {profile.username ? `@${profile.username}` : "Sem nome de usuário"}
                  {isSelf ? " · sua conta" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <RoleButton
                  active={userRoles.includes("equipe")}
                  loading={busyUser === `${profile.id}:equipe`}
                  onClick={() => void toggleRole(profile.id, "equipe")}
                >
                  Equipe
                </RoleButton>
                <RoleButton
                  active={userRoles.includes("admin")}
                  loading={busyUser === `${profile.id}:admin`}
                  disabled={isSelf && userRoles.includes("admin")}
                  onClick={() => void toggleRole(profile.id, "admin")}
                >
                  Administrador
                </RoleButton>
              </div>
            </div>
          );
        })}
      </div>
    </SectionLayout>
  );
}

function AuditManager({ data }: { data: AdminData }) {
  const profileById = useMemo(
    () => new Map(data.profiles.map((profile) => [profile.id, profile])),
    [data.profiles],
  );
  return (
    <SectionLayout
      eyebrow="Histórico de segurança"
      title="Auditoria"
      description="Registro das principais alterações administrativas e validações operacionais."
    >
      <div className="overflow-hidden rounded-3xl border border-input bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-muted text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Pessoa</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Entidade</th>
                <th className="px-4 py-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.audits.map((audit) => (
                <tr key={audit.id}>
                  <td className="px-4 py-4 text-muted-foreground">
                    {formatDateTime(audit.created_at)}
                  </td>
                  <td className="px-4 py-4 font-bold">
                    {audit.actor_id
                      ? profileById.get(audit.actor_id)?.display_name || "Equipe"
                      : "Sistema"}
                  </td>
                  <td className="px-4 py-4">{audit.action}</td>
                  <td className="px-4 py-4 text-muted-foreground">{audit.entity || "—"}</td>
                  <td className="max-w-48 truncate px-4 py-4 font-mono text-xs text-muted-foreground">
                    {audit.entity_id || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.audits.length === 0 && (
          <EmptyMessage>A auditoria começa após a primeira alteração.</EmptyMessage>
        )}
      </div>
    </SectionLayout>
  );
}

const FEED_PLACEMENTS = [
  "top",
  "after_promotions",
  "after_current_event",
  "after_events",
  "bottom",
] as const;

type FeedPlacement = (typeof FEED_PLACEMENTS)[number];

function feedPlacementValue(value: FormDataEntryValue | null): FeedPlacement {
  return FEED_PLACEMENTS.includes(value as FeedPlacement)
    ? (value as FeedPlacement)
    : "after_events";
}

function feedPlacementLabel(value: string): string {
  const labels: Record<FeedPlacement, string> = {
    top: "No topo",
    after_promotions: "Depois das Fofoquinhas",
    after_current_event: "Depois do evento de hoje",
    after_events: "Depois dos eventos",
    bottom: "No final do feed",
  };
  return labels[feedPlacementValue(value)];
}

function FeedContentManager({
  posts,
  currentUserId,
  onChanged,
}: {
  posts: FeedPostRow[];
  currentUserId: string;
  onChanged: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FeedPostRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [imageSelection, setImageSelection] = useState<File | null | undefined>(undefined);

  async function remove(post: FeedPostRow) {
    if (!window.confirm(`Remover a publicação “${post.title}”?`)) return;
    const { error } = await supabase.from("feed_posts").delete().eq("id", post.id);
    if (error) return toast.error(publicErrorMessage(error));
    if (post.image_url) await removePublicImage("event-images", post.image_url);
    toast.success("Publicação removida.");
    onChanged();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    const previousImage = editing?.image_url ?? null;
    let imageUrl = previousImage;
    let uploadedUrl: string | null = null;
    try {
      if (imageSelection instanceof File) {
        const uploaded = await uploadPublicImage({
          bucket: "event-images",
          folder: "feed",
          file: imageSelection,
        });
        imageUrl = uploaded.url;
        uploadedUrl = uploaded.url;
      } else if (imageSelection === null) imageUrl = null;

      const status = textValue(form, "status");
      const payload: Database["public"]["Tables"]["feed_posts"]["Insert"] = {
        post_type: textValue(form, "post_type"),
        title: textValue(form, "title"),
        body: nullableText(form, "body"),
        image_url: imageUrl,
        starts_at: toIso(textValue(form, "starts_at")),
        ends_at: nullableIso(form, "ends_at"),
        is_pinned: form.get("is_pinned") === "on",
        placement: feedPlacementValue(form.get("placement")),
        priority: editing?.priority ?? 0,
        status,
        created_by: currentUserId,
        published_at:
          status === "published" ? (editing?.published_at ?? new Date().toISOString()) : null,
      };
      const result = editing
        ? await supabase.from("feed_posts").update(payload).eq("id", editing.id)
        : await supabase.from("feed_posts").insert(payload);
      if (result.error) throw result.error;
      if (previousImage && previousImage !== imageUrl)
        await removePublicImage("event-images", previousImage);
      toast.success(editing ? "Publicação atualizada." : "Publicação criada.");
      setDialogOpen(false);
      setEditing(null);
      setImageSelection(undefined);
      onChanged();
    } catch (error) {
      if (uploadedUrl) await removePublicImage("event-images", uploadedUrl);
      toast.error(publicErrorMessage(error, "Não foi possível salvar a publicação."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionLayout
      eyebrow="Comunicação oficial"
      title="Feed do Bafafá"
      description="Publique fotos, avisos, bastidores e novidades. Promoções e eventos continuam com prioridade automática."
      action={
        <Button
          onClick={() => {
            setEditing(null);
            setImageSelection(undefined);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Nova publicação
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        {posts.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyMessage>Nenhuma publicação no feed.</EmptyMessage>
          </div>
        ) : (
          posts.map((post) => (
            <article key={post.id} className="sticker-card overflow-hidden bg-card">
              {post.image_url && (
                <img src={post.image_url} alt="" className="aspect-[16/8] w-full object-cover" />
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="section-kicker text-muted-foreground">{post.post_type}</p>
                    <h3 className="mt-1 font-display text-3xl leading-none">{post.title}</h3>
                  </div>
                  <StatusPill status={post.status} />
                </div>
                {post.body && (
                  <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">{post.body}</p>
                )}
                <div className="mt-3 space-y-1 text-xs font-bold text-muted-foreground">
                  <p>Entra no feed: {formatDateTime(post.starts_at)}</p>
                  <p>Posição: {feedPlacementLabel(post.placement)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(post);
                      setImageSelection(undefined);
                      setDialogOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void remove(post)}>
                    <Trash2 className="h-4 w-4 text-destructive" /> Excluir
                  </Button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editing ? "Editar publicação" : "Nova publicação"}
            </DialogTitle>
            <DialogDescription>
              Escolha em linguagem simples onde a publicação aparece no feed do cliente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <ImageUploadField
              id="feed-image"
              label="Imagem (opcional)"
              currentUrl={editing?.image_url}
              onChange={setImageSelection}
              description="Escolha uma foto horizontal do computador ou celular."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="feed-type">Tipo</Label>
                <select
                  id="feed-type"
                  name="post_type"
                  defaultValue={editing?.post_type ?? "news"}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="news">Novidade</option>
                  <option value="photo">Foto / álbum</option>
                  <option value="notice">Aviso</option>
                  <option value="behind_scenes">Bastidor</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="feed-status">Status</Label>
                <select
                  id="feed-status"
                  name="status"
                  defaultValue={editing?.status ?? "draft"}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                  <option value="archived">Arquivado</option>
                </select>
              </div>
              <Field label="Título" name="title" defaultValue={editing?.title} required />
              <div className="space-y-2">
                <Label htmlFor="feed-placement">Onde aparece no feed</Label>
                <select
                  id="feed-placement"
                  name="placement"
                  defaultValue={editing?.placement ?? "after_events"}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="top">Colocar no topo</option>
                  <option value="after_promotions">Depois das Fofoquinhas</option>
                  <option value="after_current_event">Depois do evento de hoje</option>
                  <option value="after_events">Depois dos eventos</option>
                  <option value="bottom">No final do feed</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  As ações da visita, como check-in e benefício liberado, continuam protegidas para
                  não se perderem.
                </p>
              </div>
              <Field
                label="Início"
                name="starts_at"
                type="datetime-local"
                defaultValue={
                  toLocalInput(editing?.starts_at) || toLocalInput(new Date().toISOString())
                }
                required
              />
              <Field
                label="Fim (opcional)"
                name="ends_at"
                type="datetime-local"
                defaultValue={toLocalInput(editing?.ends_at)}
              />
            </div>
            <TextField label="Texto" name="body" defaultValue={editing?.body} />
            <label className="flex items-center justify-between rounded-2xl bg-muted p-4">
              <div>
                <p className="font-bold">Mostrar primeiro nesta posição</p>
                <p className="text-xs text-muted-foreground">
                  Útil quando houver duas ou mais publicações no mesmo lugar do feed.
                </p>
              </div>
              <Switch name="is_pinned" defaultChecked={editing?.is_pinned ?? false} />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </SectionLayout>
  );
}

function SectionLayout({
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-1 font-display text-4xl leading-none sm:text-5xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative max-w-lg">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  ...props
}: { label: string; name: string; defaultValue?: string | number | null } & Omit<
  ComponentProps<typeof Input>,
  "name" | "defaultValue"
>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} {...props} />
    </div>
  );
}

function TextField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea id={name} name={name} defaultValue={defaultValue ?? ""} rows={3} />
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label: Record<string, string> = {
    draft: "Rascunho",
    published: "Publicado",
    scheduled: "Agendado",
    ongoing: "Rolando",
    ended: "Encerrado",
    cancelled: "Cancelado",
    active: "Ativa",
    paused: "Pausada",
  };
  return (
    <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">
      {label[status] || status}
    </span>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function RoleButton({
  active,
  loading,
  disabled,
  children,
  onClick,
}: {
  active: boolean;
  loading: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      disabled={loading || disabled}
      onClick={onClick}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : active ? (
        <CheckCircle2 className="h-4 w-4" />
      ) : (
        <Plus className="h-4 w-4" />
      )}
      {children}
    </Button>
  );
}

function textValue(form: FormData, key: string) {
  return String(form.get(key) ?? "").trim();
}

function nullableText(form: FormData, key: string) {
  const value = textValue(form, key);
  return value || null;
}

function numberValue(form: FormData, key: string, fallback = 0) {
  const raw = form.get(key);
  if (raw === null || String(raw).trim() === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function nullableNumber(form: FormData, key: string) {
  const raw = textValue(form, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function moneyToCents(form: FormData, key: string) {
  const value = nullableNumber(form, key);
  return value === null ? null : Math.round(value * 100);
}

function centsToMoney(value: number | null | undefined) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function nullableIso(form: FormData, key: string) {
  const value = textValue(form, key);
  return value ? toIso(value) : null;
}

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function formatRewardDuration(hours: number) {
  const totalMinutes = Math.max(1, Math.round(Number(hours) * 60));
  if (totalMinutes < 60) return `${totalMinutes} min`;
  if (totalMinutes % 60 === 0) {
    const wholeHours = totalMinutes / 60;
    return `${wholeHours} ${wholeHours === 1 ? "hora" : "horas"}`;
  }
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${wholeHours}h ${minutes}min`;
}

function groupRoles(roles: RoleRow[]) {
  const grouped = new Map<string, string[]>();
  roles.forEach((role) =>
    grouped.set(role.user_id, [...(grouped.get(role.user_id) ?? []), role.role]),
  );
  return grouped;
}

function countBy<T>(items: T[], key: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => counts.set(key(item), (counts.get(key(item)) ?? 0) + 1));
  return counts;
}
