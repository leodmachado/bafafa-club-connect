import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Gift,
  LockKeyhole,
  MessageCircleMore,
  ShoppingBag,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
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
import { campaignBenefitLabel } from "@/lib/bafafa";
import { formatMoneyFromCents } from "@/lib/commercial";
import { publicErrorMessage } from "@/lib/public-error";

export type CustomerJourney = {
  event: {
    id: string;
    name: string;
    starts_at: string;
    ends_at: string | null;
    chat_enabled: boolean;
    checkin_enabled: boolean;
  } | null;
  checked_in: boolean;
  session: {
    id: string;
    gross_total_cents: number;
    discount_total_cents: number;
    net_total_cents: number;
    funnel_net_total_cents: number;
    cost_total_cents: number;
    margin_total_cents: number;
    current_stage: number;
  } | null;
  next_stage: {
    stage_order: number;
    trigger_type: "checkin" | "net_spend";
    threshold_cents: number;
    title: string;
    progress_copy: string | null;
    unlocked_copy: string | null;
    completed: boolean;
  } | null;
  pending_review: {
    event_id: string;
    event_name: string;
    ended_at: string | null;
  } | null;
};

type Promo = {
  campaign_id: string;
  name: string;
  benefit_type: string;
  discount_percent: number | null;
  fixed_off_cents: number | null;
  product_name: string | null;
  reward_id: string | null;
  reward_status: string | null;
};

export function CustomerJourneySection({
  journey,
  promotions,
  onReviewed,
}: {
  journey: CustomerJourney | null;
  promotions: Promo[];
  onReviewed: () => void;
}) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const available = useMemo(
    () =>
      promotions.find((promo) => promo.reward_id && promo.reward_status === "available") ?? null,
    [promotions],
  );

  if (!journey) return null;

  return (
    <div className="space-y-4">
      {journey.event && !journey.checked_in && (
        <article className="poster-card checker-texture p-5 text-foreground">
          <span className="cut-label bg-white">tá valendo agora</span>
          <div className="mt-5 flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-mango shadow-[2px_3px_0_var(--foreground)]">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-3xl leading-none">Tem Fofoquinha esperando</h2>
              <p className="mt-2 text-sm font-semibold opacity-75">
                Confirme que você chegou para abrir as vantagens e a Resenha de {journey.event.name}
                .
              </p>
            </div>
          </div>
          <Link
            to="/checkin"
            search={{ event: journey.event.id }}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
          >
            <CheckCircle2 className="h-4 w-4" /> Confirmar minha presença
          </Link>
        </article>
      )}

      {journey.event && journey.checked_in && (
        <>
          {available && (
            <article className="ticket-card checker-texture p-5 text-foreground">
              <span className="cut-label bg-white">fofoquinha do agora</span>
              <div className="mt-5 flex items-center gap-3">
                <Gift className="h-7 w-7" />
                <div>
                  <h2 className="font-display text-3xl leading-none">{available.name}</h2>
                  <p className="mt-2 font-poster text-lg">{campaignBenefitLabel(available)}</p>
                </div>
              </div>
              <Link
                to="/mimos"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
              >
                <Sparkles className="h-4 w-4" /> Ver e ativar
              </Link>
            </article>
          )}

          <ProgressCard journey={journey} />

          {journey.event.chat_enabled && (
            <article className="sticker-card bg-card p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lagoa">
                  <MessageCircleMore className="h-5 w-5" />
                </div>
                <div>
                  <p className="section-kicker text-muted-foreground">Resenha do Bafas</p>
                  <h2 className="font-display text-2xl">Só entra quem fez check-in</h2>
                  <p className="mt-2 text-sm font-semibold text-muted-foreground">
                    Cantada pode. Desrespeito, não. Mande um salve e a conversa só abre se a outra
                    pessoa quiser.
                  </p>
                </div>
              </div>
              <Link
                to="/resenha"
                search={{ event: journey.event.id }}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-foreground px-4 py-3 text-sm font-black text-background shadow-[3px_4px_0_var(--mango)]"
              >
                <MessageCircleMore className="h-4 w-4" /> Entrar na Resenha
              </Link>
            </article>
          )}
        </>
      )}

      {journey.pending_review && (
        <article className="sticker-card bg-card p-5">
          <div className="flex items-start gap-3">
            <Star className="mt-1 h-6 w-6 fill-mango text-foreground" />
            <div className="flex-1">
              <p className="section-kicker text-muted-foreground">Conta pra gente</p>
              <h2 className="font-display text-2xl">
                Como foi {journey.pending_review.event_name}?
              </h2>
              <p className="mt-2 text-sm font-semibold text-muted-foreground">
                Sua avaliação ajuda a melhorar o próximo encontro.
              </p>
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={() => setReviewOpen(true)}>
            Avaliar experiência
          </Button>
        </article>
      )}

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        review={journey.pending_review}
        onSaved={() => {
          setReviewOpen(false);
          onReviewed();
        }}
      />
    </div>
  );
}

function ProgressCard({ journey }: { journey: CustomerJourney }) {
  const stage = journey.next_stage;
  const current = journey.session?.funnel_net_total_cents ?? 0;
  if (!stage) {
    return (
      <article className="sticker-card bg-primary p-5 text-primary-foreground">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-7 w-7" />
          <div>
            <p className="section-kicker opacity-70">fofoca completa</p>
            <h2 className="font-display text-2xl">Você desbloqueou todas as etapas da noite</h2>
          </div>
        </div>
      </article>
    );
  }

  const target = stage.threshold_cents;
  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 100;
  const remaining = Math.max(target - current, 0);

  return (
    <article className="sticker-card bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mango">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <p className="section-kicker text-muted-foreground">a fofoca tá crescendo</p>
          <h2 className="font-display text-2xl">{stage.title}</h2>
          {stage.trigger_type === "net_spend" ? (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Você já consumiu {formatMoneyFromCents(current)} de {formatMoneyFromCents(target)}.
              Faltam {formatMoneyFromCents(remaining)} para o próximo Babado Forte.
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Seu check-in abriu a primeira etapa da experiência.
            </p>
          )}
        </div>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full border-2 border-foreground bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-2 flex justify-between text-xs font-black text-muted-foreground">
        <span>{formatMoneyFromCents(current)}</span>
        <span>{formatMoneyFromCents(target)}</span>
      </div>
    </article>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  review,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  review: CustomerJourney["pending_review"];
  onSaved: () => void;
}) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!review || saving) return;
    setSaving(true);
    const { error } = await supabase.rpc("submit_event_review", {
      _event_id: review.event_id,
      _rating: rating,
      _comment: comment.trim() || undefined,
      _would_return: true,
    });
    setSaving(false);
    if (error)
      return toast.error(publicErrorMessage(error, "Não foi possível salvar sua avaliação."));
    toast.success("Avaliação guardada. Valeu pela moral!");
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como foi a experiência?</DialogTitle>
          <DialogDescription>Escolha uma nota e deixe um comentário, se quiser.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-2 py-3">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              className="rounded-full p-1"
              aria-label={`Nota ${value}`}
            >
              <Star
                className={`h-8 w-8 ${value <= rating ? "fill-mango text-foreground" : "text-muted-foreground/30"}`}
              />
            </button>
          ))}
        </div>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value.slice(0, 1000))}
          className="min-h-28 w-full rounded-xl border-2 border-foreground/20 bg-background p-3 text-sm outline-none focus:border-primary"
          placeholder="O que deu bom e o que pode melhorar?"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando…" : "Enviar avaliação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
