import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportClientError } from "../lib/client-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { markPasswordRecovery } from "@/lib/auth-security";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="wordmark text-7xl text-primary">404</h1>
        <h2 className="mt-4 text-2xl font-display">Essa Fofoquinha sumiu</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A gente procurou, procurou e nada. Volta pra rodinha e tenta de novo.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-festa transition hover:opacity-90"
          >
            Voltar ao clube
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportClientError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-display">Deu ruim aqui, Bafafã.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A gente já anotou o rolê. Tenta de novo ou volta pra tela inicial.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-festa hover:opacity-90"
          >
            Tentar de novo
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-5 py-2.5 text-sm font-semibold hover:bg-accent hover:text-accent-foreground"
          >
            Início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "BAFAFÁ — Clube dos Bafafãs" },
      {
        name: "description",
        content:
          "Clube oficial do Bafafá Bar em Natal/RN. Check-in em eventos, mimos, selos e títulos.",
      },
      { name: "theme-color", content: "#fff8e9" },
      { name: "robots", content: "noindex,nofollow,noarchive,nosnippet" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Bafafá" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { property: "og:title", content: "BAFAFÁ — Clube dos Bafafãs" },
      {
        property: "og:description",
        content:
          "Clube oficial do Bafafá Bar em Natal/RN. Check-in em eventos, mimos, selos e títulos.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "BAFAFÁ — Clube dos Bafafãs" },
      {
        name: "twitter:description",
        content:
          "Clube oficial do Bafafá Bar em Natal/RN. Check-in em eventos, mimos, selos e títulos.",
      },
      {
        property: "og:image",
        content: "/brand/logo-bafafa.png",
      },
      {
        name: "twitter:image",
        content: "/brand/logo-bafafa.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "apple-touch-icon", href: "/icon.svg" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bebas+Neue&family=Nunito+Sans:wght@400;600;700;800;900&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        markPasswordRecovery(session.user.id);
      }
      if (
        event === "SIGNED_IN" ||
        event === "SIGNED_OUT" ||
        event === "USER_UPDATED" ||
        event === "MFA_CHALLENGE_VERIFIED"
      ) {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster
        position="top-center"
        richColors
        toastOptions={{ style: { fontFamily: "var(--font-sans)" } }}
      />
    </QueryClientProvider>
  );
}
