import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { AppShell, ScreenHeader } from "@/components/layout/app-shell";
import { MfaSecurityCenter } from "@/components/auth/mfa-security";

export const Route = createFileRoute("/_authenticated/seguranca")({
  component: SecurityRoute,
});

function SecurityRoute() {
  return (
    <AppShell>
      <ScreenHeader
        eyebrow="Conta protegida"
        title="Segurança"
        tone="brick"
        action={
          <Link
            to="/perfil"
            aria-label="Voltar ao perfil"
            className="grid h-11 w-11 place-items-center rounded-full border-2 border-foreground bg-background text-foreground shadow-[2px_3px_0_var(--foreground)]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
        }
      />
      <div className="space-y-5 px-5 pt-2 pb-8">
        <MfaSecurityCenter />
      </div>
    </AppShell>
  );
}
