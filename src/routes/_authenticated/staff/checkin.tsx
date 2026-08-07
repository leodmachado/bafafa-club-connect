import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CircleDollarSign,
  History,
  Keyboard,
  Loader2,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Wordmark } from "@/components/brand/wordmark";
import { QrScanner } from "@/components/operations/qr-scanner";
import { MfaGate } from "@/components/auth/mfa-security";
import { useAuth, hasRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/bafafa";
import { formatMoneyFromCents } from "@/lib/commercial";
import { publicErrorMessage } from "@/lib/public-error";

type EventRow = { id: string; name: string; starts_at: string; status: string };
type Product = {
  id: string;
  original_name: string;
  category: string;
  current_sale_price_cents: number;
  current_cost_cents: number;
  discount_eligible: boolean;
};
type CommercialCode = {
  ok: boolean;
  purpose: "customer" | "redemption";
  token: string;
  user_id: string;
  display_name: string;
  reward_id: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  discount_type: string | null;
  discount_percent: number | null;
  fixed_off_cents: number | null;
  discount_max_cents: number | null;
  activation_expires_at: string | null;
};
type CheckinResult = {
  ok: boolean;
  duplicate?: boolean;
  display_name?: string;
  event_name?: string;
  rewards_granted?: number;
};
type SaleResult = {
  ok: boolean;
  sale_id: string;
  user_id: string;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  funnel_net_cents: number;
  margin_cents: number;
  reward_redeemed: boolean;
};
type SaleLine = {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  unitCost: string;
};
type Mode = "checkin" | "sale";
type InputMode = "camera" | "manual";
type HistoryItem = {
  id: string;
  at: string;
  mode: Mode;
  success: boolean;
  title: string;
  detail: string;
};

export const Route = createFileRoute("/_authenticated/staff/checkin")({ component: StaffCheckin });

function StaffCheckin() {
  const { loading: authLoading, roles } = useAuth();
  const [mode, setMode] = useState<Mode>("checkin");
  const [inputMode, setInputMode] = useState<InputMode>("camera");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [eventId, setEventId] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [commercialCode, setCommercialCode] = useState<CommercialCode | null>(null);
  const [saleResult, setSaleResult] = useState<SaleResult | null>(null);
  const [lines, setLines] = useState<SaleLine[]>([emptyLine()]);
  const [externalReference, setExternalReference] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const allowed = hasRole(roles, "equipe", "admin");
  const selectedEvent = useMemo(
    () => events.find((item) => item.id === eventId) ?? null,
    [events, eventId],
  );

  const loadData = useCallback(async () => {
    if (!allowed) return;
    const [eventResult, productResult] = await Promise.all([
      supabase
        .from("events")
        .select("id,name,starts_at,status")
        .eq("checkin_enabled", true)
        .in("status", ["scheduled", "published", "ongoing"])
        .order("starts_at", { ascending: true }),
      supabase
        .from("products")
        .select(
          "id,original_name,category,current_sale_price_cents,current_cost_cents,discount_eligible",
        )
        .eq("active", true)
        .order("original_name"),
    ]);
    const error = eventResult.error ?? productResult.error;
    if (error) return toast.error(publicErrorMessage(error));
    const nextEvents = (eventResult.data ?? []) as EventRow[];
    setEvents(nextEvents);
    setEventId((current) =>
      nextEvents.some((item) => item.id === current) ? current : (nextEvents[0]?.id ?? ""),
    );
    setProducts((productResult.data ?? []) as Product[]);
  }, [allowed]);

  useEffect(() => void loadData(), [loadData]);

  const addHistory = useCallback((item: Omit<HistoryItem, "id" | "at">) => {
    setHistory((current) =>
      [{ ...item, id: crypto.randomUUID(), at: new Date().toISOString() }, ...current].slice(0, 10),
    );
  }, []);

  const feedback = useCallback((success: boolean) => {
    if (navigator.vibrate) navigator.vibrate(success ? 100 : [70, 50, 70]);
  }, []);

  const resetOperation = useCallback(() => {
    setFailure(null);
    setCode("");
    setCheckinResult(null);
    setCommercialCode(null);
    setSaleResult(null);
    setLines([emptyLine()]);
    setExternalReference("");
  }, []);

  const validateValue = useCallback(
    async (value: string) => {
      const clean = value.trim();
      if (!clean || submitting) return;
      if (!eventId) {
        toast.error("Selecione o evento da operação.");
        return;
      }
      setSubmitting(true);
      setFailure(null);
      setCheckinResult(null);
      setSaleResult(null);
      const response =
        mode === "checkin"
          ? await supabase.rpc("validate_checkin_qr", { _token: clean, _event_id: eventId })
          : await supabase.rpc("inspect_commercial_qr", { _token: clean });
      setSubmitting(false);

      if (response.error) {
        const message = publicErrorMessage(response.error, "Não foi possível validar o código.");
        setFailure(message);
        addHistory({ mode, success: false, title: "Código não validado", detail: message });
        feedback(false);
        toast.error(message);
        return;
      }

      setCode("");
      if (mode === "checkin") {
        const result = response.data as CheckinResult;
        setCheckinResult(result);
        addHistory({
          mode,
          success: true,
          title: result.display_name ?? "Bafafã",
          detail: result.event_name ?? "Check-in confirmado",
        });
        feedback(true);
        toast.success("Check-in validado.");
        return;
      }

      const inspected = response.data as CommercialCode;
      setCommercialCode(inspected);
      setLines([suggestedLine(inspected, products)]);
      feedback(true);
      toast.success(
        inspected.purpose === "redemption" ? "Fofoquinha identificada." : "Cliente identificado.",
      );
    },
    [addHistory, eventId, feedback, mode, products, submitting],
  );

  async function recordSale() {
    if (!commercialCode || !eventId || submitting) return;
    const validLines = lines.filter((line) => line.productId && line.quantity > 0);
    if (validLines.length === 0) return toast.error("Inclua pelo menos um produto.");
    setSubmitting(true);
    setFailure(null);
    const items = validLines.map((line) => ({
      product_id: line.productId,
      quantity: line.quantity,
      unit_price_cents: moneyToCents(
        line.unitPrice,
        products.find((item) => item.id === line.productId)?.current_sale_price_cents ?? 0,
      ),
      unit_cost_cents: moneyToCents(
        line.unitCost,
        products.find((item) => item.id === line.productId)?.current_cost_cents ?? 0,
      ),
    }));
    const { data, error } = await supabase.rpc("record_customer_sale", {
      _event_id: eventId,
      _items: items,
      _commercial_token: commercialCode.token,
      _external_reference: externalReference.trim() || undefined,
      _source: "manual",
      _service_fee_cents: 0,
      _tip_cents: 0,
      _couvert_cents: 0,
    });
    setSubmitting(false);
    if (error) {
      const message = publicErrorMessage(error, "Não foi possível registrar a compra.");
      setFailure(message);
      feedback(false);
      return toast.error(message);
    }
    const result = data as SaleResult;
    setSaleResult(result);
    addHistory({
      mode: "sale",
      success: true,
      title: commercialCode.display_name,
      detail: `${formatMoneyFromCents(result.net_cents)} líquidos${result.reward_redeemed ? " com Fofoquinha" : ""}`,
    });
    feedback(true);
    toast.success(
      result.reward_redeemed
        ? "Fofoquinha validada e compra registrada."
        : "Compra vinculada ao cliente.",
    );
  }

  if (authLoading) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!allowed) return <AccessDenied />;

  return (
    <MfaGate label="validação operacional">
      <div className="app-canvas mx-auto min-h-screen max-w-xl bg-background px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between">
          <Wordmark variant="short" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-card shadow-[2px_3px_0_var(--foreground)]"
              aria-label="Atualizar"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              to="/inicio"
              className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-card shadow-[2px_3px_0_var(--foreground)]"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <p className="mt-7 section-kicker text-muted-foreground">Operação do bar</p>
        <h1 className="mt-1 font-display text-4xl leading-none">Check-in e vendas</h1>
        <p className="mt-2 text-sm font-semibold text-muted-foreground">
          O QR identifica o cliente. A compra confirma o desconto, atualiza o CRM e avança o funil.
        </p>

        <div className="mt-5 grid grid-cols-2 rounded-2xl border-2 border-foreground bg-card p-1.5 text-sm font-black shadow-[3px_4px_0_var(--foreground)]">
          <ModeButton
            active={mode === "checkin"}
            onClick={() => {
              setMode("checkin");
              resetOperation();
            }}
            label="Check-in"
          />
          <ModeButton
            active={mode === "sale"}
            onClick={() => {
              setMode("sale");
              resetOperation();
            }}
            label="Venda e Fofoquinha"
            sale
          />
        </div>

        <section className="sticker-card mt-5 p-4">
          <label className="block">
            <span className="section-kicker text-muted-foreground">Evento da operação</span>
            <select
              value={eventId}
              onChange={(event) => {
                setEventId(event.target.value);
                resetOperation();
              }}
              className="mt-2 w-full rounded-xl border-2 border-foreground bg-surface px-4 py-3 font-black outline-none"
            >
              {events.length === 0 && <option value="">Nenhum evento aberto</option>}
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          {selectedEvent && (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              {formatDateTime(selectedEvent.starts_at)}
            </p>
          )}
        </section>

        {!commercialCode && !checkinResult && !saleResult && (
          <>
            <div className="mt-5 grid grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-black">
              <button
                type="button"
                onClick={() => setInputMode("camera")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 ${inputMode === "camera" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Camera className="h-4 w-4" /> Câmera
              </button>
              <button
                type="button"
                onClick={() => setInputMode("manual")}
                className={`inline-flex items-center justify-center gap-2 rounded-xl py-2.5 ${inputMode === "manual" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <Keyboard className="h-4 w-4" /> Digitar
              </button>
            </div>
            <section className="mt-4">
              {inputMode === "camera" ? (
                <QrScanner
                  active={!submitting}
                  busy={submitting}
                  onScan={validateValue}
                  onError={setFailure}
                />
              ) : (
                <div className="card-festa space-y-4 p-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-black">Código de 6 dígitos</span>
                    <input
                      value={code}
                      onChange={(event) =>
                        setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && code.length === 6) void validateValue(code);
                      }}
                      inputMode="numeric"
                      placeholder="000 000"
                      className="w-full rounded-2xl border-[3px] border-foreground bg-surface px-4 py-4 text-center font-mono text-3xl font-black tracking-[0.2em] outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void validateValue(code)}
                    disabled={submitting || code.length !== 6 || !eventId}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="h-4 w-4" />
                    )}{" "}
                    {mode === "checkin" ? "Confirmar check-in" : "Identificar cliente"}
                  </button>
                </div>
              )}
            </section>
          </>
        )}

        {failure && <ErrorPanel message={failure} onReset={resetOperation} />}
        {checkinResult && <CheckinSuccess result={checkinResult} onReset={resetOperation} />}
        {commercialCode && !saleResult && (
          <SaleForm
            code={commercialCode}
            products={products}
            lines={lines}
            setLines={setLines}
            externalReference={externalReference}
            setExternalReference={setExternalReference}
            submitting={submitting}
            onSubmit={() => void recordSale()}
            onCancel={resetOperation}
          />
        )}
        {saleResult && commercialCode && (
          <SaleSuccess
            result={saleResult}
            customerName={commercialCode.display_name}
            onReset={resetOperation}
          />
        )}
        {history.length > 0 && <HistoryPanel items={history} />}
      </div>
    </MfaGate>
  );
}

function SaleForm({
  code,
  products,
  lines,
  setLines,
  externalReference,
  setExternalReference,
  submitting,
  onSubmit,
  onCancel,
}: {
  code: CommercialCode;
  products: Product[];
  lines: SaleLine[];
  setLines: Dispatch<SetStateAction<SaleLine[]>>;
  externalReference: string;
  setExternalReference: (value: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const update = (id: string, patch: Partial<SaleLine>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  const estimatedGross = lines.reduce((sum, line) => {
    const product = products.find((item) => item.id === line.productId);
    return (
      sum + moneyToCents(line.unitPrice, product?.current_sale_price_cents ?? 0) * line.quantity
    );
  }, 0);
  return (
    <section className="poster-card mt-5 bg-card p-5 text-foreground">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="section-kicker text-muted-foreground">Cliente identificado</p>
          <h2 className="mt-1 font-display text-3xl">{code.display_name}</h2>
        </div>
        <CheckCircle2 className="h-8 w-8 text-primary" />
      </div>
      {code.purpose === "redemption" ? (
        <div className="mt-4 rounded-2xl border-2 border-foreground bg-mango p-4">
          <p className="text-xs font-black uppercase">Fofoquinha ativada</p>
          <p className="mt-1 font-display text-2xl">{code.campaign_name}</p>
          <p className="mt-1 text-sm font-black">{benefitLabel(code)}</p>
          {code.activation_expires_at && (
            <p className="mt-2 text-xs font-semibold">
              Use até {formatDateTime(code.activation_expires_at)}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm font-semibold">
          Carteirinha digital. Registre a compra para atualizar consumo e próximos benefícios.
        </p>
      )}
      <div className="mt-5 space-y-4">
        {lines.map((line, index) => {
          const product = products.find((item) => item.id === line.productId);
          return (
            <div key={line.id} className="rounded-2xl border border-input p-4">
              <div className="flex items-center justify-between">
                <p className="font-black">Item {index + 1}</p>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) => current.filter((item) => item.id !== line.id))
                    }
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                )}
              </div>
              <select
                value={line.productId}
                onChange={(event) => {
                  const next = products.find((item) => item.id === event.target.value);
                  update(line.id, {
                    productId: event.target.value,
                    unitPrice: next ? (next.current_sale_price_cents / 100).toFixed(2) : "",
                    unitCost: next ? (next.current_cost_cents / 100).toFixed(2) : "",
                  });
                }}
                className="mt-3 h-11 w-full rounded-xl border-2 border-foreground bg-background px-3 font-bold"
              >
                <option value="">Selecione o produto</option>
                {products.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.original_name} · {formatMoneyFromCents(item.current_sale_price_cents)}
                  </option>
                ))}
              </select>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label className="text-xs font-black">
                  Qtd.
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity}
                    onChange={(event) =>
                      update(line.id, {
                        quantity: Math.max(0.001, Number(event.target.value) || 1),
                      })
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-black">
                  Venda
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    onChange={(event) => update(line.id, { unitPrice: event.target.value })}
                    placeholder={
                      product ? (product.current_sale_price_cents / 100).toFixed(2) : "0,00"
                    }
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs font-black">
                  Custo
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitCost}
                    onChange={(event) => update(line.id, { unitCost: event.target.value })}
                    placeholder={product ? (product.current_cost_cents / 100).toFixed(2) : "0,00"}
                    className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() => setLines((current) => [...current, emptyLine()])}
          className="inline-flex items-center gap-2 text-sm font-black text-primary"
        >
          <Plus className="h-4 w-4" /> Adicionar produto
        </button>
        <label className="block text-xs font-black">
          Referência da venda, opcional
          <input
            value={externalReference}
            onChange={(event) => setExternalReference(event.target.value)}
            placeholder="Comanda, ficha ou venda Zig"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
          />
        </label>
      </div>
      <div className="mt-5 rounded-2xl bg-muted p-4">
        <p className="text-xs font-bold text-muted-foreground">Valor bruto estimado</p>
        <p className="font-display text-3xl">{formatMoneyFromCents(estimatedGross)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          O servidor calcula desconto real, líquido e margem antes de concluir.
        </p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border-2 border-foreground bg-card py-3 text-sm font-black"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting || lines.every((line) => !line.productId)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-50"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShoppingBag className="h-4 w-4" />
          )}{" "}
          Confirmar compra
        </button>
      </div>
    </section>
  );
}

function SaleSuccess({
  result,
  customerName,
  onReset,
}: {
  result: SaleResult;
  customerName: string;
  onReset: () => void;
}) {
  return (
    <section className="poster-card mt-5 bg-samba p-5 text-white">
      <CheckCircle2 className="h-10 w-10" />
      <p className="mt-3 section-kicker text-white/75">Compra registrada</p>
      <h2 className="mt-1 font-display text-4xl">{customerName}</h2>
      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Metric label="Bruto" value={formatMoneyFromCents(result.gross_cents)} />
        <Metric label="Desconto" value={formatMoneyFromCents(result.discount_cents)} />
        <Metric label="Líquido no funil" value={formatMoneyFromCents(result.funnel_net_cents)} />
        <Metric label="Margem estimada" value={formatMoneyFromCents(result.margin_cents)} />
      </div>
      {result.reward_redeemed && (
        <p className="mt-4 rounded-xl bg-white/15 p-3 text-sm font-black">FOFOQUINHA VALIDADA</p>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-mango px-4 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
      >
        <ShieldCheck className="h-4 w-4" /> Próximo cliente
      </button>
    </section>
  );
}

function CheckinSuccess({ result, onReset }: { result: CheckinResult; onReset: () => void }) {
  return (
    <section className="poster-card mt-5 bg-samba p-5 text-white">
      <CheckCircle2 className="h-10 w-10" />
      <p className="mt-3 section-kicker text-white/75">Check-in confirmado</p>
      <h2 className="mt-1 font-display text-4xl">{result.display_name ?? "Bafafã"}</h2>
      {result.event_name && <p className="mt-2 font-black">{result.event_name}</p>}
      {result.duplicate && (
        <p className="mt-4 rounded-xl bg-mango p-3 text-sm font-black text-foreground">
          Esse cliente já tinha presença neste evento.
        </p>
      )}
      {Number(result.rewards_granted ?? 0) > 0 && (
        <p className="mt-4 rounded-xl bg-white/15 p-3 text-sm font-black">
          {result.rewards_granted} Fofoquinha(s) liberada(s).
        </p>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-mango px-4 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
      >
        <ShieldCheck className="h-4 w-4" /> Validar próximo
      </button>
    </section>
  );
}

function ErrorPanel({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <section className="poster-card mt-5 border-destructive bg-destructive/10 p-5 text-foreground">
      <XCircle className="h-9 w-9 text-destructive" />
      <h2 className="mt-3 font-display text-3xl">Não deu certo ainda</h2>
      <p className="mt-2 text-sm font-semibold text-muted-foreground">{message}</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-4 py-2.5 text-sm font-black shadow-[2px_3px_0_var(--foreground)]"
      >
        <RefreshCw className="h-4 w-4" /> Tentar outro
      </button>
    </section>
  );
}

function HistoryPanel({ items }: { items: HistoryItem[] }) {
  return (
    <section className="card-festa mt-6 p-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">Últimas operações</h2>
      </div>
      <div className="mt-4 divide-y divide-border">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 py-3 text-sm">
            {item.success ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-black">{item.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {item.detail} ·{" "}
                {new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(
                  new Date(item.at),
                )}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AccessDenied() {
  return (
    <div className="mx-auto grid min-h-screen max-w-lg place-items-center bg-background px-6">
      <div className="text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 font-display text-2xl">Acesso da equipe</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sua conta não tem permissão para validar códigos.
        </p>
        <Link
          to="/inicio"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
  sale = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sale?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl py-2.5 ${active ? (sale ? "bg-samba text-white" : "bg-primary text-white") : "text-muted-foreground"}`}
    >
      {sale && <CircleDollarSign className="mr-1 inline h-4 w-4" />}
      {label}
    </button>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 p-3">
      <p className="text-xs text-white/70">{label}</p>
      <p className="font-black">{value}</p>
    </div>
  );
}
function emptyLine(): SaleLine {
  return { id: crypto.randomUUID(), productId: "", quantity: 1, unitPrice: "", unitCost: "" };
}
function suggestedLine(code: CommercialCode, products: Product[]): SaleLine {
  const product =
    products.find((item) => item.id === code.product_id) ??
    products.find((item) => code.product_category && item.category === code.product_category) ??
    null;
  return {
    id: crypto.randomUUID(),
    productId: product?.id ?? "",
    quantity: 1,
    unitPrice: product ? (product.current_sale_price_cents / 100).toFixed(2) : "",
    unitCost: product ? (product.current_cost_cents / 100).toFixed(2) : "",
  };
}
function moneyToCents(value: string, fallback: number) {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : fallback;
}
function benefitLabel(code: CommercialCode) {
  if (code.discount_percent)
    return `${code.discount_percent}% de desconto${code.discount_max_cents ? `, até ${formatMoneyFromCents(code.discount_max_cents)}` : ""}`;
  if (code.fixed_off_cents) return `${formatMoneyFromCents(code.fixed_off_cents)} de desconto`;
  return "Vantagem especial";
}
