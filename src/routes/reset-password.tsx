import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, KeyRound, Loader2, ShieldAlert } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import {
  clearPasswordRecovery,
  friendlyAuthError,
  markPasswordRecovery,
  readValidPasswordRecovery,
  validatePassword,
} from "@/lib/auth-security";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPassword,
});

type State = "checking" | "valid" | "invalid";

function ResetPassword() {
  const [state, setState] = useState<State>("checking");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setState(data.user && readValidPasswordRecovery(data.user.id) ? "valid" : "invalid");
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        markPasswordRecovery(session.user.id);
        if (mounted) setState("valid");
      }
    });

    void checkSession();
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = fd.get("password") as string;
    const confirmation = fd.get("password_confirm") as string;
    const check = validatePassword(password);
    if (!check.valid) return toast.error(check.issues[0]);
    if (password !== confirmation) return toast.error("As senhas precisam ser iguais.");

    const { data: userResult } = await supabase.auth.getUser();
    if (!userResult.user || !readValidPasswordRecovery(userResult.user.id)) {
      setState("invalid");
      return toast.error("Este link de recuperação não está mais válido.");
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) await supabase.auth.signOut({ scope: "others" });
    setLoading(false);
    if (error) return toast.error(friendlyAuthError(error.message));

    clearPasswordRecovery();
    toast.success("Senha atualizada e outras sessões encerradas.");
    navigate({ to: "/inicio", replace: true });
  }

  return (
    <div className="app-canvas min-h-screen px-5 py-8">
      <div className="mx-auto max-w-lg">
        <Wordmark variant="short" />

        {state === "checking" && (
          <div className="mt-10 flex items-center gap-3 rounded-2xl border-2 border-foreground/10 bg-card p-5">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p className="text-sm font-semibold">Confirmando seu link de recuperação…</p>
          </div>
        )}

        {state === "invalid" && (
          <div className="sticker-card mt-8 bg-card p-6 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-3 font-display text-3xl">Esse link já perdeu a validade.</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Por segurança, a troca de senha só fica disponível quando você chega por um link de
              recuperação válido.
            </p>
            <Link
              to="/auth"
              search={{ mode: "reset" }}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)]"
            >
              <KeyRound className="h-4 w-4" /> Pedir novo link
            </Link>
          </div>
        )}

        {state === "valid" && (
          <form onSubmit={onSubmit} className="sticker-card mt-8 space-y-4 bg-card p-6">
            <div>
              <p className="section-kicker text-muted-foreground">Recuperação segura</p>
              <h1 className="mt-1 font-display text-3xl">Nova senha, novo bafafá.</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Use pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo. Depois da
                troca, as outras sessões serão encerradas.
              </p>
            </div>
            <PasswordInput
              label="Senha nova"
              name="password"
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <PasswordInput
              label="Confirmar senha"
              name="password_confirm"
              show={showPassword}
              onToggle={() => setShowPassword((value) => !value)}
            />
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary py-3 font-black text-primary-foreground shadow-[3px_4px_0_var(--foreground)] disabled:opacity-60"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Salvar nova senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function PasswordInput({
  label,
  name,
  show,
  onToggle,
}: {
  label: string;
  name: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-black">{label}</span>
      <div className="relative">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          autoComplete="new-password"
          className="w-full rounded-2xl border-2 border-foreground/20 bg-surface px-4 py-3 pr-12 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </label>
  );
}
