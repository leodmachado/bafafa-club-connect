import { publicErrorMessage } from "@/lib/public-error";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Download,
  Flag,
  Gift,
  Loader2,
  MessageCircleMore,
  Rocket,
  Save,
  Target,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { formatDateTime } from "@/lib/bafafa";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type CampaignRow = Database["public"]["Tables"]["campaigns"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PreferenceRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type CheckinRow = Database["public"]["Tables"]["checkins"]["Row"];
type RoleRow = Database["public"]["Tables"]["user_roles"]["Row"];
type RewardRow = Database["public"]["Tables"]["user_rewards"]["Row"];
type RedemptionRow = Database["public"]["Tables"]["reward_redemptions"]["Row"];
type ChatMessageRow = Database["public"]["Tables"]["event_chat_messages"]["Row"];
type ChatReportRow = Database["public"]["Tables"]["event_chat_reports"]["Row"];
type PilotRow = Database["public"]["Tables"]["pilot_runs"]["Row"];
type PilotInsert = Database["public"]["Tables"]["pilot_runs"]["Insert"];
type CompletionRow = { user_id: string; percentage: number; details: unknown };

export type ManagementSnapshot = {
  events: EventRow[];
  campaigns: CampaignRow[];
  profiles: ProfileRow[];
  preferences: PreferenceRow[];
  checkins: CheckinRow[];
  roles: RoleRow[];
  rewards: RewardRow[];
  redemptions: RedemptionRow[];
  profileCompletions: CompletionRow[];
  chatMessages: ChatMessageRow[];
  chatReports: ChatReportRow[];
};

type RangeKey = "7" | "30" | "90" | "all";
type ExportKind = "clients" | "checkins" | "campaigns" | "events";

type PilotDraft = {
  id: string | null;
  name: string;
  eventId: string;
  campaignId: string;
  status: PilotRow["status"];
  expectedAttendance: number;
  targetRegistrations: number;
  targetCheckins: number;
  targetRedemptions: number;
  minimumProfilePercent: number;
  staffIds: string[];
  customerInstructions: string;
  internalNotes: string;
};

const EMPTY_PILOT: PilotDraft = {
  id: null,
  name: "Piloto Clube dos Bafafãs",
  eventId: "",
  campaignId: "",
  status: "preparing",
  expectedAttendance: 0,
  targetRegistrations: 50,
  targetCheckins: 40,
  targetRedemptions: 25,
  minimumProfilePercent: 40,
  staffIds: [],
  customerInstructions:
    "Cadastre-se, complete o perfil mínimo e apresente seu QR para a equipe fazer o check-in.",
  internalNotes: "",
};

export function ManagementDashboard({
  data,
  currentUserId,
}: {
  data: ManagementSnapshot;
  currentUserId: string;
}) {
  const [range, setRange] = useState<RangeKey>("30");
  const [eventId, setEventId] = useState("all");
  const [exporting, setExporting] = useState<ExportKind | null>(null);
  const [pilots, setPilots] = useState<PilotRow[]>([]);
  const [pilotLoading, setPilotLoading] = useState(true);
  const [pilotSaving, setPilotSaving] = useState(false);
  const [pilotDraft, setPilotDraft] = useState<PilotDraft>(EMPTY_PILOT);
  const initializedPilot = useRef(false);

  const loadPilots = useCallback(async () => {
    setPilotLoading(true);
    const { data: rows, error } = await supabase
      .from("pilot_runs")
      .select("*")
      .order("created_at", { ascending: false });
    setPilotLoading(false);
    if (error) {
      toast.error(publicErrorMessage(error));
      return;
    }
    const next = rows ?? [];
    setPilots(next);
    if (next.length > 0 && !initializedPilot.current) {
      const first = next[0];
      setPilotDraft(pilotToDraft(first));
      setEventId(first.event_id);
      initializedPilot.current = true;
    }
  }, []);

  useEffect(() => {
    void loadPilots();
  }, [loadPilots]);

  const fromDate = useMemo(() => {
    if (range === "all") return null;
    return new Date(Date.now() - Number(range) * 86400000);
  }, [range]);
  const toDate = useMemo(() => new Date(), []);
  const selectedEvent = data.events.find((event) => event.id === eventId) ?? null;
  const activePilot = pilots.find((pilot) => pilot.id === pilotDraft.id) ?? null;
  const threshold = activePilot?.minimum_profile_percent ?? pilotDraft.minimumProfilePercent ?? 40;

  const metrics = useMemo(() => {
    const inRange = (value: string | null | undefined) => {
      if (!value) return false;
      const time = new Date(value).getTime();
      return (!fromDate || time >= fromDate.getTime()) && time <= toDate.getTime();
    };
    const eventMatches = (value: string | null) => eventId === "all" || value === eventId;
    const completions = new Map(
      data.profileCompletions.map((row) => [row.user_id, Number(row.percentage ?? 0)]),
    );
    const cohort = data.profiles.filter((profile) => inRange(profile.created_at));
    const cohortIds = new Set(cohort.map((profile) => profile.id));
    const minimumProfiles = cohort.filter(
      (profile) => (completions.get(profile.id) ?? 0) >= threshold,
    );
    const completeProfiles = cohort.filter((profile) => (completions.get(profile.id) ?? 0) >= 100);
    const checkins = data.checkins.filter(
      (checkin) => eventMatches(checkin.event_id) && inRange(checkin.created_at),
    );
    const checkedUsers = new Set(checkins.map((checkin) => checkin.user_id));
    const cohortCheckins = new Set(
      checkins
        .filter((checkin) => cohortIds.has(checkin.user_id))
        .map((checkin) => checkin.user_id),
    );
    const rewards = data.rewards.filter(
      (reward) => eventMatches(reward.event_id) && inRange(reward.granted_at),
    );
    const rewardIds = new Set(rewards.map((reward) => reward.id));
    const redemptions = data.redemptions.filter(
      (redemption) => rewardIds.has(redemption.reward_id) && inRange(redemption.redeemed_at),
    );
    const chatMessages = data.chatMessages.filter(
      (message) => eventMatches(message.event_id) && inRange(message.created_at),
    );
    const chatParticipants = new Set(chatMessages.map((message) => message.user_id));
    const reportMessageIds = new Set(chatMessages.map((message) => message.id));
    const chatReports = data.chatReports.filter(
      (report) => reportMessageIds.has(report.message_id) && inRange(report.created_at),
    );
    const eventsByUser = new Map<string, Set<string>>();
    data.checkins.forEach((checkin) => {
      const set = eventsByUser.get(checkin.user_id) ?? new Set<string>();
      set.add(checkin.event_id);
      eventsByUser.set(checkin.user_id, set);
    });
    const recurringUsers = [...checkedUsers].filter(
      (userId) => (eventsByUser.get(userId)?.size ?? 0) >= 2,
    ).length;

    return {
      cohort,
      minimumProfiles,
      completeProfiles,
      checkins,
      checkedUsers,
      cohortCheckins,
      rewards,
      redemptions,
      chatMessages,
      chatParticipants,
      chatReports,
      recurringUsers,
      completions,
    };
  }, [data, eventId, fromDate, threshold, toDate]);

  const eventMetrics = useMemo(() => {
    const eventsByUser = new Map<string, Set<string>>();
    data.checkins.forEach((checkin) => {
      const set = eventsByUser.get(checkin.user_id) ?? new Set<string>();
      set.add(checkin.event_id);
      eventsByUser.set(checkin.user_id, set);
    });
    return [...data.events]
      .sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
      .slice(0, 12)
      .map((event) => {
        const checkins = data.checkins.filter((item) => item.event_id === event.id);
        const rewards = data.rewards.filter((item) => item.event_id === event.id);
        const rewardIds = new Set(rewards.map((item) => item.id));
        const redemptions = data.redemptions.filter((item) => rewardIds.has(item.reward_id));
        const messages = data.chatMessages.filter((item) => item.event_id === event.id);
        const messageIds = new Set(messages.map((item) => item.id));
        const reports = data.chatReports.filter((item) => messageIds.has(item.message_id));
        const participants = new Set(messages.map((item) => item.user_id));
        const recurring = new Set(
          checkins
            .filter((item) => (eventsByUser.get(item.user_id)?.size ?? 0) >= 2)
            .map((item) => item.user_id),
        );
        const windowStart = new Date(event.starts_at).getTime() - 7 * 86400000;
        const windowEnd = event.ends_at
          ? new Date(event.ends_at).getTime()
          : new Date(event.starts_at).getTime() + 8 * 3600000;
        const registrations = data.profiles.filter((profile) => {
          const created = new Date(profile.created_at).getTime();
          return created >= windowStart && created <= windowEnd;
        }).length;
        return {
          event,
          registrations,
          checkins: new Set(checkins.map((item) => item.user_id)).size,
          rewards: rewards.length,
          redemptions: redemptions.length,
          participants: participants.size,
          messages: messages.length,
          reports: reports.length,
          recurring: recurring.size,
        };
      });
  }, [data]);

  const profileHealth = useMemo(() => {
    const preferenceByUser = new Map(data.preferences.map((item) => [item.user_id, item]));
    const fields = [
      { label: "Nascimento", complete: (p: ProfileRow) => Boolean(p.birth_date) },
      { label: "Cidade", complete: (p: ProfileRow) => Boolean(p.city?.trim()) },
      { label: "Bairro", complete: (p: ProfileRow) => Boolean(p.neighborhood?.trim()) },
      { label: "Como conheceu", complete: (p: ProfileRow) => Boolean(p.how_found_us?.trim()) },
      { label: "Foto", complete: (p: ProfileRow) => Boolean(p.avatar_url) },
      { label: "Nome de usuário", complete: (p: ProfileRow) => Boolean(p.username?.trim()) },
      {
        label: "Preferência de eventos",
        complete: (p: ProfileRow) => (preferenceByUser.get(p.id)?.event_categories.length ?? 0) > 0,
      },
      {
        label: "Preferência de bebidas",
        complete: (p: ProfileRow) =>
          (preferenceByUser.get(p.id)?.drink_preferences.length ?? 0) > 0,
      },
      {
        label: "Preferência de comidas",
        complete: (p: ProfileRow) => (preferenceByUser.get(p.id)?.food_preferences.length ?? 0) > 0,
      },
    ];
    const base = data.profiles.length || 1;
    return fields.map((field) => {
      const filled = data.profiles.filter(field.complete).length;
      return {
        ...field,
        filled,
        missing: data.profiles.length - filled,
        percent: (filled / base) * 100,
      };
    });
  }, [data.preferences, data.profiles]);

  const topPreferences = useMemo(() => {
    function aggregate(values: string[][]) {
      const counts = new Map<string, number>();
      values.flat().forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
      return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
    }
    return {
      events: aggregate(data.preferences.map((item) => item.event_categories)),
      drinks: aggregate(data.preferences.map((item) => item.drink_preferences)),
      foods: aggregate(data.preferences.map((item) => item.food_preferences)),
    };
  }, [data.preferences]);

  const staffProfiles = useMemo(() => {
    const allowed = new Set(
      data.roles
        .filter((role) => role.role === "equipe" || role.role === "admin")
        .map((role) => role.user_id),
    );
    return data.profiles.filter((profile) => allowed.has(profile.id));
  }, [data.profiles, data.roles]);

  const pilotCampaigns = data.campaigns.filter(
    (campaign) => !pilotDraft.eventId || campaign.event_id === pilotDraft.eventId,
  );
  const pilotEvent = data.events.find((event) => event.id === pilotDraft.eventId) ?? null;
  const pilotCampaign =
    data.campaigns.find((campaign) => campaign.id === pilotDraft.campaignId) ?? null;
  const readiness = buildReadiness(pilotDraft, pilotEvent, pilotCampaign, staffProfiles);
  const readyCount = readiness.filter((item) => item.ok).length;

  async function exportCsv(kind: ExportKind) {
    if (
      !window.confirm(
        "Esta exportação pode conter dados pessoais. Confirme que o arquivo será usado apenas para a gestão autorizada do Bafafá.",
      )
    ) {
      return;
    }
    setExporting(kind);
    const { data: result, error } = await supabase.rpc("admin_export_data", {
      _kind: kind,
      _event_id: eventId === "all" ? undefined : eventId,
      _from: fromDate?.toISOString() ?? undefined,
      _to: toDate.toISOString(),
    });
    setExporting(null);
    if (error) return toast.error(publicErrorMessage(error));
    const rows = jsonToRows(result);
    downloadCsv(rows, `bafafa-${kind}-${new Date().toISOString().slice(0, 10)}.csv`);
    toast.success(`${rows.length} linha(s) exportada(s).`);
  }

  function choosePilot(pilot: PilotRow) {
    initializedPilot.current = true;
    setPilotDraft(pilotToDraft(pilot));
    setEventId(pilot.event_id);
  }

  function newPilot() {
    initializedPilot.current = true;
    setPilotDraft(EMPTY_PILOT);
  }

  async function savePilot() {
    if (!pilotDraft.name.trim() || !pilotDraft.eventId) {
      return toast.error("Informe o nome e o evento do piloto.");
    }
    if (pilotDraft.campaignId && pilotCampaign?.event_id !== pilotDraft.eventId) {
      return toast.error("A campanha precisa pertencer ao evento escolhido.");
    }
    setPilotSaving(true);
    const payload: PilotInsert = {
      name: pilotDraft.name.trim(),
      event_id: pilotDraft.eventId,
      campaign_id: pilotDraft.campaignId || null,
      status: pilotDraft.status,
      expected_attendance: pilotDraft.expectedAttendance,
      target_registrations: pilotDraft.targetRegistrations,
      target_checkins: pilotDraft.targetCheckins,
      target_redemptions: pilotDraft.targetRedemptions,
      minimum_profile_percent: pilotDraft.minimumProfilePercent,
      staff_ids: pilotDraft.staffIds,
      customer_instructions: pilotDraft.customerInstructions.trim() || null,
      internal_notes: pilotDraft.internalNotes.trim() || null,
      updated_by: currentUserId,
      ...(pilotDraft.id ? {} : { created_by: currentUserId }),
    };
    const result = pilotDraft.id
      ? await supabase.from("pilot_runs").update(payload).eq("id", pilotDraft.id).select().single()
      : await supabase.from("pilot_runs").insert(payload).select().single();
    setPilotSaving(false);
    if (result.error) return toast.error(publicErrorMessage(result.error));
    toast.success("Configuração do piloto salva.");
    if (result.data) setPilotDraft(pilotToDraft(result.data));
    await loadPilots();
  }

  async function transitionPilot(status: PilotRow["status"]) {
    if (!pilotDraft.id) return toast.error("Salve o piloto antes de alterar o status.");
    if ((status === "ready" || status === "running") && readyCount !== readiness.length) {
      return toast.error("Resolva os itens pendentes antes de liberar o piloto.");
    }
    if (status === "running" && pilotCampaign?.status !== "active") {
      return toast.error("Ative a campanha principal antes de iniciar o piloto.");
    }
    if (status === "running" && !window.confirm("Iniciar oficialmente o piloto agora?")) return;
    if (status === "finished" && !window.confirm("Encerrar o piloto e congelar este ciclo?"))
      return;
    setPilotSaving(true);
    const { data: updated, error } = await supabase
      .from("pilot_runs")
      .update({
        status,
        updated_by: currentUserId,
        ...(status === "running" ? { started_at: new Date().toISOString(), ended_at: null } : {}),
        ...(status === "finished" ? { ended_at: new Date().toISOString() } : {}),
      })
      .eq("id", pilotDraft.id)
      .select()
      .single();
    setPilotSaving(false);
    if (error) return toast.error(publicErrorMessage(error));
    if (updated) setPilotDraft(pilotToDraft(updated));
    toast.success(status === "running" ? "Piloto iniciado." : "Status do piloto atualizado.");
    await loadPilots();
  }

  const goalProgress = activePilot
    ? {
        registrations: goal(metrics.cohort.length, activePilot.target_registrations),
        checkins: goal(metrics.checkedUsers.size, activePilot.target_checkins),
        redemptions: goal(metrics.redemptions.length, activePilot.target_redemptions),
      }
    : null;

  return (
    <div className="space-y-10">
      <section>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-kicker text-muted-foreground">Métricas do clube</p>
            <h1 className="mt-1 font-display text-4xl leading-none sm:text-5xl">Gestão</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Acompanhe aquisição, presença, uso dos mimos, recorrência e qualidade dos dados.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              value={range}
              onChange={(event) => setRange(event.target.value as RangeKey)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="all">Todo o período</option>
            </select>
            <select
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              className="h-10 max-w-72 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">Todos os eventos</option>
              {data.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={Users}
            label="Cadastros no período"
            value={metrics.cohort.length}
            tone="mango"
          />
          <MetricCard
            icon={UserCheck}
            label={`Perfil mínimo (${threshold}%+)`}
            value={metrics.minimumProfiles.length}
            copy={percent(metrics.minimumProfiles.length, metrics.cohort.length)}
            tone="green"
          />
          <MetricCard
            icon={CheckCircle2}
            label="Check-ins únicos"
            value={metrics.checkedUsers.size}
            copy={selectedEvent?.name ?? "no período selecionado"}
            tone="blue"
          />
          <MetricCard
            icon={TrendingUp}
            label="Clientes recorrentes"
            value={metrics.recurringUsers}
            copy="com presença em 2 ou mais eventos"
            tone="pink"
          />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
          <section className="card-festa p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-kicker text-muted-foreground">Funil de aquisição</p>
                <h2 className="mt-1 font-display text-2xl">Da entrada ao retorno</h2>
              </div>
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div className="mt-5 space-y-3">
              <FunnelRow
                label="Cadastros"
                value={metrics.cohort.length}
                base={metrics.cohort.length}
              />
              <FunnelRow
                label={`Perfil ${threshold}%+`}
                value={metrics.minimumProfiles.length}
                base={metrics.cohort.length}
              />
              <FunnelRow
                label="Perfil 100%"
                value={metrics.completeProfiles.length}
                base={metrics.cohort.length}
              />
              <FunnelRow
                label="Fizeram check-in"
                value={metrics.cohortCheckins.size}
                base={metrics.cohort.length}
              />
              <FunnelRow
                label="Mimos liberados"
                value={
                  metrics.rewards.filter((reward) =>
                    metrics.cohort.some((p) => p.id === reward.user_id),
                  ).length
                }
                base={metrics.cohort.length}
              />
              <FunnelRow
                label="Mimos utilizados"
                value={
                  metrics.redemptions.filter((redemption) =>
                    metrics.cohort.some((p) => p.id === redemption.user_id),
                  ).length
                }
                base={metrics.cohort.length}
              />
            </div>
          </section>

          <section className="card-festa p-5">
            <p className="section-kicker text-muted-foreground">Operação no período</p>
            <h2 className="mt-1 font-display text-2xl">Mimos e Resenha</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <CompactMetric label="Mimos liberados" value={metrics.rewards.length} icon={Gift} />
              <CompactMetric
                label="Mimos utilizados"
                value={metrics.redemptions.length}
                icon={Check}
              />
              <CompactMetric
                label="Pessoas na Resenha"
                value={metrics.chatParticipants.size}
                icon={Users}
              />
              <CompactMetric
                label="Mensagens"
                value={metrics.chatMessages.length}
                icon={MessageCircleMore}
              />
            </div>
            {metrics.chatReports.length > 0 && (
              <div className="mt-4 flex items-center gap-2 rounded-2xl bg-destructive/10 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {metrics.chatReports.length} denúncia(s) no período.
              </div>
            )}
          </section>
        </div>

        {goalProgress && activePilot && (
          <section className="mt-5 card-festa overflow-hidden">
            <div className="bg-electric px-5 py-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.18em]">Metas do piloto</p>
              <h2 className="mt-1 font-display text-2xl">{activePilot.name}</h2>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <GoalCard label="Cadastros" {...goalProgress.registrations} />
              <GoalCard label="Check-ins" {...goalProgress.checkins} />
              <GoalCard label="Mimos utilizados" {...goalProgress.redemptions} />
            </div>
          </section>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className="card-festa p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="section-kicker text-muted-foreground">Comparação</p>
              <h2 className="mt-1 font-display text-2xl">Resultados por evento</h2>
            </div>
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-[10px] uppercase tracking-[0.13em] text-muted-foreground">
                <tr>
                  <th className="pb-3">Evento</th>
                  <th className="pb-3 text-center">Cadastros*</th>
                  <th className="pb-3 text-center">Check-ins</th>
                  <th className="pb-3 text-center">Mimos</th>
                  <th className="pb-3 text-center">Uso</th>
                  <th className="pb-3 text-center">Resenha</th>
                  <th className="pb-3 text-center">Recorrentes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {eventMetrics.map((item) => (
                  <tr key={item.event.id}>
                    <td className="py-3 pr-4">
                      <p className="font-bold">{item.event.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(item.event.starts_at)}
                      </p>
                    </td>
                    <td className="py-3 text-center">{item.registrations}</td>
                    <td className="py-3 text-center font-black">{item.checkins}</td>
                    <td className="py-3 text-center">{item.rewards}</td>
                    <td className="py-3 text-center">{item.redemptions}</td>
                    <td className="py-3 text-center">
                      {item.participants} / {item.messages}
                    </td>
                    <td className="py-3 text-center">{item.recurring}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            * Cadastros realizados entre sete dias antes e o encerramento estimado do evento.
          </p>
        </div>

        <div className="card-festa p-5">
          <p className="section-kicker text-muted-foreground">Qualidade dos dados</p>
          <h2 className="mt-1 font-display text-2xl">Onde o perfil trava</h2>
          <div className="mt-5 space-y-3">
            {[...profileHealth]
              .sort((a, b) => b.missing - a.missing)
              .slice(0, 7)
              .map((field) => (
                <div key={field.label}>
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="font-bold">{field.label}</span>
                    <span className="text-muted-foreground">{field.missing} pendente(s)</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${field.percent}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <PreferenceCard title="Rolês preferidos" items={topPreferences.events} />
        <PreferenceCard title="Bebidas preferidas" items={topPreferences.drinks} />
        <PreferenceCard title="Comidas preferidas" items={topPreferences.foods} />
      </section>

      <section className="card-festa p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker text-muted-foreground">Arquivos para análise</p>
            <h2 className="mt-1 font-display text-2xl">Exportar CSV</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Os arquivos respeitam o período e o evento selecionados acima. Cada exportação fica
              registrada na auditoria.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["clients", "Clientes"],
                ["checkins", "Check-ins"],
                ["campaigns", "Campanhas"],
                ["events", "Eventos"],
              ] as Array<[ExportKind, string]>
            ).map(([kind, label]) => (
              <Button
                key={kind}
                variant="outline"
                onClick={() => void exportCsv(kind)}
                disabled={Boolean(exporting)}
              >
                {exporting === kind ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker text-muted-foreground">Preparação do primeiro ciclo</p>
            <h2 className="mt-1 font-display text-4xl">Piloto</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Defina metas, evento, campanha, equipe e instruções antes de colocar clientes reais no
              fluxo.
            </p>
          </div>
          <Button variant="outline" onClick={newPilot}>
            <Flag className="h-4 w-4" /> Nova configuração
          </Button>
        </div>

        <div className="grid gap-5 xl:grid-cols-[260px_1fr]">
          <aside className="card-festa p-4">
            <div className="flex items-center justify-between">
              <p className="font-black">Rodadas</p>
              {pilotLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
            <div className="mt-3 space-y-2">
              {pilots.map((pilot) => (
                <button
                  key={pilot.id}
                  type="button"
                  onClick={() => choosePilot(pilot)}
                  className={`w-full rounded-2xl border-2 p-3 text-left transition ${pilotDraft.id === pilot.id ? "border-foreground bg-mango/55" : "border-transparent bg-muted hover:border-foreground/20"}`}
                >
                  <p className="line-clamp-2 text-sm font-black">{pilot.name}</p>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    <span>{pilotStatusLabel(pilot.status)}</span>
                    {pilot.started_at && (
                      <span>{new Date(pilot.started_at).toLocaleDateString("pt-BR")}</span>
                    )}
                  </div>
                </button>
              ))}
              {!pilotLoading && pilots.length === 0 && (
                <p className="rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
                  Nenhum piloto configurado.
                </p>
              )}
            </div>
          </aside>

          <div className="space-y-5">
            <div className="card-festa p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label="Nome do ciclo">
                  <Input
                    value={pilotDraft.name}
                    onChange={(event) =>
                      setPilotDraft((value) => ({ ...value, name: event.target.value }))
                    }
                  />
                </FormField>
                <FormField label="Evento">
                  <select
                    value={pilotDraft.eventId}
                    onChange={(event) =>
                      setPilotDraft((value) => ({
                        ...value,
                        eventId: event.target.value,
                        campaignId: "",
                      }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Selecione o evento</option>
                    {data.events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Campanha principal">
                  <select
                    value={pilotDraft.campaignId}
                    onChange={(event) =>
                      setPilotDraft((value) => ({ ...value, campaignId: event.target.value }))
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Sem campanha vinculada</option>
                    {pilotCampaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Público esperado">
                  <NumberInput
                    value={pilotDraft.expectedAttendance}
                    onChange={(value) =>
                      setPilotDraft((draft) => ({ ...draft, expectedAttendance: value }))
                    }
                  />
                </FormField>
                <FormField label="Meta de cadastros">
                  <NumberInput
                    value={pilotDraft.targetRegistrations}
                    onChange={(value) =>
                      setPilotDraft((draft) => ({ ...draft, targetRegistrations: value }))
                    }
                  />
                </FormField>
                <FormField label="Meta de check-ins">
                  <NumberInput
                    value={pilotDraft.targetCheckins}
                    onChange={(value) =>
                      setPilotDraft((draft) => ({ ...draft, targetCheckins: value }))
                    }
                  />
                </FormField>
                <FormField label="Meta de mimos utilizados">
                  <NumberInput
                    value={pilotDraft.targetRedemptions}
                    onChange={(value) =>
                      setPilotDraft((draft) => ({ ...draft, targetRedemptions: value }))
                    }
                  />
                </FormField>
                <FormField label="Perfil mínimo exigido (%)">
                  <NumberInput
                    min={0}
                    max={100}
                    value={pilotDraft.minimumProfilePercent}
                    onChange={(value) =>
                      setPilotDraft((draft) => ({ ...draft, minimumProfilePercent: value }))
                    }
                  />
                </FormField>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <FormField label="Roteiro de comunicação do piloto">
                  <Textarea
                    rows={4}
                    value={pilotDraft.customerInstructions}
                    onChange={(event) =>
                      setPilotDraft((value) => ({
                        ...value,
                        customerInstructions: event.target.value,
                      }))
                    }
                  />
                </FormField>
                <FormField label="Notas internas">
                  <Textarea
                    rows={4}
                    value={pilotDraft.internalNotes}
                    onChange={(event) =>
                      setPilotDraft((value) => ({ ...value, internalNotes: event.target.value }))
                    }
                  />
                </FormField>
              </div>

              <div className="mt-5">
                <Label>Equipe escalada no piloto</Label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {staffProfiles.map((profile) => {
                    const checked = pilotDraft.staffIds.includes(profile.id);
                    return (
                      <label
                        key={profile.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 ${checked ? "border-primary bg-primary/10" : "border-input"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setPilotDraft((draft) => ({
                              ...draft,
                              staffIds: checked
                                ? draft.staffIds.filter((id) => id !== profile.id)
                                : [...draft.staffIds, profile.id],
                            }))
                          }
                        />
                        <span className="text-sm font-bold">{profile.display_name}</span>
                      </label>
                    );
                  })}
                  {staffProfiles.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Conceda acesso de equipe antes de configurar o piloto.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => void savePilot()} disabled={pilotSaving}>
                  {pilotSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar piloto
                </Button>
                {pilotDraft.id && pilotDraft.status === "preparing" && (
                  <Button
                    variant="outline"
                    onClick={() => void transitionPilot("ready")}
                    disabled={pilotSaving}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Marcar como pronto
                  </Button>
                )}
                {pilotDraft.id && ["preparing", "ready"].includes(pilotDraft.status) && (
                  <Button onClick={() => void transitionPilot("running")} disabled={pilotSaving}>
                    <Rocket className="h-4 w-4" /> Iniciar piloto
                  </Button>
                )}
                {pilotDraft.id && pilotDraft.status === "running" && (
                  <Button
                    variant="outline"
                    onClick={() => void transitionPilot("finished")}
                    disabled={pilotSaving}
                  >
                    <Flag className="h-4 w-4" /> Encerrar piloto
                  </Button>
                )}
              </div>
            </div>

            <div className="card-festa p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="section-kicker text-muted-foreground">Checklist operacional</p>
                  <h3 className="mt-1 font-display text-2xl">
                    {readyCount} de {readiness.length} prontos
                  </h3>
                </div>
                <div
                  className={`grid h-12 w-12 place-items-center rounded-full ${readyCount === readiness.length ? "bg-primary text-white" : "bg-mango"}`}
                >
                  {readyCount === readiness.length ? (
                    <Check className="h-6 w-6" />
                  ) : (
                    <Target className="h-6 w-6" />
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {readiness.map((item) => (
                  <div
                    key={item.label}
                    className={`flex gap-3 rounded-2xl border-2 p-3 ${item.ok ? "border-primary/25 bg-primary/5" : "border-mango bg-mango/15"}`}
                  >
                    {item.ok ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-orange-600" />
                    )}
                    <div>
                      <p className="text-sm font-black">{item.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  copy,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  copy?: string;
  tone: "mango" | "green" | "blue" | "pink";
}) {
  const tones = {
    mango: "bg-mango",
    green: "bg-primary text-white",
    blue: "bg-electric text-white",
    pink: "bg-secondary",
  };
  return (
    <div className="sticker-card bg-card p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-full ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl">{value}</p>
      {copy && <p className="mt-1 text-xs text-muted-foreground">{copy}</p>}
    </div>
  );
}

function FunnelRow({ label, value, base }: { label: string; value: number; base: number }) {
  const width = base > 0 ? Math.max(4, Math.min(100, (value / base) * 100)) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold">{label}</span>
        <span className="font-display text-xl">{value}</span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
      <p className="mt-1 text-right text-[10px] text-muted-foreground">
        {base > 0 ? `${Math.round((value / base) * 100)}% da base` : "Sem base no período"}
      </p>
    </div>
  );
}

function CompactMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Gift;
}) {
  return (
    <div className="rounded-2xl bg-muted p-4">
      <Icon className="h-4 w-4 text-primary" />
      <p className="mt-3 font-display text-3xl">{value}</p>
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
    </div>
  );
}

function GoalCard({
  label,
  current,
  target,
  percentValue,
}: {
  label: string;
  current: number;
  target: number;
  percentValue: number;
}) {
  return (
    <div className="rounded-2xl border border-input p-4">
      <div className="flex justify-between gap-3">
        <span className="text-sm font-bold">{label}</span>
        <span className="font-display text-xl">
          {current}/{target}
        </span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percentValue}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{percentValue}% da meta</p>
    </div>
  );
}

function PreferenceCard({ title, items }: { title: string; items: Array<[string, number]> }) {
  return (
    <div className="card-festa p-5">
      <p className="section-kicker text-muted-foreground">Preferências</p>
      <h3 className="mt-1 font-display text-2xl">{title}</h3>
      <div className="mt-4 space-y-2">
        {items.map(([label, count], index) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3"
          >
            <span className="text-sm font-bold">
              {index + 1}. {label}
            </span>
            <span className="cut-label bg-background">{count}</span>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground">Ainda sem respostas suficientes.</p>
        )}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min = 0,
  max,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <Input
      type="number"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
    />
  );
}

function pilotToDraft(pilot: PilotRow): PilotDraft {
  return {
    id: pilot.id,
    name: pilot.name,
    eventId: pilot.event_id,
    campaignId: pilot.campaign_id ?? "",
    status: pilot.status,
    expectedAttendance: pilot.expected_attendance,
    targetRegistrations: pilot.target_registrations,
    targetCheckins: pilot.target_checkins,
    targetRedemptions: pilot.target_redemptions,
    minimumProfilePercent: pilot.minimum_profile_percent,
    staffIds: pilot.staff_ids,
    customerInstructions: pilot.customer_instructions ?? "",
    internalNotes: pilot.internal_notes ?? "",
  };
}

function buildReadiness(
  draft: PilotDraft,
  event: EventRow | null,
  campaign: CampaignRow | null,
  staff: ProfileRow[],
) {
  const staffSet = new Set(staff.map((profile) => profile.id));
  return [
    {
      label: "Evento escolhido",
      ok: Boolean(event),
      detail: event ? event.name : "Escolha o evento principal.",
    },
    {
      label: "Evento publicado",
      ok: Boolean(event && ["published", "ongoing"].includes(event.status)),
      detail: event ? `Status atual: ${event.status}.` : "Publique o evento antes do piloto.",
    },
    {
      label: "Janela de check-in",
      ok: Boolean(event?.checkin_enabled && event.checkin_opens_at && event.checkin_closes_at),
      detail: event?.checkin_enabled
        ? "Abertura e encerramento precisam estar definidos."
        : "Ative o check-in no evento.",
    },
    {
      label: "Campanha configurada",
      ok: Boolean(campaign && campaign.status !== "ended"),
      detail: campaign
        ? `${campaign.name} · ${campaign.status}`
        : "Selecione a campanha principal.",
    },
    {
      label: "Quantidade de mimos",
      ok: Boolean(
        campaign?.total_available &&
        campaign.total_available >= Math.max(1, draft.targetRedemptions),
      ),
      detail: campaign?.total_available
        ? `${campaign.total_available} unidades configuradas.`
        : "Defina o limite total da campanha.",
    },
    {
      label: "Equipe escalada",
      ok: draft.staffIds.length > 0 && draft.staffIds.every((id) => staffSet.has(id)),
      detail:
        draft.staffIds.length > 0
          ? `${draft.staffIds.length} pessoa(s) selecionada(s).`
          : "Selecione ao menos uma pessoa da equipe.",
    },
    {
      label: "Instruções claras",
      ok: draft.customerInstructions.trim().length >= 20,
      detail: "Explique cadastro, check-in e resgate em linguagem simples.",
    },
    {
      label: "Metas definidas",
      ok: draft.targetRegistrations > 0 && draft.targetCheckins > 0 && draft.targetRedemptions > 0,
      detail: "Cadastros, check-ins e resgates precisam de meta.",
    },
  ];
}

function jsonToRows(value: Json | null): Array<Record<string, Json | undefined>> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Record<string, Json | undefined> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item),
  );
}

function downloadCsv(rows: Array<Record<string, Json | undefined>>, filename: string) {
  if (rows.length === 0) {
    toast.info("Não há linhas para exportar com os filtros atuais.");
    return;
  }
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const escape = (value: Json | undefined) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = [
    headers.join(";"),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(";")),
  ].join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function percent(value: number, total: number) {
  return total > 0
    ? `${Math.round((value / total) * 100)}% dos cadastros`
    : "Sem cadastros no período";
}

function goal(current: number, target: number) {
  return {
    current,
    target,
    percentValue: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0,
  };
}

function pilotStatusLabel(status: PilotRow["status"]) {
  return (
    (
      {
        preparing: "Preparando",
        ready: "Pronto",
        running: "Em andamento",
        finished: "Encerrado",
        cancelled: "Cancelado",
      } as Record<string, string>
    )[status] ?? status
  );
}
