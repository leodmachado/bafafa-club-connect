import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LocateFixed,
  MapPin,
  MessageCircleMore,
  QrCode,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/app-shell";
import { ErrorCard, LoadingCard } from "@/components/ui/async-state";
import { SecureQr } from "@/components/operations/secure-qr";
import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";
import { geolocationErrorMessage, getBestGeolocationPosition } from "@/lib/geolocation";
import { parseHouseSession, type HouseSession } from "@/lib/house-session";

export const Route = createFileRoute("/_authenticated/checkin")({
  component: Checkin,
});

type TokenResult = { token: string; short_code: string; expires_at: string };

function Checkin() {
  const navigate = useNavigate();
  const [session, setSession] = useState<HouseSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [geolocating, setGeolocating] = useState(false);
  const [token, setToken] = useState<TokenResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resultCopy, setResultCopy] = useState<string | null>(null);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    await supabase.rpc("sync_event_statuses");
    const { data, error: rpcError } = await supabase.rpc("my_house_session");
    if (rpcError) setError(rpcError.message);
    else setSession(parseHouseSession(data));
    setLoading(false);
  }, []);

  useEffect(() => void load(), [load]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    async function checkConfirmation() {
      const { data, error: sessionError } = await supabase.rpc("my_house_session");
      if (cancelled || sessionError) return;
      const current = parseHouseSession(data);
      if (!current?.checked_in) return;

      setSession(current);
      setToken(null);
      toast.success("Presença confirmada. Abrindo a Resenha…");
      navigate({ to: "/resenha", replace: true });
    }

    void checkConfirmation();
    const timer = window.setInterval(() => void checkConfirmation(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [navigate, token]);

  async function doGeolocationCheckin() {
    if (!session || !session.checkin_open || geolocating) return;
    setGeolocating(true);
    setResultCopy(null);
    setLocationHint("Buscando a melhor leitura de localização…");

    try {
      const position = await getBestGeolocationPosition({
        targetAccuracyM: Math.min(session.max_location_accuracy_m || 80, 80),
        timeoutMs: 20_000,
        onProgress: ({ accuracyM }) => {
          const rounded = Math.round(accuracyM);
          setLocationHint(
            rounded <= session.max_location_accuracy_m
              ? `Localização encontrada com precisão aproximada de ${rounded} m.`
              : `Precisão atual: ${rounded} m. Tentando melhorar o sinal…`,
          );
        },
      });

      const { latitude, longitude, accuracy } = position.coords;
      setLocationHint(
        `Validando sua presença com precisão aproximada de ${Math.round(accuracy)} m…`,
      );

      const { data, error: rpcError } = await supabase.rpc("checkin_with_geolocation", {
        _event_id: session.id,
        _latitude: latitude,
        _longitude: longitude,
        _accuracy_m: accuracy,
      });

      if (rpcError) {
        const message = publicErrorMessage(
          rpcError,
          "Não conseguimos confirmar que você está no Bafafá.",
        );
        setLocationHint(message);
        toast.error(message);
        return;
      }

      const response = data as { duplicate?: boolean } | null;
      setSession((current) => (current ? { ...current, checked_in: true } : current));
      setLocationHint(null);
      setResultCopy(
        response?.duplicate
          ? "Sua presença já estava confirmada. Abrindo a Resenha…"
          : "Presença confirmada. Abrindo a Resenha…",
      );
      toast.success("Achamos você!");
      window.setTimeout(() => navigate({ to: "/resenha", replace: true }), 650);
    } catch (geoError) {
      const message = geolocationErrorMessage(geoError);
      setLocationHint(message);
      toast.error(message);
    } finally {
      setGeolocating(false);
    }
  }

  async function generateQrFallback() {
    if (!session || !session.checkin_open || generating) return;
    setGenerating(true);
    setQrError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc("create_my_qr_token", {
        _purpose: "checkin",
        _ref_id: session.id,
      });

      if (rpcError) {
        const message = publicErrorMessage(rpcError, "Não foi possível gerar o QR alternativo.");
        setQrError(message);
        toast.error(message);
        return;
      }

      const row = Array.isArray(data) ? data[0] : null;
      if (!row?.token || !row.short_code || !row.expires_at) {
        const message = "Não foi possível gerar o código. Tente novamente.";
        setQrError(message);
        toast.error(message);
        return;
      }

      setToken(row as TokenResult);
    } catch (qrGenerationError) {
      console.error("Erro ao gerar QR alternativo", qrGenerationError);
      const message = "Não foi possível gerar o QR alternativo. Tente novamente.";
      setQrError(message);
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Presença no Bafafá"
        title="Check-in"
        tone="blue"
        action={
          <Link
            to="/inicio"
            aria-label="Voltar ao Início"
            className="grid h-10 w-10 place-items-center rounded-full border-2 border-foreground bg-background text-foreground shadow-[2px_3px_0_var(--foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        }
      />

      {loading && <LoadingCard label="Vendo se a casa está aberta…" />}
      {error && (
        <div className="space-y-3">
          <ErrorCard message={error} />
          <div className="px-5">
            <button type="button" onClick={() => void load()} className="feed-more-link w-full">
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-5 px-5 pt-3">
          {!session ? (
            <section className="poster-card checker-texture p-6 text-foreground">
              <Clock3 className="h-8 w-8" />
              <h2 className="mt-4 font-display text-4xl leading-none">
                A casa está fechada agora.
              </h2>
              <p className="mt-3 text-sm font-semibold opacity-75">
                O check-in aparece quando o Bafafá abre a Sessão da Casa. As Fofoquinhas continuam
                disponíveis no Início.
              </p>
              <Link to="/inicio" className="mt-5 inline-flex items-center gap-2 font-black">
                Voltar ao Início <ArrowLeft className="h-4 w-4 rotate-180" />
              </Link>
            </section>
          ) : session.checked_in ? (
            <section className="poster-card grid-texture bg-primary p-6 text-primary-foreground">
              <CheckCircle2 className="h-9 w-9" />
              <h2 className="mt-4 font-display text-4xl leading-none">Presença confirmada.</h2>
              <p className="mt-3 text-sm font-semibold opacity-85">
                Sua entrada na Resenha já está liberada enquanto a Sessão da Casa estiver aberta.
              </p>
              <Link
                to="/resenha"
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-background px-5 py-3 text-sm font-black text-foreground shadow-[3px_4px_0_var(--foreground)]"
              >
                Entrar na Resenha <MessageCircleMore className="h-4 w-4" />
              </Link>
            </section>
          ) : (
            <>
              <section className="poster-card checker-texture p-6 text-foreground">
                <LocateFixed className="h-9 w-9" />
                <h2 className="mt-4 font-display text-4xl leading-none">
                  Bora confirmar que você tá no Bafas?
                </h2>
                <p className="mt-3 text-sm font-semibold opacity-75">
                  A localização libera a Resenha. A gente verifica sua posição somente neste
                  momento.
                </p>
                <p className="mt-4 flex items-center gap-2 text-xs font-black opacity-70">
                  <MapPin className="h-4 w-4" />
                  {session.venue_address ?? "Praça Dr. Amaro de Souza · Lagoa Nova"}
                </p>
                <button
                  type="button"
                  onClick={() => void doGeolocationCheckin()}
                  disabled={geolocating || !session.checkin_open}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
                >
                  <LocateFixed className={`h-4 w-4 ${geolocating ? "animate-pulse" : ""}`} />
                  {geolocating ? "Confirmando sua presença…" : "Usar minha localização"}
                </button>
                {!session.checkin_open && (
                  <p className="mt-3 text-center text-xs font-bold opacity-70">
                    O check-in desta Sessão da Casa já encerrou.
                  </p>
                )}
              </section>

              {(locationHint || resultCopy) && (
                <div className="sticker-card bg-card p-4 text-sm font-semibold">
                  {resultCopy ?? locationHint}
                </div>
              )}

              <section className="sticker-card bg-card p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-lagoa">
                    <QrCode className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl leading-none">
                      Não deu com a localização?
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Gere um QR temporário e peça para a equipe confirmar sua presença.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void generateQrFallback()}
                  disabled={generating || !session.checkin_open}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground px-4 py-3 text-sm font-black disabled:opacity-60"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {generating ? "Gerando…" : "Gerar QR alternativo"}
                </button>
                {qrError && (
                  <p className="mt-3 text-sm font-semibold text-destructive">{qrError}</p>
                )}
              </section>
            </>
          )}
        </div>
      )}

      {token && (
        <div className="px-5 pb-8 pt-5">
          <section className="sticker-card bg-card p-5 text-center">
            <h2 className="font-display text-3xl">Mostre para a equipe</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Depois da confirmação, abra novamente a Resenha.
            </p>
            <div className="mt-4">
              <SecureQr
                value={token.token}
                shortCode={token.short_code}
                expiresAt={token.expires_at}
                size={220}
              />
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
