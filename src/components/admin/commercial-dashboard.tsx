import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  BarChart3,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Loader2,
  Megaphone,
  RefreshCw,
  Save,
  Star,
  Target,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";
import { CRM_SEGMENT_LABELS, formatMoneyFromCents } from "@/lib/commercial";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type EventOption = { id: string; name: string; starts_at: string; status: string };
type Tab = "overview" | "crm" | "products" | "funnel" | "sales" | "fofocometro" | "reviews";
type JsonObject = Record<string, unknown>;

type Product = {
  id: string;
  original_name: string;
  category: string;
  current_sale_price_cents: number;
  current_cost_cents: number;
  active: boolean;
  counts_for_funnel: boolean;
  discount_eligible: boolean;
  counts_for_fofocometro: boolean;
  max_discount_cents: number | null;
  notes: string | null;
  updated_at: string;
};

type Customer = {
  id: string;
  display_name: string;
  phone_e164: string | null;
  current_segment: string;
  visit_count: number;
  lifetime_net_spend_cents: number;
  last_checkin_at: string | null;
  last_purchase_at: string | null;
};

type Sale = {
  id: string;
  user_id: string;
  event_id: string;
  status: string;
  gross_total_cents: number;
  discount_total_cents: number;
  net_total_cents: number;
  margin_total_cents: number;
  created_at: string;
  profiles?: { display_name: string } | null;
  events?: { name: string } | null;
};

type Goal = {
  id: string;
  event_id: string;
  name: string;
  target_count: number;
  current_count: number;
  status: string;
  reward_description: string | null;
};

type Review = {
  id: string;
  rating: number;
  service_rating: number | null;
  music_rating: number | null;
  atmosphere_rating: number | null;
  comment: string | null;
  would_return: boolean | null;
  created_at: string;
  profiles?: { display_name: string } | null;
  events?: { name: string } | null;
};

const TABS: Array<{ key: Tab; label: string; icon: typeof BarChart3 }> = [
  { key: "overview", label: "Visão geral", icon: BarChart3 },
  { key: "crm", label: "CRM", icon: Users },
  { key: "products", label: "Produtos", icon: Boxes },
  { key: "funnel", label: "Funil", icon: Target },
  { key: "sales", label: "Vendas", icon: CircleDollarSign },
  { key: "fofocometro", label: "Fofocômetro", icon: Megaphone },
  { key: "reviews", label: "Avaliações", icon: Star },
];

export function CommercialDashboard({ events }: { events: EventOption[] }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<JsonObject>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    const [
      snapshotResult,
      productsResult,
      customersResult,
      salesResult,
      goalsResult,
      reviewsResult,
    ] = await Promise.all([
      supabase.rpc("admin_commercial_snapshot"),
      supabase.from("products").select("*").order("original_name"),
      supabase
        .from("profiles")
        .select(
          "id,display_name,phone_e164,current_segment,visit_count,lifetime_net_spend_cents,last_checkin_at,last_purchase_at",
        )
        .is("deleted_at", null)
        .order("lifetime_net_spend_cents", { ascending: false })
        .limit(500),
      supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(250),
      supabase.from("collective_goals").select("*").order("created_at", { ascending: false }),
      supabase
        .from("event_reviews")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(250),
    ]);

    const firstError =
      snapshotResult.error ??
      productsResult.error ??
      customersResult.error ??
      salesResult.error ??
      goalsResult.error ??
      reviewsResult.error;

    if (firstError) {
      toast.error(publicErrorMessage(firstError, "Não foi possível carregar o módulo comercial."));
    } else {
      const rawSales = salesResult.data ?? [];
      const rawReviews = reviewsResult.data ?? [];
      const userIds = [
        ...new Set([
          ...rawSales.map((item) => item.user_id),
          ...rawReviews.map((item) => item.user_id),
        ]),
      ];
      const eventIds = [
        ...new Set([
          ...rawSales.map((item) => item.event_id),
          ...rawReviews.map((item) => item.event_id),
        ]),
      ];
      const [peopleResult, eventNamesResult] = await Promise.all([
        userIds.length
          ? supabase.from("profiles").select("id,display_name").in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        eventIds.length
          ? supabase.from("events").select("id,name").in("id", eventIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      const relationError = peopleResult.error ?? eventNamesResult.error;
      if (relationError) {
        toast.error(
          publicErrorMessage(relationError, "Os nomes do relatório não puderam ser carregados."),
        );
      }
      const peopleById = new Map(
        (peopleResult.data ?? []).map((item) => [item.id, item.display_name]),
      );
      const eventsById = new Map((eventNamesResult.data ?? []).map((item) => [item.id, item.name]));

      setSnapshot((snapshotResult.data ?? {}) as JsonObject);
      setProducts((productsResult.data ?? []) as Product[]);
      setCustomers((customersResult.data ?? []) as Customer[]);
      setSales(
        rawSales.map((item) => ({
          ...item,
          profiles: { display_name: peopleById.get(item.user_id) ?? "Bafafã" },
          events: { name: eventsById.get(item.event_id) ?? "Evento" },
        })) as Sale[],
      );
      setGoals((goalsResult.data ?? []) as Goal[]);
      setReviews(
        rawReviews.map((item) => ({
          ...item,
          profiles: { display_name: peopleById.get(item.user_id) ?? "Bafafã" },
          events: { name: eventsById.get(item.event_id) ?? "Evento" },
        })) as Review[],
      );
    }
    if (quiet) setRefreshing(false);
    else setLoading(false);
  }, []);

  useEffect(() => void load(), [load]);

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="section-kicker text-muted-foreground">CRM, receita e recorrência</p>
            <h2 className="mt-1 font-display text-3xl">Central comercial</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Produtos, consumo líquido, Fofoquinhas e relacionamento em uma única operação.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-black ${
                tab === key
                  ? "border-foreground bg-foreground text-background"
                  : "border-input bg-background text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <div className="grid min-h-60 place-items-center rounded-3xl border border-input bg-card">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <>
          {tab === "overview" && <Overview snapshot={snapshot} />}
          {tab === "crm" && <CrmList customers={customers} />}
          {tab === "products" && <ProductsManager products={products} onSaved={() => load(true)} />}
          {tab === "funnel" && (
            <FunnelManager events={events} products={products} onSaved={() => load(true)} />
          )}
          {tab === "sales" && <SalesManager sales={sales} onSaved={() => load(true)} />}
          {tab === "fofocometro" && (
            <GoalsManager events={events} goals={goals} onSaved={() => load(true)} />
          )}
          {tab === "reviews" && <ReviewsList reviews={reviews} />}
        </>
      )}
    </div>
  );
}

function Overview({ snapshot }: { snapshot: JsonObject }) {
  const cards = [
    [
      "Margem adicional por Fofoquinha",
      formatMoneyFromCents(Number(snapshot.fofoquinha_addon_margin_cents ?? 0)),
      "Margem dos itens extras vendidos na mesma compra da vantagem",
    ],
    [
      "Margem por validação",
      formatMoneyFromCents(Number(snapshot.margin_per_redeemed_reward_cents ?? 0)),
      "Margem média das compras com Fofoquinha validada",
    ],
    ["Clientes", Number(snapshot.customers ?? 0), "Cadastros ativos"],
    ["Check-ins", Number(snapshot.checkins ?? 0), "Presenças registradas"],
    [
      "Conversão",
      `${Number(snapshot.checkins ?? 0) > 0 ? ((Number(snapshot.sales ?? 0) / Number(snapshot.checkins ?? 1)) * 100).toFixed(1) : "0.0"}%`,
      "Check-in que virou compra",
    ],
    [
      "Receita líquida",
      formatMoneyFromCents(Number(snapshot.net_cents ?? 0)),
      "Valor efetivamente pago",
    ],
    [
      "Descontos",
      formatMoneyFromCents(Number(snapshot.discount_cents ?? 0)),
      "Benefício real concedido",
    ],
    [
      "Margem estimada",
      formatMoneyFromCents(Number(snapshot.margin_cents ?? 0)),
      "Após custo informado",
    ],
    ["R$ 50", Number(snapshot.stage_50 ?? 0), "Clientes no segundo marco"],
    ["R$ 100", Number(snapshot.stage_100 ?? 0), "Clientes no terceiro marco"],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(([label, value, copy]) => (
        <article
          key={String(label)}
          className={`rounded-3xl border p-5 shadow-sm ${
            label === "Margem adicional por Fofoquinha"
              ? "border-foreground bg-mango text-foreground shadow-[4px_5px_0_var(--foreground)] sm:col-span-2"
              : "border-input bg-card"
          }`}
        >
          <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-display text-4xl leading-none">{value}</p>
          <p className="mt-2 text-xs text-muted-foreground">{copy}</p>
        </article>
      ))}
    </div>
  );
}

function CrmList({ customers }: { customers: Customer[] }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return customers;
    return customers.filter((customer) =>
      [
        customer.display_name,
        customer.phone_e164,
        CRM_SEGMENT_LABELS[customer.current_segment] ?? customer.current_segment,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(clean)),
    );
  }, [customers, query]);

  return (
    <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Clientes e segmentos</h3>
          <p className="text-sm text-muted-foreground">
            Priorize retorno, aniversário e recorrência.
          </p>
        </div>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar cliente"
          className="max-w-xs"
        />
      </div>
      <div className="mt-4 divide-y divide-border">
        {rows.map((customer) => (
          <div
            key={customer.id}
            className="grid gap-2 py-4 md:grid-cols-[1.5fr_1fr_0.7fr_0.9fr] md:items-center"
          >
            <div>
              <p className="font-black">{customer.display_name}</p>
              <p className="text-xs text-muted-foreground">
                {customer.phone_e164 ?? "Telefone ainda não validado"}
              </p>
            </div>
            <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black">
              {CRM_SEGMENT_LABELS[customer.current_segment] ?? customer.current_segment}
            </span>
            <p className="text-sm font-bold">{customer.visit_count} visita(s)</p>
            <p className="text-sm font-black">
              {formatMoneyFromCents(customer.lifetime_net_spend_cents)}
            </p>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente encontrado.
          </p>
        )}
      </div>
    </section>
  );
}

function ProductsManager({ products, onSaved }: { products: Product[]; onSaved: () => void }) {
  const [editing, setEditing] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // O React zera event.currentTarget quando o handler retorna. Como este
    // handler tem await, o elemento precisa ser guardado antes.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    setSaving(true);
    const result = await supabase.rpc("admin_upsert_product", {
      _name: name,
      _category: String(form.get("category") ?? "outros"),
      _sale_price_cents: moneyToCents(form.get("sale_price")),
      _cost_cents: moneyToCents(form.get("cost")),
      _reason: String(form.get("reason") ?? "Atualização pelo painel comercial"),
    });
    let saveError = result.error;
    if (!saveError && result.data?.id) {
      const { error: ruleError } = await supabase
        .from("products")
        .update({
          active: form.get("active") === "on",
          counts_for_funnel: form.get("counts_for_funnel") === "on",
          discount_eligible: form.get("discount_eligible") === "on",
          counts_for_fofocometro: form.get("counts_for_fofocometro") === "on",
          max_discount_cents: nullableMoneyToCents(form.get("max_discount")),
          notes: String(form.get("notes") ?? "").trim() || null,
        })
        .eq("id", result.data.id);
      saveError = ruleError;
    }
    setSaving(false);
    if (saveError) return toast.error(publicErrorMessage(saveError));
    toast.success(editing ? "Produto atualizado com histórico." : "Produto criado.");
    setEditing(null);
    formElement.reset();
    onSaved();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.4fr]">
      <form
        onSubmit={save}
        className="h-fit space-y-4 rounded-3xl border border-input bg-card p-5 shadow-sm"
      >
        <div>
          <h3 className="font-display text-2xl">{editing ? "Editar produto" : "Novo produto"}</h3>
          <p className="text-sm text-muted-foreground">
            Preço e custo atuais mudam; o histórico das vendas fica preservado.
          </p>
        </div>
        <Field label="Nome" name="name" defaultValue={editing?.original_name} required />
        <Field label="Categoria" name="category" defaultValue={editing?.category ?? "outros"} />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Preço de venda"
            name="sale_price"
            type="number"
            step="0.01"
            defaultValue={centsToInput(editing?.current_sale_price_cents)}
          />
          <Field
            label="Preço de custo"
            name="cost"
            type="number"
            step="0.01"
            defaultValue={centsToInput(editing?.current_cost_cents)}
          />
        </div>
        <Field
          label="Limite de desconto"
          name="max_discount"
          type="number"
          step="0.01"
          defaultValue={centsToInput(editing?.max_discount_cents)}
        />
        <Field
          label="Motivo da alteração"
          name="reason"
          defaultValue={editing ? "Revisão de preço ou regra" : "Cadastro inicial"}
        />
        <div className="grid gap-3 rounded-2xl bg-muted p-4 text-sm">
          <CheckField
            name="active"
            label="Produto ativo"
            defaultChecked={editing?.active ?? true}
          />
          <CheckField
            name="counts_for_funnel"
            label="Conta para o funil"
            defaultChecked={editing?.counts_for_funnel ?? true}
          />
          <CheckField
            name="discount_eligible"
            label="Elegível para desconto"
            defaultChecked={editing?.discount_eligible ?? true}
          />
          <CheckField
            name="counts_for_fofocometro"
            label="Conta para o Fofocômetro"
            defaultChecked={editing?.counts_for_fofocometro ?? false}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="notes">Observações internas</Label>
          <Textarea id="notes" name="notes" defaultValue={editing?.notes ?? ""} />
        </div>
        <div className="flex gap-2">
          {editing && (
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
          )}
          <Button type="submit" disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Salvando" : "Salvar produto"}
          </Button>
        </div>
      </form>

      <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
        <h3 className="font-display text-2xl">Catálogo atual</h3>
        <div className="mt-4 divide-y divide-border">
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => setEditing(product)}
              className="grid w-full gap-2 py-4 text-left md:grid-cols-[1.5fr_0.8fr_0.7fr_0.7fr] md:items-center"
            >
              <div>
                <p className="font-black">{product.original_name}</p>
                <p className="text-xs text-muted-foreground">{product.category}</p>
              </div>
              <p className="text-sm font-black">
                {formatMoneyFromCents(product.current_sale_price_cents)}
              </p>
              <p className="text-sm text-muted-foreground">
                Custo {formatMoneyFromCents(product.current_cost_cents)}
              </p>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${product.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {product.active ? "Ativo" : "Inativo"}
              </span>
            </button>
          ))}
          {products.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Cadastre o primeiro produto.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function FunnelManager({
  events,
  products,
  onSaved,
}: {
  events: EventOption[];
  products: Product[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const eventId = String(form.get("event_id") ?? "");
    if (!eventId) return toast.error("Selecione o evento.");
    const config = {
      stage1_discount_percent: Number(form.get("checkin_discount") ?? 20),
      stage1_max_discount_cents: moneyToCents(form.get("checkin_max")),
      stage2_threshold_cents: moneyToCents(form.get("stage_2_threshold")),
      stage2_discount_percent: Number(form.get("stage_2_discount") ?? 30),
      stage2_max_discount_cents: moneyToCents(form.get("stage_2_max")),
      stage3_threshold_cents: moneyToCents(form.get("stage_3_threshold")),
      stage3_discount_percent: Number(form.get("stage_3_discount") ?? 20),
      stage3_max_discount_cents: moneyToCents(form.get("stage_3_max")),
      activation_window_minutes: Number(form.get("activation_window") ?? 120),
      redemption_window_minutes: Number(form.get("redemption_window") ?? 20),
      future_reward_valid_hours: Number(form.get("future_reward_valid_hours") ?? 168),
      product_id: String(form.get("product_id") ?? "").trim() || null,
      product_category: String(form.get("product_category") ?? "").trim() || null,
    };
    setSaving(true);
    const { error } = await supabase.rpc("admin_configure_event_funnel", {
      _event_id: eventId,
      _config: config,
    });
    setSaving(false);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Funil do evento configurado.");
    onSaved();
  }
  return (
    <form
      onSubmit={save}
      className="space-y-5 rounded-3xl border border-input bg-card p-5 shadow-sm"
    >
      <div>
        <h3 className="font-display text-2xl">Funil progressivo por evento</h3>
        <p className="text-sm text-muted-foreground">
          Todos os valores podem ser ajustados sem alterar compras antigas.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="event_id">Evento</Label>
        <select
          id="event_id"
          name="event_id"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          required
        >
          <option value="">Selecione</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StageCard title="Chegou no Bafas" copy="Liberada no check-in">
          <Field label="Desconto (%)" name="checkin_discount" type="number" defaultValue="20" />
          <Field
            label="Limite máximo (R$)"
            name="checkin_max"
            type="number"
            step="0.01"
            defaultValue="10"
          />
        </StageCard>
        <StageCard title="Babado forte" copy="Consumo líquido acumulado">
          <Field
            label="Marco (R$)"
            name="stage_2_threshold"
            type="number"
            step="0.01"
            defaultValue="50"
          />
          <Field label="Desconto (%)" name="stage_2_discount" type="number" defaultValue="30" />
          <Field
            label="Limite máximo (R$)"
            name="stage_2_max"
            type="number"
            step="0.01"
            defaultValue="15"
          />
        </StageCard>
        <StageCard title="Próxima visita" copy="Benefício para voltar">
          <Field
            label="Marco (R$)"
            name="stage_3_threshold"
            type="number"
            step="0.01"
            defaultValue="100"
          />
          <Field label="Desconto (%)" name="stage_3_discount" type="number" defaultValue="20" />
          <Field
            label="Limite máximo (R$)"
            name="stage_3_max"
            type="number"
            step="0.01"
            defaultValue="10"
          />
          <Field
            label="Validade para retorno (horas)"
            name="future_reward_valid_hours"
            type="number"
            defaultValue="168"
          />
        </StageCard>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="product_id">Produto específico, opcional</Label>
          <select
            id="product_id"
            name="product_id"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Qualquer produto elegível</option>
            {products
              .filter((product) => product.active && product.discount_eligible)
              .map((product) => (
                <option key={product.id} value={product.id}>
                  {product.original_name}
                </option>
              ))}
          </select>
        </div>
        <Field
          label="Categoria participante, opcional"
          name="product_category"
          placeholder="Ex.: cervejas"
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Prazo para ativar (minutos)"
          name="activation_window"
          type="number"
          defaultValue="120"
        />
        <Field
          label="Prazo após ativação (minutos)"
          name="redemption_window"
          type="number"
          defaultValue="20"
        />
      </div>
      <Button type="submit" disabled={saving}>
        <Save className="h-4 w-4" /> {saving ? "Configurando" : "Configurar funil"}
      </Button>
    </form>
  );
}

function SalesManager({ sales, onSaved }: { sales: Sale[]; onSaved: () => void }) {
  async function changeStatus(sale: Sale, status: "cancelled" | "refunded") {
    const verb = status === "cancelled" ? "cancelar" : "estornar";
    const reason = window.prompt(`Motivo para ${verb} esta venda:`)?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc("admin_change_sale_status", {
      _sale_id: sale.id,
      _status: status,
      _reason: reason,
    });
    if (error) return toast.error(publicErrorMessage(error));
    toast.success(
      status === "cancelled"
        ? "Venda cancelada e progresso recalculado."
        : "Venda estornada e progresso recalculado.",
    );
    onSaved();
  }
  return (
    <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
      <h3 className="font-display text-2xl">Vendas vinculadas</h3>
      <p className="text-sm text-muted-foreground">
        Cancelamentos e estornos retiram o valor do progresso automaticamente.
      </p>
      <div className="mt-4 divide-y divide-border">
        {sales.map((sale) => (
          <div
            key={sale.id}
            className="grid gap-3 py-4 lg:grid-cols-[1.2fr_1fr_0.8fr_0.8fr_auto] lg:items-center"
          >
            <div>
              <p className="font-black">{sale.profiles?.display_name ?? "Cliente"}</p>
              <p className="text-xs text-muted-foreground">{sale.events?.name ?? "Evento"}</p>
            </div>
            <p className="text-sm">
              {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
                new Date(sale.created_at),
              )}
            </p>
            <p className="font-black">{formatMoneyFromCents(sale.net_total_cents)}</p>
            <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-black">
              {sale.status}
            </span>
            {sale.status === "confirmed" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void changeStatus(sale, "cancelled")}
                >
                  <XCircle className="h-4 w-4" /> Cancelar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void changeStatus(sale, "refunded")}
                >
                  Estornar
                </Button>
              </div>
            )}
          </div>
        ))}
        {sales.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            As compras validadas aparecerão aqui.
          </p>
        )}
      </div>
    </section>
  );
}

function GoalsManager({
  events,
  goals,
  onSaved,
}: {
  events: EventOption[];
  goals: Goal[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // O React zera event.currentTarget quando o handler retorna. Como este
    // handler tem await, o elemento precisa ser guardado antes.
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    const { error } = await supabase.from("collective_goals").insert({
      event_id: String(form.get("event_id")),
      name: String(form.get("name") ?? "Gela a Gente"),
      target_count: Number(form.get("target") ?? 100),
      reward_description: String(form.get("reward_copy") ?? "").trim() || null,
      status: "active",
    });
    setSaving(false);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Meta coletiva ativada.");
    formElement.reset();
    onSaved();
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[0.8fr_1.4fr]">
      <form
        onSubmit={save}
        className="h-fit space-y-4 rounded-3xl border border-input bg-card p-5 shadow-sm"
      >
        <h3 className="font-display text-2xl">Nova meta coletiva</h3>
        <div className="space-y-2">
          <Label htmlFor="goal-event">Evento</Label>
          <select
            id="goal-event"
            name="event_id"
            required
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Selecione</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="Nome" name="name" defaultValue="Gela a Gente" />
        <Field label="Meta de validações" name="target" type="number" defaultValue="100" />
        <Field
          label="Recompensa desbloqueada"
          name="reward_copy"
          placeholder="Ex.: preço especial liberado"
        />
        <Button type="submit" disabled={saving}>
          <Megaphone className="h-4 w-4" /> {saving ? "Ativando" : "Ativar meta"}
        </Button>
      </form>
      <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
        <h3 className="font-display text-2xl">Metas do Fofocômetro</h3>
        <div className="mt-4 space-y-3">
          {goals.map((goal) => {
            const percent = Math.min(
              100,
              Math.round((goal.current_count / Math.max(goal.target_count, 1)) * 100),
            );
            return (
              <article key={goal.id} className="rounded-2xl border border-input p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {events.find((item) => item.id === goal.event_id)?.name ?? "Evento"}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-black">
                    {goal.status}
                  </span>
                </div>
                <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${percent}%` }} />
                </div>
                <p className="mt-2 text-sm font-black">
                  {goal.current_count} de {goal.target_count} Fofoquinhas validadas
                </p>
                {goal.reward_description && (
                  <p className="mt-1 text-xs text-muted-foreground">{goal.reward_description}</p>
                )}
              </article>
            );
          })}
          {goals.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma meta configurada.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewsList({ reviews }: { reviews: Review[] }) {
  const average = reviews.length
    ? reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length
    : 0;
  return (
    <section className="rounded-3xl border border-input bg-card p-5 shadow-sm">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl">Avaliações pós-evento</h3>
          <p className="text-sm text-muted-foreground">Feedback ligado à visita real do cliente.</p>
        </div>
        <p className="font-display text-4xl">{average.toFixed(1)}★</p>
      </div>
      <div className="mt-4 divide-y divide-border">
        {reviews.map((review) => (
          <article key={review.id} className="py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-black">{review.profiles?.display_name ?? "Cliente"}</p>
                <p className="text-xs text-muted-foreground">{review.events?.name ?? "Evento"}</p>
              </div>
              <p className="font-black">{review.rating} de 5</p>
            </div>
            {review.comment && (
              <p className="mt-3 rounded-2xl bg-muted p-3 text-sm">{review.comment}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              {review.would_return === true
                ? "Voltaria ao Bafafá"
                : review.would_return === false
                  ? "Indicou que não voltaria"
                  : "Sem resposta sobre retorno"}
            </p>
          </article>
        ))}
        {reviews.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">
            As avaliações aparecerão depois dos eventos.
          </p>
        )}
      </div>
    </section>
  );
}

function StageCard({
  title,
  copy,
  children,
}: {
  title: string;
  copy: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-input bg-muted/40 p-4">
      <div>
        <p className="font-black">{title}</p>
        <p className="text-xs text-muted-foreground">{copy}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue,
  ...props
}: { label: string; name: string; defaultValue?: string | number | null } & ComponentProps<
  typeof Input
>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ""} {...props} />
    </div>
  );
}

function CheckField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="font-semibold">{label}</span>
      <Switch name={name} defaultChecked={defaultChecked} />
    </label>
  );
}

function moneyToCents(value: FormDataEntryValue | null) {
  const number = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0;
}
function nullableMoneyToCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? moneyToCents(value) : null;
}
function centsToInput(value: number | null | undefined) {
  return value === null || value === undefined ? "" : (value / 100).toFixed(2);
}
