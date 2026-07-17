import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AdminPanel } from "@/components/admin/admin-panel";
import { MfaGate } from "@/components/auth/mfa-security";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminRoute,
});

function AdminRoute() {
  const { loading, roles, user } = useAuth();

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando painel…</div>;
  }

  if (!user || !roles.includes("admin")) {
    return (
      <div className="mx-auto grid min-h-screen max-w-lg place-items-center bg-background px-6">
        <div className="text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 font-display text-2xl">Área restrita</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Só administradores do Bafafá entram por aqui. A equipe usa o validador operacional.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Link
              to="/inicio"
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-festa"
            >
              Voltar
            </Link>
            {roles.includes("equipe") && (
              <Link
                to="/staff/checkin"
                className="inline-flex rounded-full border border-input px-5 py-2.5 text-sm font-bold"
              >
                Abrir validador
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <MfaGate label="administração do Bafafá">
      <AdminPanel currentUserId={user.id} />
    </MfaGate>
  );
}
