import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/brand/wordmark";
import { Eye, EyeOff, Loader2, Mail, MessageCircleMore, Phone, ShieldCheck } from "lucide-react";
import { TurnstileChallenge, useAuthCaptcha } from "@/components/auth/turnstile";
import { friendlyAuthError, isPrivilegedRole, validatePassword } from "@/lib/auth-security";
import { formatPhoneBR, normalizePhoneE164BR } from "@/lib/commercial";

type Mode = "signin" | "signup" | "reset";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "reset"]).catch("signin"),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/inicio" });
  },
  component: AuthPage,
});

const signupSchema = z
  .object({
    display_name: z.string().trim().min(2, "Diz teu nome, Bafafã.").max(80),
    email: z.string().trim().email("E-mail inválido.").max(255),
    password: z.string(),
    password_confirm: z.string(),
    birth_date: z.string().min(10, "Data de nascimento obrigatória."),
    accept_terms: z.literal(true, { errorMap: () => ({ message: "Precisa aceitar os termos." }) }),
    accept_privacy: z.literal(true, {
      errorMap: () => ({ message: "Precisa aceitar a política de privacidade." }),
    }),
    is_over_18: z.literal(true, { errorMap: () => ({ message: "Só maiores de 18 anos." }) }),
    marketing_opt_in: z.boolean().optional().default(false),
  })
  .refine((value) => validatePassword(value.password).valid, {
    message: "A senha não atende aos requisitos de segurança.",
    path: ["password"],
  })
  .refine((value) => value.password === value.password_confirm, {
    message: "As senhas precisam ser iguais.",
    path: ["password_confirm"],
  })
  .refine(
    (value) => {
      const date = new Date(value.birth_date);
      if (Number.isNaN(date.getTime())) return false;
      const age = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      return age >= 18;
    },
    { message: "Cadastro só para 18+.", path: ["birth_date"] },
  );

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [channel, setChannel] = useState<"phone" | "email">("phone");
  useEffect(() => setMode(initialMode), [initialMode]);

  return (
    <div className="app-canvas min-h-screen px-4 py-6">
      <div className="mx-auto max-w-lg">
        <div className="flex justify-center">
          <Link to="/" className="inline-block">
            <Wordmark variant="full" />
          </Link>
        </div>
        <div className="poster-card checker-texture mt-6 p-4 text-center text-foreground">
          <p className="section-kicker">Cerveja gelada e batucada</p>
          <h1 className="mt-2 font-display text-4xl leading-none">
            Seu lugar na resenha começa aqui.
          </h1>
        </div>
        <div className="mt-6 flex rounded-2xl border-2 border-foreground bg-card p-1 text-sm font-black shadow-[3px_4px_0_var(--foreground)]">
          {(["signin", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 rounded-full px-3 py-2 transition ${
                mode === m ? "bg-lagoa text-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Entrar" : "Criar cadastro"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-muted p-1 text-xs font-black">
          <button
            type="button"
            onClick={() => setChannel("phone")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 ${channel === "phone" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <MessageCircleMore className="h-4 w-4" /> Telefone
          </button>
          <button
            type="button"
            onClick={() => setChannel("email")}
            className={`inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 ${channel === "email" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <Mail className="h-4 w-4" /> E-mail de teste
          </button>
        </div>

        <div className="sticker-card mt-4 bg-card p-5">
          {channel === "phone" && mode === "signup" && <PhoneSignupForm />}
          {channel === "phone" && mode === "signin" && <PhoneSigninForm />}
          {channel === "phone" && mode === "reset" && (
            <div className="space-y-3 text-sm">
              <p className="font-black">No acesso por telefone não existe senha.</p>
              <p className="text-muted-foreground">Volte para Entrar e peça um novo código.</p>
              <button
                type="button"
                className="w-full rounded-xl border-2 border-foreground px-4 py-3 font-black"
                onClick={() => setMode("signin")}
              >
                Voltar
              </button>
            </div>
          )}
          {channel === "email" && mode === "signup" && (
            <SignupForm onDone={() => setMode("signin")} />
          )}
          {channel === "email" && mode === "signin" && (
            <SigninForm onForgot={() => setMode("reset")} />
          )}
          {channel === "email" && mode === "reset" && (
            <ResetForm onDone={() => setMode("signin")} />
          )}
        </div>
      </div>
    </div>
  );
}

type PhoneStep = "phone" | "code";

function PhoneSigninForm() {
  const [step, setStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (captcha.required && !captcha.token) return toast.error("Confirme o desafio de segurança.");
    const normalized = normalizePhoneE164BR(phone);
    if (!/^\+55\d{10,11}$/.test(normalized)) return toast.error("Informe um telefone com DDD.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: { shouldCreateUser: false, captchaToken: captcha.token ?? undefined },
    });
    setLoading(false);
    captcha.reset();
    if (error) {
      const message = error.message.toLowerCase().includes("provider")
        ? "O acesso por telefone ainda não foi ativado no Supabase. Use o e-mail de teste por enquanto."
        : friendlyAuthError(error.message);
      return toast.error(message);
    }
    setPhone(normalized);
    setStep("code");
    toast.success("Código enviado. Confira seu celular.");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Digite os seis números do código.");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message));
    toast.success("Achamos você. Bora pro Bafas!");
    navigate({ to: "/inicio" });
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="rounded-2xl bg-lagoa/40 p-4 text-sm">
          <p className="flex items-center gap-2 font-black">
            <ShieldCheck className="h-4 w-4" /> Código de acesso
          </p>
          <p className="mt-1 text-muted-foreground">
            Enviamos para {formatPhoneBR(phone)}. O código vence em poucos minutos.
          </p>
        </div>
        <Field label="Código de 6 números">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputCls} text-center font-mono text-2xl tracking-[0.35em]`}
            placeholder="000000"
            autoFocus
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar e entrar
        </button>
        <button
          type="button"
          onClick={() => {
            setStep("phone");
            setCode("");
          }}
          className="w-full py-2 text-sm font-semibold text-muted-foreground"
        >
          Trocar telefone
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <div className="rounded-2xl bg-mango/40 p-4 text-sm">
        <p className="flex items-center gap-2 font-black">
          <Phone className="h-4 w-4" /> Entre sem senha
        </p>
        <p className="mt-1 text-muted-foreground">
          Você recebe um código por SMS. Quando o WhatsApp estiver habilitado, o mesmo fluxo poderá
          usar o aplicativo.
        </p>
      </div>
      <Field label="Telefone com DDD">
        <input
          value={formatPhoneBR(phone)}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          required
          className={inputCls}
          placeholder="(84) 99999-9999"
        />
      </Field>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Receber código
      </button>
    </form>
  );
}

function PhoneSignupForm() {
  const [step, setStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    birthDate: "",
    marketing: true,
  });
  const [loading, setLoading] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizePhoneE164BR(phone);
    if (!/^\+55\d{10,11}$/.test(normalized)) return toast.error("Informe um telefone com DDD.");
    if (formData.firstName.trim().length < 2) return toast.error("Diz teu nome pra gente.");
    const birth = new Date(formData.birthDate);
    const age = (Date.now() - birth.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (!Number.isFinite(age) || age < 18)
      return toast.error("O clube é exclusivo para maiores de 18 anos.");
    if (captcha.required && !captcha.token) return toast.error("Confirme o desafio de segurança.");
    setLoading(true);
    const displayName = [formData.firstName.trim(), formData.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalized,
      options: {
        shouldCreateUser: true,
        captchaToken: captcha.token ?? undefined,
        data: {
          display_name: displayName,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim() || null,
          phone_e164: normalized,
          whatsapp: normalized,
          birth_date: formData.birthDate,
          is_over_18: true,
          accept_terms: true,
          accept_privacy: true,
          accept_community: true,
          marketing_opt_in: formData.marketing,
          consent_version: "2.0",
        },
      },
    });
    setLoading(false);
    captcha.reset();
    if (error) {
      const message = error.message.toLowerCase().includes("provider")
        ? "O acesso por telefone ainda não foi ativado no Supabase. Use o e-mail de teste por enquanto."
        : friendlyAuthError(error.message);
      return toast.error(message);
    }
    setPhone(normalized);
    setStep("code");
    toast.success("Código enviado. Falta só confirmar.");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(code)) return toast.error("Digite os seis números do código.");
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token: code, type: "sms" });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message));
    toast.success("Cadastro pronto. A primeira Fofoquinha está mais perto.");
    navigate({ to: "/inicio" });
  }

  if (step === "code") {
    return (
      <form onSubmit={verifyCode} className="space-y-4">
        <div className="rounded-2xl bg-lagoa/40 p-4 text-sm">
          <p className="font-black">Confirme seu telefone</p>
          <p className="mt-1 text-muted-foreground">
            Digite o código enviado para {formatPhoneBR(phone)}.
          </p>
        </div>
        <Field label="Código de 6 números">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            className={`${inputCls} text-center font-mono text-2xl tracking-[0.35em]`}
            autoFocus
          />
        </Field>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />} Confirmar cadastro
        </button>
        <button
          type="button"
          onClick={() => setStep("phone")}
          className="w-full py-2 text-sm font-semibold text-muted-foreground"
        >
          Corrigir meus dados
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground">
        Só pedimos o necessário para reconhecer você, liberar benefícios e mandar novidades com sua
        autorização.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome">
          <input
            value={formData.firstName}
            onChange={(event) =>
              setFormData((current) => ({ ...current, firstName: event.target.value }))
            }
            required
            className={inputCls}
          />
        </Field>
        <Field label="Sobrenome">
          <input
            value={formData.lastName}
            onChange={(event) =>
              setFormData((current) => ({ ...current, lastName: event.target.value }))
            }
            className={inputCls}
          />
        </Field>
      </div>
      <Field label="Telefone com DDD">
        <input
          value={formatPhoneBR(phone)}
          onChange={(event) => setPhone(event.target.value)}
          inputMode="tel"
          autoComplete="tel"
          required
          className={inputCls}
          placeholder="(84) 99999-9999"
        />
      </Field>
      <Field label="Nascimento">
        <input
          value={formData.birthDate}
          onChange={(event) =>
            setFormData((current) => ({ ...current, birthDate: event.target.value }))
          }
          type="date"
          required
          className={inputCls}
        />
      </Field>
      <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <p className="font-bold">
          Ao continuar, você confirma que tem 18 anos e aceita os Termos, a Privacidade e as regras
          da comunidade.
        </p>
        <label className="flex items-start gap-2">
          <input
            type="checkbox"
            checked={formData.marketing}
            onChange={(event) =>
              setFormData((current) => ({ ...current, marketing: event.target.checked }))
            }
            className="mt-1 h-4 w-4 accent-primary"
          />
          <span>Quero receber Fofoquinhas e novidades pelo telefone.</span>
        </label>
      </div>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Receber código e entrar
      </button>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-xl border-2 border-foreground/20 bg-surface px-4 py-3 text-base font-semibold outline-none transition focus:border-electric focus:ring-4 focus:ring-lagoa/20";

function SignupForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = {
      display_name: fd.get("display_name") as string,
      email: fd.get("email") as string,
      password: fd.get("password") as string,
      password_confirm: fd.get("password_confirm") as string,
      birth_date: fd.get("birth_date") as string,
      accept_terms: fd.get("accept_terms") === "on",
      accept_privacy: fd.get("accept_privacy") === "on",
      is_over_18: fd.get("is_over_18") === "on",
      marketing_opt_in: fd.get("marketing_opt_in") === "on",
    };
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) nextErrors[issue.path[0] as string] = issue.message;
      setErrors(nextErrors);
      return;
    }

    const data = parsed.data;
    if (captcha.required && !captcha.token) {
      setErrors({ captcha: "Confirme o desafio de segurança." });
      return;
    }
    setLoading(true);
    const { data: signUp, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/inicio`,
        captchaToken: captcha.token ?? undefined,
        data: {
          display_name: data.display_name,
          birth_date: data.birth_date,
          is_over_18: true,
          accept_terms: true,
          accept_privacy: true,
          accept_community: true,
          marketing_opt_in: data.marketing_opt_in,
          consent_version: "1.0",
        },
      },
    });
    setLoading(false);
    captcha.reset();
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }

    if (signUp.session) {
      toast.success("Cadastro criado! Você já entrou no Clube.");
      navigate({ to: "/inicio" });
      return;
    }

    toast.success("Cadastro criado! Agora entre com seu e-mail e senha.");
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-2xl bg-mango/40 p-4 text-sm">
        <p className="font-bold">Versão de desenvolvimento</p>
        <p className="mt-1 text-muted-foreground">
          Por enquanto usamos e-mail e senha para testar sem custo de SMS. O acesso por telefone
          entra antes do piloto com clientes reais.
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Só o essencial agora. Usuário, cidade e preferências você completa depois e ganha progresso
        no perfil.
      </p>
      <Field label="Como te chamamos?" error={errors.display_name}>
        <input
          name="display_name"
          required
          className={inputCls}
          placeholder="Seu nome ou apelido"
        />
      </Field>
      <Field label="E-mail" error={errors.email}>
        <input
          name="email"
          type="email"
          required
          className={inputCls}
          placeholder="voce@email.com"
        />
      </Field>
      <PasswordField
        label="Senha"
        name="password"
        show={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
        hint="Use 10+ caracteres, com letra e número."
        error={errors.password}
      />
      <PasswordField
        label="Confirmar senha"
        name="password_confirm"
        show={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
        error={errors.password_confirm}
      />
      <Field label="Nascimento" error={errors.birth_date}>
        <input name="birth_date" type="date" required className={inputCls} />
      </Field>

      <div className="space-y-2 rounded-2xl bg-muted p-4 text-sm">
        <Consent
          name="is_over_18"
          error={errors.is_over_18}
          label="Confirmo que tenho 18 anos ou mais."
        />
        <Consent
          name="accept_terms"
          error={errors.accept_terms}
          label="Li e aceito os Termos de Uso e a Política da Comunidade."
        />
        <Consent
          name="accept_privacy"
          error={errors.accept_privacy}
          label="Li e aceito a Política de Privacidade."
        />
        <Consent
          name="marketing_opt_in"
          label="(Opcional) Quero receber promoções e novidades do Bafafá."
        />
      </div>

      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      {errors.captcha && <p className="text-xs font-semibold text-destructive">{errors.captcha}</p>}

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar pro clube
      </button>
    </form>
  );
}

function Consent({ name, label, error }: { name: string; label: string; error?: string }) {
  return (
    <div>
      <label className="flex items-start gap-2">
        <input name={name} type="checkbox" className="mt-1 h-4 w-4 accent-primary" />
        <span className="text-sm">{label}</span>
      </label>
      {error && <span className="ml-6 block text-xs text-destructive">{error}</span>}
    </div>
  );
}

function SigninForm({ onForgot }: { onForgot: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (captcha.required && !captcha.token) {
      toast.error("Confirme o desafio de segurança.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (fd.get("email") as string).trim(),
      password: fd.get("password") as string,
      options: { captchaToken: captcha.token ?? undefined },
    });
    setLoading(false);
    captcha.reset();
    if (error) {
      toast.error(friendlyAuthError(error.message));
      return;
    }
    const userId = data.user?.id;
    let needsSecurity = false;
    if (userId) {
      const [{ data: roles }, { data: aal }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      ]);
      needsSecurity =
        isPrivilegedRole((roles ?? []).map((row) => row.role)) && aal?.currentLevel !== "aal2";
    }
    toast.success("Bem-vindo, Bafafã!");
    navigate({ to: needsSecurity ? "/seguranca" : "/inicio" });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="E-mail">
        <input name="email" type="email" required className={inputCls} />
      </Field>
      <PasswordField
        label="Senha"
        name="password"
        show={showPassword}
        onToggle={() => setShowPassword((value) => !value)}
      />
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
      </button>
      <button
        type="button"
        onClick={onForgot}
        className="w-full py-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline"
      >
        Esqueci minha senha
      </button>
    </form>
  );
}

function PasswordField({
  label,
  name,
  show,
  onToggle,
  hint,
  error,
}: {
  label: string;
  name: string;
  show: boolean;
  onToggle: () => void;
  hint?: string;
  error?: string;
}) {
  return (
    <Field label={label} hint={hint} error={error}>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          className={`${inputCls} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

function ResetForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const captcha = useAuthCaptcha();
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = (fd.get("email") as string).trim();
    if (captcha.required && !captcha.token) return toast.error("Confirme o desafio de segurança.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken: captcha.token ?? undefined,
    });
    setLoading(false);
    captcha.reset();
    if (error) return toast.error(friendlyAuthError(error.message));
    toast.success("Se o e-mail existir, você vai receber um link em instantes.");
    onDone();
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Digita teu e-mail que a gente manda o link pra criar uma nova senha.
      </p>
      <Field label="E-mail">
        <input name="email" type="email" required className={inputCls} />
      </Field>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Enviar link
      </button>
    </form>
  );
}
