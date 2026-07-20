import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { IdCard, Loader2, LockKeyhole, RefreshCw, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { AppShell, ScreenHeader } from "@/components/layout/app-shell";
import { SecureQr } from "@/components/operations/secure-qr";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { publicErrorMessage } from "@/lib/public-error";

export const Route = createFileRoute("/_authenticated/carteira")({ component: CarteiraDigital });

type TokenResult = { token: string; short_code: string; expires_at: string };

function CarteiraDigital() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("Bafafã");
  const [segment, setSegment] = useState("Bafafã novo");
  const [token, setToken] = useState<TokenResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name,current_segment")
      .eq("id", user.id)
      .maybeSingle();
    if (data) {
      setDisplayName(data.display_name ?? "Bafafã");
      setSegment(String(data.current_segment ?? "bafafa_novo").replaceAll("_", " "));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => void loadProfile(), [loadProfile]);

  const generate = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    const { data, error } = await supabase.rpc("create_my_qr_token", {
      _purpose: "customer",
      _ref_id: undefined,
    });
    setGenerating(false);
    if (error)
      return toast.error(publicErrorMessage(error, "Não foi possível gerar sua carteirinha."));
    const row = data?.[0] ?? null;
    if (!row?.token) return toast.error("Não foi possível gerar o código. Tente novamente.");
    setToken(row as TokenResult);
  }, [generating]);

  useEffect(() => {
    if (!loading && !token) void generate();
  }, [generate, loading, token]);

  return (
    <AppShell>
      <ScreenHeader eyebrow="Identificação do clube" title="Carteirinha digital" tone="blue" />
      <div className="space-y-5 px-5 pt-3">
        <section className="poster-card checker-texture overflow-hidden bg-mango p-5 text-foreground">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="section-kicker opacity-65">Clube dos Bafafãs</p>
              <h2 className="mt-2 font-display text-4xl leading-none">{displayName}</h2>
              <p className="mt-2 text-sm font-black capitalize">{segment}</p>
            </div>
            <div className="grid h-14 w-14 place-items-center rounded-2xl border-2 border-foreground bg-white shadow-[3px_4px_0_var(--foreground)]">
              <IdCard className="h-7 w-7" />
            </div>
          </div>
          <div className="mt-6 rounded-3xl border-2 border-foreground bg-white p-4 text-center shadow-[4px_5px_0_var(--foreground)]">
            {loading || generating ? (
              <div className="grid min-h-64 place-items-center">
                <Loader2 className="h-7 w-7 animate-spin" />
              </div>
            ) : token ? (
              <SecureQr
                value={token.token}
                shortCode={token.short_code}
                expiresAt={token.expires_at}
                size={220}
              />
            ) : (
              <button
                type="button"
                onClick={() => void generate()}
                className="min-h-64 w-full font-black"
              >
                Gerar minha carteirinha
              </button>
            )}
          </div>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-sm font-black">
            <ShoppingBag className="h-4 w-4" /> Mostre antes da compra
          </p>
        </section>

        <section className="sticker-card bg-card p-5">
          <h3 className="font-display text-2xl">Pra que serve?</h3>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            A equipe identifica sua conta, vincula a compra ao evento e atualiza seu progresso sem
            pedir telefone ou dados pessoais no balcão.
          </p>
          <p className="mt-3 flex items-center gap-2 text-xs font-bold text-muted-foreground">
            <LockKeyhole className="h-4 w-4" /> Código temporário, sem dados pessoais e de uso
            único.
          </p>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
          >
            <RefreshCw className={`h-4 w-4 ${generating ? "animate-spin" : ""}`} /> Renovar código
          </button>
        </section>
      </div>
    </AppShell>
  );
}
