import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { inspectPrivilegedSession } from "@/lib/auth-security";
import { AuthProvider } from "@/hooks/use-auth";

/**
 * Gate autenticado e gate global de 2FA para contas privilegiadas.
 *
 * A sessão do Supabase vive no localStorage, por isso o guard roda apenas no
 * navegador. Admin, moderação e equipe em AAL1 ficam presos em /seguranca;
 * nenhuma outra rota autenticada é carregada até a confirmação do AAL2.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });

    const security = await inspectPrivilegedSession(data.user);
    const isSecurityRoute = location.pathname === "/seguranca";

    if (security.requiresMfa && !isSecurityRoute) {
      throw redirect({ to: "/seguranca", replace: true });
    }

    return {
      user: data.user,
      roles: security.roles,
      assuranceLevel: security.assuranceLevel,
      privileged: security.privileged,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, roles } = Route.useRouteContext();
  return (
    <AuthProvider user={user} roles={roles}>
      <Outlet />
    </AuthProvider>
  );
}
