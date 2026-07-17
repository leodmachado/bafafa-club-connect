import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  DatabaseBackup,
  ExternalLink,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";

type Summary = {
  open_events: number;
  critical_open: number;
  high_open: number;
  events_24h: number;
  controls_complete: number;
  controls_required: number;
  privileged_accounts: number;
};

type PostureItem = { key: string; label: string; ok: boolean };

type SecurityControl = {
  control_key: string;
  category: string;
  label: string;
  description: string;
  required: boolean;
  completed: boolean;
  evidence: string | null;
  notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type SecurityEvent = {
  id: string;
  severity: "info" | "low" | "medium" | "high" | "critical";
  category: string;
  event_key: string;
  title: string;
  actor_id: string | null;
  target_user_id: string | null;
  entity: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
};

type PrivilegedUser = {
  user_id: string;
  role: string;
  display_name: string | null;
  username: string | null;
  last_sign_in_at: string | null;
  created_at: string | null;
  verified_mfa_factors: number;
};

type ExportEvent = {
  id: string;
  actor_id: string | null;
  created_at: string;
  details: Record<string, unknown> | null;
};

type SecuritySnapshot = {
  generated_at: string;
  summary: Summary;
  posture: PostureItem[];
  controls: SecurityControl[];
  recent_events: SecurityEvent[];
  privileged_users: PrivilegedUser[];
  recent_exports: ExportEvent[];
};

const EMPTY_SUMMARY: Summary = {
  open_events: 0,
  critical_open: 0,
  high_open: 0,
  events_24h: 0,
  controls_complete: 0,
  controls_required: 0,
  privileged_accounts: 0,
};

export function SecurityDashboard() {
  const [snapshot, setSnapshot] = useState<SecuritySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("admin_security_snapshot");
    setLoading(false);
    if (error) {
      toast.error(publicErrorMessage(error));
      return;
    }
    setSnapshot((data ?? null) as unknown as SecuritySnapshot | null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const events = useMemo(() => {
    const rows = snapshot?.recent_events ?? [];
    return showResolved ? rows : rows.filter((item) => !item.resolved_at);
  }, [showResolved, snapshot]);

  async function toggleControl(control: SecurityControl) {
    const evidence = window.prompt(
      control.completed
        ? "Ao reabrir, a evidência anterior será mantida. Observação opcional:"
        : "Registre uma evidência curta (ex.: data, responsável ou configuração revisada):",
      control.evidence ?? "",
    );
    if (evidence === null) return;

    setWorking(control.control_key);
    const { error } = await supabase.rpc("admin_set_security_control", {
      _control_key: control.control_key,
      _completed: !control.completed,
      _evidence: evidence || null,
      _notes: control.notes,
    });
    setWorking(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(control.completed ? "Controle reaberto." : "Controle marcado como concluído.");
    await load();
  }

  async function resolveEvent(event: SecurityEvent) {
    const note = window.prompt("Como esse evento foi verificado ou resolvido?", "");
    if (note === null) return;
    setWorking(event.id);
    const { error } = await supabase.rpc("admin_resolve_security_event", {
      _event_id: event.id,
      _resolution_note: note || null,
    });
    setWorking(null);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Evento de segurança resolvido.");
    await load();
  }

  if (loading && !snapshot) {
    return (
      <div className="card-festa grid min-h-72 place-items-center p-8">
        <div className="text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">Conferindo a segurança…</p>
        </div>
      </div>
    );
  }

  const summary = snapshot?.summary ?? EMPTY_SUMMARY;
  const required = Math.max(summary.controls_required, 1);
  const completion = Math.round((summary.controls_complete / required) * 100);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker text-muted-foreground">Infraestrutura e continuidade</p>
          <h1 className="mt-1 font-display text-4xl leading-none sm:text-5xl">Segurança</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Acompanhe controles externos, contas privilegiadas, exportações e eventos que exigem
            atenção. Nenhuma senha ou token é armazenado aqui.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Eventos em aberto"
          value={summary.open_events}
          copy={`${summary.critical_open} crítico(s) · ${summary.high_open} alto(s)`}
          icon={ShieldAlert}
          tone={summary.critical_open ? "danger" : summary.high_open ? "warning" : "ok"}
        />
        <MetricCard
          label="Controles concluídos"
          value={`${completion}%`}
          copy={`${summary.controls_complete} de ${summary.controls_required}`}
          icon={ShieldCheck}
          tone={completion === 100 ? "ok" : "warning"}
        />
        <MetricCard
          label="Contas privilegiadas"
          value={summary.privileged_accounts}
          copy="Administração, moderação e equipe"
          icon={Users}
          tone="neutral"
        />
        <MetricCard
          label="Eventos nas últimas 24h"
          value={summary.events_24h}
          copy="Alterações relevantes registradas"
          icon={Clock3}
          tone="neutral"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <div className="card-festa p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="section-kicker text-muted-foreground">Verificação automática</p>
              <h2 className="mt-1 font-display text-2xl">Postura do banco</h2>
            </div>
            <DatabaseBackup className="h-6 w-6 text-primary" />
          </div>
          <div className="mt-4 space-y-2">
            {(snapshot?.posture ?? []).map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-2xl border border-input p-3"
              >
                <span className="text-sm font-bold">{item.label}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                    item.ok ? "bg-primary/15 text-primary" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {item.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    <AlertTriangle className="h-3.5 w-3.5" />
                  )}
                  {item.ok ? "OK" : "Revisar"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-festa p-5">
          <p className="section-kicker text-muted-foreground">Acesso privilegiado</p>
          <h2 className="mt-1 font-display text-2xl">Contas sensíveis</h2>
          <div className="mt-4 max-h-80 space-y-2 overflow-y-auto pr-1">
            {(snapshot?.privileged_users ?? []).map((user) => (
              <div
                key={`${user.user_id}-${user.role}`}
                className="rounded-2xl border border-input p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{user.display_name || "Usuário"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.username ? `@${user.username}` : user.user_id.slice(0, 8)}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-black uppercase">
                    {user.role}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <KeyRound className="h-3.5 w-3.5" /> {user.verified_mfa_factors} fator(es) MFA
                  </span>
                  <span>Último acesso: {formatDate(user.last_sign_in_at)}</span>
                </div>
              </div>
            ))}
            {(snapshot?.privileged_users ?? []).length === 0 && (
              <p className="rounded-2xl border border-dashed border-input p-6 text-center text-sm text-muted-foreground">
                Nenhuma conta privilegiada encontrada.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="card-festa p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker text-muted-foreground">Checklist externo</p>
            <h2 className="mt-1 font-display text-2xl">Controles operacionais</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Estes itens dependem das configurações do GitHub, Vercel e Supabase e são confirmados
              manualmente com evidência.
            </p>
          </div>
          <a
            href="/docs/INFRAESTRUTURA_CONTINUIDADE_V18.md"
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1 text-sm font-bold text-primary"
          >
            Abrir roteiro <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {(snapshot?.controls ?? []).map((control) => (
            <div
              key={control.control_key}
              className={`rounded-2xl border-2 p-4 ${
                control.completed
                  ? "border-primary/35 bg-primary/5"
                  : "border-foreground/15 bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {control.category}
                  </p>
                  <p className="mt-1 font-black">{control.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {control.description}
                  </p>
                </div>
                {control.completed ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 shrink-0 text-mango" />
                )}
              </div>
              {control.evidence && (
                <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs">
                  <strong>Evidência:</strong> {control.evidence}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {control.reviewed_at
                    ? `Revisto em ${formatDate(control.reviewed_at)}`
                    : "Ainda não revisto"}
                </span>
                <Button
                  size="sm"
                  variant={control.completed ? "outline" : "default"}
                  disabled={working === control.control_key}
                  onClick={() => void toggleControl(control)}
                >
                  {working === control.control_key && <Loader2 className="h-4 w-4 animate-spin" />}
                  {control.completed ? "Reabrir" : "Concluir"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card-festa p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-kicker text-muted-foreground">Monitoramento</p>
            <h2 className="mt-1 font-display text-2xl">Eventos de segurança</h2>
          </div>
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={showResolved}
              onChange={(event) => setShowResolved(event.target.checked)}
            />
            Mostrar resolvidos
          </label>
        </div>
        <div className="mt-5 space-y-3">
          {events.map((event) => (
            <div key={event.id} className="rounded-2xl border border-input p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityPill severity={event.severity} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      {event.category}
                    </span>
                    {event.resolved_at && (
                      <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold">
                        Resolvido
                      </span>
                    )}
                  </div>
                  <p className="mt-2 font-black">{event.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(event.occurred_at)} · {event.event_key}
                  </p>
                  {event.resolution_note && (
                    <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs">
                      <strong>Resolução:</strong> {event.resolution_note}
                    </p>
                  )}
                </div>
                {!event.resolved_at && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={working === event.id}
                    onClick={() => void resolveEvent(event)}
                  >
                    {working === event.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    Marcar resolvido
                  </Button>
                )}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <p className="rounded-2xl border border-dashed border-input p-8 text-center text-sm text-muted-foreground">
              Nenhum evento de segurança para exibir.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-3xl border-2 border-foreground bg-foreground p-5 text-background shadow-[5px_6px_0_var(--mango)]">
        <div className="flex items-start gap-3">
          <DatabaseBackup className="mt-0.5 h-6 w-6 shrink-0 text-mango" />
          <div>
            <h2 className="font-display text-2xl">Backup completo = banco + imagens</h2>
            <p className="mt-2 max-w-3xl text-sm text-background/75">
              O backup automático do Supabase cobre o banco, mas não restaura os arquivos físicos do
              Storage. Mantenha exportações separadas dos buckets e teste a restauração em outro
              projeto antes do piloto.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  copy,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  copy: string;
  icon: typeof ShieldCheck;
  tone: "ok" | "warning" | "danger" | "neutral";
}) {
  const toneClass = {
    ok: "bg-primary text-primary-foreground",
    warning: "bg-mango text-foreground",
    danger: "bg-destructive text-destructive-foreground",
    neutral: "bg-sky text-white",
  }[tone];
  return (
    <div className="sticker-card bg-card p-5">
      <div className={`grid h-11 w-11 place-items-center rounded-full ${toneClass}`}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{copy}</p>
    </div>
  );
}

function SeverityPill({ severity }: { severity: SecurityEvent["severity"] }) {
  const classes = {
    info: "bg-sky/15 text-sky",
    low: "bg-muted text-muted-foreground",
    medium: "bg-mango/25 text-foreground",
    high: "bg-brick/15 text-brick",
    critical: "bg-destructive text-destructive-foreground",
  }[severity];
  const label = {
    info: "Informativo",
    low: "Baixo",
    medium: "Médio",
    high: "Alto",
    critical: "Crítico",
  }[severity];
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${classes}`}>
      {label}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Fortaleza",
  }).format(new Date(value));
}
