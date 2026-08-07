import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  Gift,
  History,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Target,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/app-shell";
import { ErrorCard, LoadingCard } from "@/components/ui/async-state";
import { SecureQr } from "@/components/operations/secure-qr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { campaignBenefitLabel, formatDateTime } from "@/lib/bafafa";
import { publicErrorMessage } from "@/lib/public-error";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/mimos")({ component: Fofoquinhas });

type Fofoquinha = {
  campaign_id: string;
  name: string;
  description: string | null;
  benefit_type: string;
  discount_percent: number | null;
  fixed_off_cents: number | null;
  product_name: string | null;
  public_rules: string | null;
  campaign_kind: string;
  trigger_type: string;
  trigger_target: number;
  progress_value: number;
  completed: boolean;
  reward_id: string | null;
  reward_status: string | null;
  reward_expires_at: string | null;
  starts_at: string;
  ends_at: string | null;
  is_pinned: boolean;
  feed_priority: number;
  public_title?: string | null;
  public_copy?: string | null;
  activation_expires_at?: string | null;
  visit_scope?: string;
  home_sort_order?: number | null;
  home_visible?: boolean;
  redemption_mode?: "app" | "external" | "both";
  external_url?: string | null;
  external_button_label?: string;
  external_open_new_tab?: boolean;
};

type HistoryRow = {
  id: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  campaigns: {
    name: string;
    description: string | null;
    benefit_type: string;
    discount_percent: number | null;
    fixed_off_cents: number | null;
    product_name: string | null;
  } | null;
};

type TokenResult = { token: string; short_code: string; expires_at: string };
type Tab = "available" | "missions" | "history";

type FofoquinhasSnapshot = { items: Fofoquinha[]; history: HistoryRow[] };
const FOFOQUINHAS_CACHE_WINDOW_MS = 15 * 1000;
const fofoquinhasCache = new Map<
  string,
  { value?: FofoquinhasSnapshot; expiresAt: number; request?: Promise<FofoquinhasSnapshot> }
>();

async function fetchFofoquinhas(): Promise<FofoquinhasSnapshot> {
  await supabase.rpc("refresh_my_reward_statuses");
  const [fofoquinhas, rewards] = await Promise.all([
    supabase.rpc("my_fofoquinhas"),
    supabase
      .from("user_rewards")
      .select(
        "id,status,expires_at,created_at,campaigns(name,description,benefit_type,discount_percent,fixed_off_cents,product_name)",
      )
      .in("status", ["redeemed", "expired", "revoked"])
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const firstError = fofoquinhas.error ?? rewards.error;
  if (firstError) throw firstError;

  return {
    items: ((fofoquinhas.data ?? []) as Fofoquinha[]).filter(
      (item) => item.campaign_kind !== "event" && item.campaign_kind !== "funnel",
    ),
    history: (rewards.data ?? []) as unknown as HistoryRow[],
  };
}

function loadFofoquinhas(userId: string, force = false): Promise<FofoquinhasSnapshot> {
  const cached = fofoquinhasCache.get(userId);
  if (!force && cached?.value && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value);
  }
  if (cached?.request) return cached.request;

  const request = fetchFofoquinhas()
    .then((value) => {
      fofoquinhasCache.set(userId, {
        value,
        expiresAt: Date.now() + FOFOQUINHAS_CACHE_WINDOW_MS,
      });
      return value;
    })
    .catch((error) => {
      fofoquinhasCache.delete(userId);
      throw error;
    });
  fofoquinhasCache.set(userId, {
    value: cached?.value,
    expiresAt: cached?.expiresAt ?? 0,
    request,
  });
  return request;
}

function Fofoquinhas() {
  const { user } = useAuth();
  const [items, setItems] = useState<Fofoquinha[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [tab, setTab] = useState<Tab>("available");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<Fofoquinha | null>(null);
  const [token, setToken] = useState<TokenResult | null>(null);
  const [tokenItem, setTokenItem] = useState<Fofoquinha | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const snapshot = await loadFofoquinhas(user.id, force);
        setItems(snapshot.items);
        setHistory(snapshot.history);
      } catch (loadError) {
        setError(publicErrorMessage(loadError, "Não foi possível carregar as Fofoquinhas."));
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => void load(false), [load]);

  const available = useMemo(
    () => items.filter((item) => item.reward_id && item.reward_status === "available"),
    [items],
  );
  const missions = useMemo(
    () => items.filter((item) => item.campaign_kind === "milestone" && !item.reward_id),
    [items],
  );
  const generalPromos = useMemo(
    () => items.filter((item) => item.campaign_kind !== "milestone" && !item.reward_id),
    [items],
  );

  async function generateCode(item: Fofoquinha) {
    if (!item.reward_id || generating) return;
    setGenerating(true);

    try {
      const { data, error: rpcError } = await supabase.rpc("create_my_qr_token", {
        _purpose: "redemption",
        _ref_id: item.reward_id,
      });

      if (rpcError) {
        toast.error(publicErrorMessage(rpcError, "Não foi possível gerar o código."));
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.token || !row.short_code || !row.expires_at) {
        toast.error("Não foi possível gerar o código. Tente novamente.");
        return;
      }

      setToken(row as TokenResult);
      setTokenItem(item);
    } catch (qrGenerationError) {
      console.error("Erro ao gerar QR da Fofoquinha", qrGenerationError);
      toast.error("Não foi possível gerar o código. Tente novamente.");
    } finally {
      setGenerating(false);
    }
  }

  function openExternalPromotion(item: Fofoquinha) {
    if (!item.external_url) return;
    void supabase
      .rpc("track_campaign_external_click", {
        _campaign_id: item.campaign_id,
        _source: "fofoquinhas",
      })
      .then(({ error: trackingError }) => {
        if (trackingError)
          console.warn("Não foi possível registrar o clique:", trackingError.message);
      });

    if (item.external_open_new_tab ?? true) {
      window.open(item.external_url, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(item.external_url);
    }
  }

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Vantagens do clube"
        title="Fofoquinhas"
        tone="green"
        meta={
          <>
            <Gift className="h-3.5 w-3.5" /> Promoções, missões e vantagens do clube
          </>
        }
        action={
          <button
            type="button"
            onClick={() => void load(true)}
            aria-label="Atualizar"
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-background text-foreground shadow-[2px_3px_0_var(--foreground)]"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        }
      />

      <div className="px-5 pt-2">
        <p className="mb-5 text-sm font-semibold text-muted-foreground">
          Aqui, as promoções viram Fofoquinhas: vantagens liberadas, ofertas abertas e missões para
          ganhar benefícios no Bafafá.
        </p>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-foreground/15 bg-muted p-1.5">
          <TabButton
            active={tab === "available"}
            onClick={() => setTab("available")}
            icon={Gift}
            label="Disponíveis"
            count={available.length}
          />
          <TabButton
            active={tab === "missions"}
            onClick={() => setTab("missions")}
            icon={Target}
            label="Missões"
            count={missions.length + generalPromos.length}
          />
          <TabButton
            active={tab === "history"}
            onClick={() => setTab("history")}
            icon={History}
            label="Histórico"
            count={history.length}
          />
        </div>
      </div>

      {loading && <LoadingCard label="Apurando as Fofoquinhas…" />}
      {error && <ErrorCard message={error} />}

      {!loading && !error && (
        <div className="space-y-4 px-5 pt-5">
          {tab === "available" &&
            (available.length === 0 ? (
              <Empty
                icon={Gift}
                title="Nada liberado agora"
                copy="Continue participando das missões e acompanhando o Bafafá. A próxima vantagem aparece aqui."
              />
            ) : (
              available.map((item) => (
                <RewardCard
                  key={item.campaign_id}
                  item={item}
                  onUse={() => setConfirmItem(item)}
                  onExternal={() => openExternalPromotion(item)}
                />
              ))
            ))}

          {tab === "missions" &&
            (missions.length === 0 && generalPromos.length === 0 ? (
              <Empty
                icon={Target}
                title="Nenhuma missão ativa"
                copy="Quando o Bafafá lançar um novo desafio, o seu progresso aparece aqui."
              />
            ) : (
              <>
                {missions.map((item) => (
                  <MissionCard key={item.campaign_id} item={item} />
                ))}
                {generalPromos.map((item) => (
                  <article
                    key={item.campaign_id}
                    className="content-card content-card--promotion p-5 text-foreground"
                  >
                    <span className="cut-label bg-white">promoção aberta</span>
                    <h2 className="mt-5 font-display text-3xl leading-none">
                      {item.public_title || item.name}
                    </h2>
                    <p className="mt-3 font-poster text-lg">{campaignBenefitLabel(item)}</p>
                    {item.description && (
                      <p className="mt-2 text-sm font-semibold opacity-70">{item.description}</p>
                    )}
                    {item.public_rules && (
                      <p className="mt-4 rounded-xl bg-white/70 p-3 text-xs font-semibold">
                        {item.public_rules}
                      </p>
                    )}
                    {item.redemption_mode !== "app" && item.external_url && (
                      <div className="mt-5">
                        <button
                          type="button"
                          onClick={() => openExternalPromotion(item)}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
                        >
                          {item.external_button_label || "Abrir site"}
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <p className="mt-3 text-xs font-semibold text-foreground/80">
                          Abre no site indicado. Registramos apenas o clique; a confirmação acontece
                          fora do app.
                        </p>
                      </div>
                    )}
                  </article>
                ))}
              </>
            ))}

          {tab === "history" &&
            (history.length === 0 ? (
              <Empty
                icon={History}
                title="Seu histórico começa aqui"
                copy="Fofoquinhas utilizadas e expiradas ficarão guardadas nesta área."
              />
            ) : (
              history.map((row) => (
                <article
                  key={row.id}
                  className="content-card flex items-center gap-3 bg-card p-4 opacity-75"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-foreground/20 bg-muted">
                    {row.status === "redeemed" ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <Clock3 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{row.campaigns?.name ?? "Fofoquinha"}</p>
                    <p className="text-xs font-semibold text-muted-foreground">
                      {row.status === "redeemed"
                        ? "Utilizada"
                        : row.status === "expired"
                          ? "Expirada"
                          : "Encerrada"}{" "}
                      · {formatDateTime(row.created_at)}
                    </p>
                  </div>
                </article>
              ))
            ))}
        </div>
      )}

      <Dialog open={Boolean(confirmItem)} onOpenChange={(open) => !open && setConfirmItem(null)}>
        <DialogContent className="bafafa-dialog max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Usar esta Fofoquinha?</DialogTitle>
            <DialogDescription>
              Ative somente quando estiver perto da equipe. Depois da ativação, começa o prazo curto
              de uso informado na Fofoquinha.
            </DialogDescription>
          </DialogHeader>
          {confirmItem && <RewardSummary item={confirmItem} />}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>
              Agora não
            </Button>
            <Button
              disabled={generating}
              onClick={() => {
                if (!confirmItem) return;
                const item = confirmItem;
                setConfirmItem(null);
                void generateCode(item);
              }}
            >
              <Sparkles className="h-4 w-4" /> {generating ? "Ativando…" : "Ativar Fofoquinha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(token)}
        onOpenChange={(open) => {
          if (!open) {
            setToken(null);
            setTokenItem(null);
          }
        }}
      >
        <DialogContent className="bafafa-dialog max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl">Fofoquinha ativada</DialogTitle>
            <DialogDescription>
              Mostre este código para a equipe antes do prazo terminar.
            </DialogDescription>
          </DialogHeader>
          {token && (
            <div>
              <SecureQr
                value={token.token}
                shortCode={token.short_code}
                expiresAt={token.expires_at}
                size={220}
              />
              <p className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-muted-foreground">
                <LockKeyhole className="h-3.5 w-3.5" /> Código temporário e de uso único
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Gift;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-2 py-2 text-xs font-black ${active ? "border-2 border-foreground bg-background shadow-[2px_2px_0_var(--foreground)]" : "text-muted-foreground"}`}
    >
      <Icon className="mx-auto mb-1 h-4 w-4" /> {label} <span className="opacity-60">{count}</span>
    </button>
  );
}

function RewardCard({
  item,
  onUse,
  onExternal,
}: {
  item: Fofoquinha;
  onUse: () => void;
  onExternal: () => void;
}) {
  const appEnabled = item.redemption_mode !== "external";
  const externalEnabled = item.redemption_mode !== "app" && Boolean(item.external_url);
  return (
    <article className="content-card content-card--promotion p-5 text-foreground">
      <span className="cut-label bg-white">liberada pra você</span>
      <h2 className="mt-5 font-display text-4xl leading-none">{item.public_title || item.name}</h2>
      <p className="mt-3 font-poster text-xl">{campaignBenefitLabel(item)}</p>
      {(item.public_copy || item.description) && (
        <p className="mt-2 text-sm font-semibold opacity-70">
          {item.public_copy || item.description}
        </p>
      )}
      {item.reward_expires_at && (
        <p className="mt-4 text-xs font-black">
          Válida até {formatDateTime(item.reward_expires_at)}
        </p>
      )}
      <div className={`mt-5 grid gap-2 ${appEnabled && externalEnabled ? "sm:grid-cols-2" : ""}`}>
        {appEnabled && (
          <button
            type="button"
            onClick={onUse}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
          >
            Usar minha Fofoquinha <Gift className="h-4 w-4" />
          </button>
        )}
        {externalEnabled && (
          <button
            type="button"
            onClick={onExternal}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-4 py-3 text-sm font-black"
          >
            {item.external_button_label || "Abrir site"}
            <ExternalLink className="h-4 w-4" />
          </button>
        )}
      </div>
      {externalEnabled && (
        <p className="mt-3 text-xs font-semibold text-muted-foreground">
          Abre no site indicado. Registramos apenas o clique; a confirmação acontece fora do app.
        </p>
      )}
    </article>
  );
}

function MissionCard({ item }: { item: Fofoquinha }) {
  const progress = Math.min(
    100,
    Math.round((item.progress_value / Math.max(item.trigger_target, 1)) * 100),
  );
  return (
    <article className="content-card content-card--mission p-5 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker text-foreground/65">Missão do clube</p>
          <h2 className="mt-1 font-display text-3xl leading-none">
            {item.public_title || item.name}
          </h2>
        </div>
        <Target className="h-7 w-7 shrink-0 text-foreground" />
      </div>
      {item.description && (
        <p className="mt-3 text-sm font-semibold text-foreground/70">{item.description}</p>
      )}
      <p className="mt-3 font-poster text-base">Recompensa: {campaignBenefitLabel(item)}</p>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-black">
          <span>
            {item.progress_value} de {item.trigger_target}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-4 overflow-hidden rounded-full border-2 border-foreground bg-white/65">
          <div className="h-full bg-foreground" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {item.public_rules && (
        <p className="mt-4 rounded-xl bg-white/65 p-3 text-xs font-semibold text-foreground/75">
          {item.public_rules}
        </p>
      )}
    </article>
  );
}

function RewardSummary({ item }: { item: Fofoquinha }) {
  return (
    <div className="content-card content-card--promotion p-4 text-left text-foreground">
      <p className="font-display text-2xl leading-none">{item.public_title || item.name}</p>
      <p className="mt-2 text-sm font-black">{campaignBenefitLabel(item)}</p>
    </div>
  );
}

function Empty({ icon: Icon, title, copy }: { icon: typeof Gift; title: string; copy: string }) {
  return (
    <section className="content-card bg-card p-6 text-center">
      <Icon className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 font-display text-3xl leading-none">{title}</h2>
      <p className="mt-3 text-sm font-semibold text-muted-foreground">{copy}</p>
    </section>
  );
}
