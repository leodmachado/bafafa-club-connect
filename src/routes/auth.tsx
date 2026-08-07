import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Check,
  ArrowLeft,
  Circle,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  MessageCircleMore,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BafafaSign } from "@/components/brand/bafafa-sign";
import { TurnstileChallenge, useAuthCaptcha } from "@/components/auth/turnstile";
import { friendlyAuthError, isPrivilegedRole, validatePassword } from "@/lib/auth-security";
import { formatPhoneBR, normalizePhoneE164BR } from "@/lib/commercial";
import { checkCommunityContent, NAME_MODERATION_MESSAGE } from "@/lib/content-moderation";

type Mode = "signin" | "signup" | "reset";
type PhoneStep = "phone" | "code";

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
    birth_date: z.string().min(10, "Informe sua data de nascimento."),
    accept_terms: z.literal(true, { errorMap: () => ({ message: "Precisa aceitar os termos." }) }),
    accept_privacy: z.literal(true, {
      errorMap: () => ({ message: "Precisa aceitar a política de privacidade." }),
    }),
    accept_community: z.literal(true, {
      errorMap: () => ({ message: "Precisa aceitar as regras da comunidade." }),
    }),
    is_over_18: z.literal(true, { errorMap: () => ({ message: "Só maiores de 18 anos." }) }),
    marketing_opt_in: z.boolean().optional().default(false),
  })
  .superRefine((value, context) => {
    const password = validatePassword(value.password);
    for (const issue of password.issues) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: issue });
    }
    if (value.password !== value.password_confirm) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["password_confirm"],
        message: "As senhas precisam ser iguais.",
      });
    }
    if (!isAdultBirthDate(value.birth_date)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["birth_date"],
        message: "O clube é exclusivo para maiores de 18 anos.",
      });
    }
  });

function AuthPage() {
  const { mode: initialMode } = Route.useSearch();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [channel, setChannel] = useState<"phone" | "email">("phone");

  useEffect(() => setMode(initialMode), [initialMode]);

  return (
    <main className="app-canvas min-h-screen px-4 py-5 sm:py-7">
      <div className="mx-auto max-w-lg">
        <header className="flex items-center justify-between gap-4">
          <Link to="/" className="inline-flex max-w-[200px]" aria-label="Voltar ao início">
            <BafafaSign size="full" showCaption />
          </Link>
          <span className="rounded-full border border-foreground/15 bg-card px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.17em] text-muted-foreground">
            Clube do Bafafã
          </span>
        </header>

        <section className="mt-5 rounded-[28px] border-2 border-foreground bg-primary px-5 py-5 text-primary-foreground shadow-[4px_5px_0_var(--foreground)]">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-mango">Chega mais</p>
          <h1 className="mt-2 font-display text-3xl leading-none sm:text-4xl">
            Seu lugar na resenha começa aqui.
          </h1>
          <p className="mt-2 text-sm font-semibold text-primary-foreground/80">
            Entre pelo telefone ou pelo e-mail. O telefone é o caminho mais rápido.
          </p>
        </section>

        <div className="mt-5 grid grid-cols-2 rounded-2xl border-2 border-foreground bg-card p-1 text-sm font-black shadow-[3px_4px_0_var(--foreground)]">
          {(["signin", "signup"] as Mode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={`min-h-11 rounded-xl px-3 transition ${
                mode === item ? "bg-lagoa text-foreground" : "text-muted-foreground"
              }`}
            >
              {item === "signin" ? "Entrar" : "Criar cadastro"}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 rounded-2xl bg-muted p-1 text-sm font-black">
          <ChannelButton active={channel === "phone"} onClick={() => setChannel("phone")}>
            <MessageCircleMore className="h-4 w-4" /> Telefone
          </ChannelButton>
          <ChannelButton active={channel === "email"} onClick={() => setChannel("email")}>
            <Mail className="h-4 w-4" /> E-mail
          </ChannelButton>
        </div>

        <section className="sticker-card mt-4 bg-card p-4 sm:p-5">
          {channel === "phone" && mode === "signup" && <PhoneSignupForm />}
          {channel === "phone" && mode === "signin" && <PhoneSigninForm />}
          {channel === "phone" && mode === "reset" && (
            <div className="space-y-3 text-sm">
              <p className="font-black">No acesso por telefone não existe senha.</p>
              <p className="text-muted-foreground">Volte para Entrar e peça um novo código.</p>
              <button type="button" className={secondaryButton} onClick={() => setMode("signin")}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
            </div>
          )}
          {channel === "email" && mode === "signup" && (
            <EmailSignupForm onDone={() => setMode("signin")} />
          )}
          {channel === "email" && mode === "signin" && (
            <EmailSigninForm onForgot={() => setMode("reset")} />
          )}
          {channel === "email" && mode === "reset" && (
            <ResetForm onDone={() => setMode("signin")} />
          )}
        </section>
      </div>
    </main>
  );
}

function ChannelButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 ${
        active ? "bg-background shadow-sm" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

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
    if (error) return toast.error(friendlyAuthError(error.message));
    setPhone(normalized);
    setStep("code");
    toast.success("Código enviado. Confira também a caixa de spam do celular.");
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
        <InfoBox icon={<ShieldCheck className="h-4 w-4" />} title="Código de acesso">
          Enviamos para {formatPhoneBR(phone)}. Se não aparecer, confira a pasta de spam do celular.
        </InfoBox>
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
        <SubmitButton loading={loading}>Confirmar e entrar</SubmitButton>
        <button type="button" onClick={() => setStep("phone")} className={textButton}>
          Trocar telefone
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <InfoBox icon={<Phone className="h-4 w-4" />} title="Entre sem senha">
        Você recebe um código por SMS. É o jeito mais rápido de entrar no Clube.
      </InfoBox>
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
      <SubmitButton loading={loading}>Receber código</SubmitButton>
    </form>
  );
}

function PhoneSignupForm() {
  const [step, setStep] = useState<PhoneStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    acceptTerms: false,
    acceptPrivacy: false,
    acceptCommunity: false,
    confirmAdult: false,
    marketing: false,
  });
  const [loading, setLoading] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizePhoneE164BR(phone);
    if (!/^\+55\d{10,11}$/.test(normalized)) return toast.error("Informe um telefone com DDD.");
    if (formData.firstName.trim().length < 2) return toast.error("Diz teu nome pra gente.");
    if (!isAdultBirthDate(birthDate))
      return toast.error("O clube é exclusivo para maiores de 18 anos.");
    if (!formData.confirmAdult) return toast.error("Confirme que você tem 18 anos ou mais.");
    if (!formData.acceptTerms) return toast.error("Aceite os Termos de Uso para continuar.");
    if (!formData.acceptPrivacy)
      return toast.error("Aceite a Política de Privacidade para continuar.");
    if (!formData.acceptCommunity)
      return toast.error("Aceite as regras da comunidade para continuar.");
    if (captcha.required && !captcha.token) return toast.error("Confirme o desafio de segurança.");

    setLoading(true);
    const displayName = [formData.firstName.trim(), formData.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    const moderationStatus = await checkCommunityContent(displayName, "display_name");
    if (moderationStatus === "blocked") {
      setLoading(false);
      return toast.error(NAME_MODERATION_MESSAGE);
    }

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
          birth_date: birthDate,
          is_over_18: true,
          accept_terms: true,
          accept_privacy: true,
          accept_community: true,
          marketing_opt_in: formData.marketing,
          consent_version: "2.1",
        },
      },
    });
    setLoading(false);
    captcha.reset();
    if (error) return toast.error(friendlyAuthError(error.message));
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
        <InfoBox title="Confirme seu telefone">
          Digite o código enviado para {formatPhoneBR(phone)}.
        </InfoBox>
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
        <SubmitButton loading={loading}>Confirmar cadastro</SubmitButton>
        <button type="button" onClick={() => setStep("phone")} className={textButton}>
          Corrigir meus dados
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestCode} className="space-y-4">
      <p className="text-sm font-semibold text-muted-foreground">
        Só pedimos o necessário para reconhecer você e liberar os benefícios do Clube.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nome" hint="Pode ser o nome que você usa no dia a dia.">
          <input
            value={formData.firstName}
            onChange={(event) =>
              setFormData((current) => ({ ...current, firstName: event.target.value }))
            }
            required
            className={inputCls}
            autoComplete="given-name"
          />
        </Field>
        <Field label="Sobrenome">
          <input
            value={formData.lastName}
            onChange={(event) =>
              setFormData((current) => ({ ...current, lastName: event.target.value }))
            }
            className={inputCls}
            autoComplete="family-name"
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
      <BirthDateSelect value={birthDate} onChange={setBirthDate} />
      <ConsentBox>
        <ConsentControl
          checked={formData.confirmAdult}
          onChange={(checked) => setFormData((current) => ({ ...current, confirmAdult: checked }))}
          label="Confirmo que tenho 18 anos ou mais."
        />
        <LegalConsent
          checked={formData.acceptTerms}
          onChange={(checked) => setFormData((current) => ({ ...current, acceptTerms: checked }))}
          prefix="Li e aceito os"
          text="Termos de Uso"
          hash="termos"
        />
        <LegalConsent
          checked={formData.acceptPrivacy}
          onChange={(checked) => setFormData((current) => ({ ...current, acceptPrivacy: checked }))}
          prefix="Li e aceito a"
          text="Política de Privacidade"
          hash="privacidade"
        />
        <LegalConsent
          checked={formData.acceptCommunity}
          onChange={(checked) =>
            setFormData((current) => ({ ...current, acceptCommunity: checked }))
          }
          prefix="Li e aceito as"
          text="Regras da Comunidade"
          hash="comunidade"
        />
        <ConsentControl
          checked={formData.marketing}
          onChange={(checked) => setFormData((current) => ({ ...current, marketing: checked }))}
          label="Quero receber Fofoquinhas e novidades pelo telefone. (Opcional)"
        />
      </ConsentBox>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <SubmitButton loading={loading}>Receber código e entrar</SubmitButton>
    </form>
  );
}

function EmailSignupForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    const form = new FormData(event.currentTarget);
    const raw = {
      display_name: form.get("display_name") as string,
      email: form.get("email") as string,
      password,
      password_confirm: passwordConfirm,
      birth_date: birthDate,
      accept_terms: form.get("accept_terms") === "on",
      accept_privacy: form.get("accept_privacy") === "on",
      accept_community: form.get("accept_community") === "on",
      is_over_18: form.get("is_over_18") === "on",
      marketing_opt_in: form.get("marketing_opt_in") === "on",
    };
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as string;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      return;
    }
    if (captcha.required && !captcha.token) {
      setErrors({ captcha: "Confirme o desafio de segurança." });
      return;
    }

    setLoading(true);
    const data = parsed.data;
    const moderationStatus = await checkCommunityContent(data.display_name, "display_name");
    if (moderationStatus === "blocked") {
      setLoading(false);
      setErrors({ display_name: NAME_MODERATION_MESSAGE });
      return;
    }

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
          consent_version: "2.1",
        },
      },
    });
    setLoading(false);
    captcha.reset();
    if (error) return toast.error(friendlyAuthError(error.message));
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
      <p className="text-sm font-semibold text-muted-foreground">
        Crie sua conta com e-mail. Mostramos cada requisito da senha enquanto você digita.
      </p>
      <Field label="Como te chamamos?" hint="Seu nome ou apelido." error={errors.display_name}>
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
        label="Crie uma senha"
        value={password}
        onChange={setPassword}
        show={showPassword}
        onToggle={() => setShowPassword((current) => !current)}
        error={errors.password}
      />
      <PasswordChecklist password={password} />
      <PasswordField
        label="Repita a senha"
        value={passwordConfirm}
        onChange={setPasswordConfirm}
        show={showPassword}
        onToggle={() => setShowPassword((current) => !current)}
        error={errors.password_confirm}
      />
      <BirthDateSelect value={birthDate} onChange={setBirthDate} error={errors.birth_date} />
      <ConsentBox>
        <Consent
          name="is_over_18"
          error={errors.is_over_18}
          label="Confirmo que tenho 18 anos ou mais."
        />
        <LegalConsentUncontrolled
          name="accept_terms"
          error={errors.accept_terms}
          prefix="Li e aceito os"
          text="Termos de Uso"
          hash="termos"
        />
        <LegalConsentUncontrolled
          name="accept_privacy"
          error={errors.accept_privacy}
          prefix="Li e aceito a"
          text="Política de Privacidade"
          hash="privacidade"
        />
        <LegalConsentUncontrolled
          name="accept_community"
          error={errors.accept_community}
          prefix="Li e aceito as"
          text="Regras da Comunidade"
          hash="comunidade"
        />
        <Consent
          name="marketing_opt_in"
          label="Quero receber promoções e novidades do Bafafá. (Opcional)"
        />
      </ConsentBox>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      {errors.captcha && <p className="text-xs font-semibold text-destructive">{errors.captcha}</p>}
      <SubmitButton loading={loading}>Entrar pro Clube</SubmitButton>
    </form>
  );
}

function EmailSigninForm({ onForgot }: { onForgot: () => void }) {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const captcha = useAuthCaptcha();
  const navigate = useNavigate();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (captcha.required && !captcha.token) return toast.error("Confirme o desafio de segurança.");
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: (form.get("email") as string).trim(),
      password: form.get("password") as string,
      options: { captchaToken: captcha.token ?? undefined },
    });
    setLoading(false);
    captcha.reset();
    if (error) return toast.error(friendlyAuthError(error.message));

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
        <input name="email" type="email" autoComplete="email" required className={inputCls} />
      </Field>
      <PasswordInput
        name="password"
        show={showPassword}
        onToggle={() => setShowPassword((current) => !current)}
      />
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <SubmitButton loading={loading}>Entrar</SubmitButton>
      <button type="button" onClick={onForgot} className={textButton}>
        Esqueci minha senha
      </button>
    </form>
  );
}

function ResetForm({ onDone }: { onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const captcha = useAuthCaptcha();

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = (form.get("email") as string).trim();
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
      <p className="text-sm text-muted-foreground">Digite seu e-mail para criar uma nova senha.</p>
      <Field label="E-mail">
        <input name="email" type="email" required className={inputCls} />
      </Field>
      <TurnstileChallenge onToken={captcha.onToken} resetKey={captcha.resetKey} />
      <SubmitButton loading={loading}>Enviar link</SubmitButton>
    </form>
  );
}

function BirthDateSelect({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const initialParts = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { year: "", month: "", day: "" };
    const [year, month, day] = value.split("-");
    return { year, month, day };
  }, [value]);
  const [year, setYear] = useState(initialParts.year);
  const [month, setMonth] = useState(initialParts.month);
  const [day, setDay] = useState(initialParts.day);

  useEffect(() => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const [nextYear, nextMonth, nextDay] = value.split("-");
    setYear(nextYear);
    setMonth(nextMonth);
    setDay(nextDay);
  }, [value]);

  const years = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 83 }, (_, index) => String(currentYear - 18 - index));
  }, []);
  const daysInMonth = year && month ? new Date(Number(year), Number(month), 0).getDate() : 31;
  const days = Array.from({ length: daysInMonth }, (_, index) =>
    String(index + 1).padStart(2, "0"),
  );

  function publish(nextYear: string, nextMonth: string, nextDay: string) {
    if (nextYear && nextMonth && nextDay) {
      onChange(`${nextYear}-${nextMonth}-${nextDay}`);
    } else {
      onChange("");
    }
  }

  function updateYear(nextYear: string) {
    setYear(nextYear);
    const nextDaysInMonth =
      nextYear && month ? new Date(Number(nextYear), Number(month), 0).getDate() : 31;
    const nextDay = day && Number(day) <= nextDaysInMonth ? day : "";
    setDay(nextDay);
    publish(nextYear, month, nextDay);
  }

  function updateMonth(nextMonth: string) {
    setMonth(nextMonth);
    const nextDaysInMonth =
      year && nextMonth ? new Date(Number(year), Number(nextMonth), 0).getDate() : 31;
    const nextDay = day && Number(day) <= nextDaysInMonth ? day : "";
    setDay(nextDay);
    publish(year, nextMonth, nextDay);
  }

  function updateDay(nextDay: string) {
    setDay(nextDay);
    publish(year, month, nextDay);
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-semibold">Data de nascimento</legend>
      <div className="grid grid-cols-[0.8fr_1.2fr_1fr] gap-2">
        <select
          value={day}
          onChange={(event) => updateDay(event.target.value)}
          className={selectCls}
          aria-label="Dia de nascimento"
        >
          <option value="">Dia</option>
          {days.map((item) => (
            <option key={item} value={item}>
              {Number(item)}
            </option>
          ))}
        </select>
        <select
          value={month}
          onChange={(event) => updateMonth(event.target.value)}
          className={selectCls}
          aria-label="Mês de nascimento"
        >
          <option value="">Mês</option>
          {MONTHS.map((item, index) => (
            <option key={item} value={String(index + 1).padStart(2, "0")}>
              {item}
            </option>
          ))}
        </select>
        <select
          value={year}
          onChange={(event) => updateYear(event.target.value)}
          className={selectCls}
          aria-label="Ano de nascimento"
        >
          <option value="">Ano</option>
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Escolha na ordem brasileira: dia, mês e ano (DD/MM/AAAA).
      </p>
      {error && <p className="mt-1 text-xs font-semibold text-destructive">{error}</p>}
    </fieldset>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const rules = [
    [password.length >= 12, "12 caracteres ou mais"],
    [/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(password), "uma letra maiúscula"],
    [/[a-záàâãéèêíïóôõöúçñ]/.test(password), "uma letra minúscula"],
    [/\d/.test(password), "um número"],
    [/[^A-Za-zÀ-ÿ0-9]/.test(password), "um símbolo"],
    [
      password.length > 0 && !/password|senha|123456|qwerty|bafafa/i.test(password),
      "sem palavras ou sequências fáceis",
    ],
  ] as const;

  return (
    <div className="rounded-2xl border border-foreground/10 bg-muted/60 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
        Sua senha precisa ter
      </p>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {rules.map(([valid, label]) => (
          <div
            key={label}
            className={`flex items-center gap-2 text-xs font-semibold ${valid ? "text-primary" : "text-muted-foreground"}`}
          >
            {valid ? <Check className="h-4 w-4" /> : <Circle className="h-3.5 w-3.5" />}
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
  error?: string;
}) {
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          required
          className={`${inputCls} pr-12`}
        />
        <EyeButton show={show} onToggle={onToggle} />
      </div>
    </Field>
  );
}

function PasswordInput({
  name,
  show,
  onToggle,
}: {
  name: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <Field label="Senha">
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete="current-password"
          required
          className={`${inputCls} pr-12`}
        />
        <EyeButton show={show} onToggle={onToggle} />
      </div>
    </Field>
  );
}

function EyeButton({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? "Ocultar senha" : "Mostrar senha"}
      className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
    >
      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}

function LegalConsent({
  checked,
  onChange,
  prefix,
  text,
  hash,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  prefix: string;
  text: string;
  hash: string;
}) {
  return (
    <ConsentControl
      checked={checked}
      onChange={onChange}
      label={
        <>
          {prefix}{" "}
          <Link
            to="/privacidade"
            hash={hash}
            target="_blank"
            className="font-black underline decoration-2 underline-offset-2"
          >
            {text}
          </Link>
          .
        </>
      }
    />
  );
}

function LegalConsentUncontrolled({
  name,
  error,
  prefix,
  text,
  hash,
}: {
  name: string;
  error?: string;
  prefix: string;
  text: string;
  hash: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input name={name} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
        <span className="text-sm">
          {prefix}{" "}
          <Link
            to="/privacidade"
            hash={hash}
            target="_blank"
            className="font-black underline decoration-2 underline-offset-2"
          >
            {text}
          </Link>
          .
        </span>
      </label>
      {error && <span className="ml-8 block text-xs text-destructive">{error}</span>}
    </div>
  );
}

function Consent({ name, label, error }: { name: string; label: string; error?: string }) {
  return (
    <div>
      <label className="flex items-start gap-3">
        <input name={name} type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" />
        <span className="text-sm">{label}</span>
      </label>
      {error && <span className="ml-8 block text-xs text-destructive">{error}</span>}
    </div>
  );
}

function ConsentControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
      />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function ConsentBox({ children }: { children: ReactNode }) {
  return <div className="space-y-3 rounded-2xl bg-muted p-4 text-sm">{children}</div>;
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
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-semibold text-destructive">{error}</span>}
    </label>
  );
}

function InfoBox({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-mango/35 p-4 text-sm">
      <p className="flex items-center gap-2 font-black">
        {icon}
        {title}
      </p>
      <p className="mt-1 text-muted-foreground">{children}</p>
    </div>
  );
}

function SubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={loading} className={primaryButton}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />} {children}
    </button>
  );
}

function isAdultBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day)
    return false;
  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return birth <= cutoff;
}

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const inputCls =
  "w-full min-h-12 rounded-xl border-2 border-foreground/20 bg-surface px-4 py-3 text-base font-semibold outline-none transition focus:border-electric focus:ring-4 focus:ring-lagoa/20";
const selectCls =
  "w-full min-h-12 rounded-xl border-2 border-foreground/20 bg-surface px-2 py-3 text-base font-bold outline-none focus:border-electric focus:ring-4 focus:ring-lagoa/20";
const primaryButton =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-base font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-foreground px-4 py-3 font-black";
const textButton =
  "w-full min-h-11 py-2 text-sm font-semibold text-muted-foreground underline-offset-4 hover:underline";
