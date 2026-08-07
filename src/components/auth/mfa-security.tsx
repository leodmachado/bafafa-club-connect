import { publicErrorMessage } from "@/lib/public-error";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { isPrivilegedRole } from "@/lib/auth-security";
import { TurnstileChallenge, useAuthCaptcha } from "@/components/auth/turnstile";

export type MfaFactor = {
  id: string;
  friendly_name?: string | null;
  factor_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

type Aal = "aal1" | "aal2" | null;

type MfaState = {
  loading: boolean;
  currentLevel: Aal;
  nextLevel: Aal;
  factors: MfaFactor[];
  error: string | null;
};

const initialState: MfaState = {
  loading: true,
  currentLevel: null,
  nextLevel: null,
  factors: [],
  error: null,
};

function normalizeFactors(data: unknown): MfaFactor[] {
  const candidate = data as {
    all?: MfaFactor[];
    totp?: MfaFactor[];
    phone?: MfaFactor[];
  } | null;
  const values = candidate?.all ?? [...(candidate?.totp ?? []), ...(candidate?.phone ?? [])];
  return values.filter(
    (factor, index, array) => array.findIndex((item) => item.id === factor.id) === index,
  );
}

export function useMfaSecurity() {
  const [state, setState] = useState<MfaState>(initialState);

  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }));
    const [aalResult, factorsResult] = await Promise.all([
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      supabase.auth.mfa.listFactors(),
    ]);
    const error = aalResult.error ?? factorsResult.error;
    if (error) {
      setState({ ...initialState, loading: false, error: publicErrorMessage(error) });
      return;
    }
    const aalData = aalResult.data;
    setState({
      loading: false,
      currentLevel: (aalData?.currentLevel as Aal | undefined) ?? "aal1",
      nextLevel: (aalData?.nextLevel as Aal | undefined) ?? "aal1",
      factors: normalizeFactors(factorsResult.data),
      error: null,
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}

export function MfaGate({
  children,
  label = "área protegida",
}: {
  children: ReactNode;
  label?: string;
}) {
  const security = useMfaSecurity();
  const verifiedFactors = security.factors.filter((factor) => factor.status === "verified");

  if (security.loading) {
    return (
      <MfaFrame>
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Confirmando a segurança da sessão…</p>
      </MfaFrame>
    );
  }

  if (security.error) {
    return (
      <MfaFrame>
        <ShieldOff className="h-9 w-9 text-destructive" />
        <h1 className="font-display text-2xl">Não deu para confirmar sua sessão</h1>
        <p className="text-sm text-muted-foreground">{security.error}</p>
        <button className={primaryButton} onClick={() => void security.refresh()}>
          <RefreshCw className="h-4 w-4" /> Tentar novamente
        </button>
      </MfaFrame>
    );
  }

  if (security.currentLevel === "aal2") return <>{children}</>;

  return (
    <MfaFrame>
      <ShieldCheck className="h-10 w-10 text-primary" />
      <p className="section-kicker">Proteção obrigatória</p>
      <h1 className="font-display text-3xl">Mais uma confirmação antes de entrar.</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        A {label} trata dados e operações sensíveis. Administradores e equipe precisam confirmar o
        código do aplicativo autenticador.
      </p>
      {verifiedFactors.length > 0 ? (
        <MfaChallenge factor={verifiedFactors[0]} onSuccess={security.refresh} />
      ) : (
        <MfaEnrollment required onSuccess={security.refresh} />
      )}
      <Link
        to="/inicio"
        className="inline-flex items-center gap-2 text-sm font-black underline underline-offset-4"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao aplicativo
      </Link>
    </MfaFrame>
  );
}

export function MfaSecurityCenter() {
  const { roles, user } = useAuth();
  const security = useMfaSecurity();
  const router = useRouter();
  const privileged = isPrivilegedRole(roles);
  const verifiedFactors = security.factors.filter((factor) => factor.status === "verified");
  const [working, setWorking] = useState(false);
  const captcha = useAuthCaptcha();

  const statusLabel = useMemo(() => {
    if (security.currentLevel === "aal2") return "Sessão com proteção reforçada";
    if (verifiedFactors.length > 0)
      return "Segundo fator cadastrado, mas ainda não confirmado nesta sessão";
    return "Segundo fator ainda não configurado";
  }, [security.currentLevel, verifiedFactors.length]);

  async function removeFactor(factor: MfaFactor) {
    if (security.currentLevel !== "aal2") {
      toast.error("Confirme o código do autenticador antes de remover um dispositivo.");
      return;
    }
    if (privileged && verifiedFactors.length <= 1) {
      toast.error("Contas privilegiadas precisam manter pelo menos um segundo fator ativo.");
      return;
    }
    if (!window.confirm(`Remover ${factor.friendly_name || "este autenticador"}?`)) return;
    setWorking(true);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
    setWorking(false);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("Autenticador removido.");
    await security.refresh();
  }

  async function signOutOtherSessions() {
    setWorking(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setWorking(false);
    if (error) return toast.error(publicErrorMessage(error));
    toast.success("As outras sessões foram encerradas.");
  }

  async function signOutEverywhere() {
    if (!window.confirm("Sair de todos os aparelhos, inclusive deste?")) return;
    setWorking(true);
    const { error } = await supabase.auth.signOut({ scope: "global" });
    setWorking(false);
    if (error) return toast.error(publicErrorMessage(error));
    router.navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  async function requestPasswordChange() {
    if (!user?.email) return toast.error("Sua conta não possui e-mail cadastrado.");
    if (captcha.required && !captcha.token) {
      return toast.error("Confirme o desafio de segurança antes de pedir o link.");
    }
    setWorking(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captcha.token ?? undefined,
    });
    setWorking(false);
    captcha.reset();
    if (error) return toast.error("Não foi possível enviar o link agora.");
    toast.success("Enviamos um link de troca de senha para seu e-mail.");
  }

  if (security.loading)
    return (
      <MfaFrame>
        <Loader2 className="h-6 w-6 animate-spin" />
        <p>Carregando segurança da conta…</p>
      </MfaFrame>
    );

  return (
    <div className="space-y-5">
      <section className="sticker-card bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-foreground bg-primary text-primary-foreground shadow-[2px_3px_0_var(--foreground)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-kicker text-muted-foreground">Segurança da conta</p>
            <h2 className="font-display text-2xl">{statusLabel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {privileged
                ? "Esse reforço é obrigatório para acessar administração, moderação e validação operacional."
                : "Você pode ativar a proteção por aplicativo autenticador mesmo sem ter função administrativa."}
            </p>
          </div>
        </div>
      </section>

      {security.error && (
        <section className="rounded-2xl border-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
          {security.error}
        </section>
      )}

      {verifiedFactors.length === 0 ? (
        <MfaEnrollment required={privileged} onSuccess={security.refresh} />
      ) : security.currentLevel !== "aal2" ? (
        <MfaChallenge factor={verifiedFactors[0]} onSuccess={security.refresh} />
      ) : (
        <section className="sticker-card bg-card p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <h2 className="font-display text-2xl">Autenticadores</h2>
          </div>
          <div className="mt-4 space-y-3">
            {verifiedFactors.map((factor) => (
              <div
                key={factor.id}
                className="flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-muted/40 p-3"
              >
                <Smartphone className="h-5 w-5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">
                    {factor.friendly_name || "Aplicativo autenticador"}
                  </p>
                  <p className="text-xs text-muted-foreground">TOTP · ativo</p>
                </div>
                <button
                  type="button"
                  disabled={working || (privileged && verifiedFactors.length <= 1)}
                  onClick={() => void removeFactor(factor)}
                  className="grid h-9 w-9 place-items-center rounded-full border-2 border-foreground/20 disabled:cursor-not-allowed disabled:opacity-35"
                  aria-label="Remover autenticador"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {verifiedFactors.length > 0 && security.currentLevel === "aal2" && (
        <MfaEnrollment additional required={false} onSuccess={security.refresh} />
      )}

      <section className="sticker-card bg-card p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5" />
          <h2 className="font-display text-2xl">Senha e sessões</h2>
        </div>
        <div className="mt-4 grid gap-3">
          <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
          <button
            type="button"
            disabled={working || (captcha.required && !captcha.token)}
            onClick={() => void requestPasswordChange()}
            className={secondaryButton}
          >
            <KeyRound className="h-4 w-4" /> Enviar link para trocar a senha
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void signOutOtherSessions()}
            className={secondaryButton}
          >
            <LogOut className="h-4 w-4" /> Encerrar sessões em outros aparelhos
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void signOutEverywhere()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-black text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sair de todos os aparelhos
          </button>
        </div>
      </section>
    </div>
  );
}

function MfaEnrollment({
  required,
  additional = false,
  onSuccess,
}: {
  required: boolean;
  additional?: boolean;
  onSuccess: () => Promise<void> | void;
}) {
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const qrSource = useMemo(() => {
    if (!qrCode) return null;
    if (qrCode.startsWith("data:")) return qrCode;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`;
  }, [qrCode]);

  async function start() {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `${additional ? "Bafafá adicional" : "Bafafá"} ${new Date().toLocaleDateString("pt-BR")}`,
    });
    setLoading(false);
    if (error) return toast.error(publicErrorMessage(error));
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
  }

  async function verify() {
    if (!factorId || code.replace(/\D/g, "").length !== 6) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code: code.replace(/\D/g, ""),
    });
    setLoading(false);
    if (error) return toast.error("Código incorreto ou vencido. Confira o autenticador.");
    toast.success("Proteção em duas etapas ativada.");
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    setCode("");
    await onSuccess();
  }

  return (
    <section className="sticker-card bg-card p-5">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">
          {additional ? "Adicionar outro autenticador" : "Ativar aplicativo autenticador"}
        </h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {additional
          ? "Um segundo autenticador reduz o risco de perder o acesso à conta. "
          : required
            ? "Obrigatório para sua função. "
            : "Opcional, mas recomendado. "}
        Use Google Authenticator, Microsoft Authenticator, 1Password ou outro aplicativo TOTP.
      </p>
      {!factorId ? (
        <button
          type="button"
          disabled={loading}
          onClick={() => void start()}
          className={`${primaryButton} mt-4`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Smartphone className="h-4 w-4" />
          )}{" "}
          {additional ? "Adicionar autenticador" : "Configurar agora"}
        </button>
      ) : (
        <div className="mt-4 space-y-4">
          {qrSource && (
            <div className="mx-auto max-w-64 rounded-2xl border-2 border-foreground/15 bg-white p-4">
              <img
                src={qrSource}
                alt="QR Code para configurar autenticação em duas etapas"
                className="mx-auto w-full"
              />
            </div>
          )}
          {secret && (
            <div className="rounded-2xl bg-muted p-3 text-xs">
              <p className="font-black">Não consegue ler o QR?</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg bg-background p-2 font-mono">
                  {secret}
                </code>
                <button
                  type="button"
                  aria-label="Copiar segredo"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(secret)
                      .then(() => toast.success("Código copiado."))
                  }
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-foreground/20"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-black">Código de 6 dígitos</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              className={codeInput}
              placeholder="000000"
            />
          </label>
          <button
            type="button"
            disabled={loading || code.length !== 6}
            onClick={() => void verify()}
            className={primaryButton}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Ativar proteção
          </button>
        </div>
      )}
    </section>
  );
}

function MfaChallenge({
  factor,
  onSuccess,
}: {
  factor: MfaFactor;
  onSuccess: () => Promise<void> | void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function verify() {
    if (code.length !== 6) return;
    setLoading(true);
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    setLoading(false);
    if (error) return toast.error("Código incorreto ou vencido.");
    toast.success("Sessão protegida confirmada.");
    await onSuccess();
  }

  return (
    <section className="sticker-card bg-card p-5 text-left">
      <div className="flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        <h2 className="font-display text-2xl">Digite o código do autenticador</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Abra seu aplicativo autenticador e informe o código atual.
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(event) => {
          if (event.key === "Enter") void verify();
        }}
        className={`${codeInput} mt-4`}
        placeholder="000000"
      />
      <button
        type="button"
        disabled={loading || code.length !== 6}
        onClick={() => void verify()}
        className={`${primaryButton} mt-3`}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar
      </button>
    </section>
  );
}

function MfaFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-canvas grid min-h-screen place-items-center px-5 py-10">
      <div className="w-full max-w-md space-y-4 text-center">{children}</div>
    </div>
  );
}

const primaryButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-50";
const secondaryButton =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground/20 bg-background px-4 py-3 text-sm font-black disabled:opacity-50";
const codeInput =
  "w-full rounded-2xl border-2 border-foreground/20 bg-background px-4 py-3 text-center font-mono text-2xl font-black tracking-[0.35em] outline-none focus:border-primary focus:ring-4 focus:ring-primary/15";
