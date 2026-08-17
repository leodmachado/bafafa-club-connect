import type { Page, Route } from "@playwright/test";

/**
 * Harness de interceptação do Supabase.
 *
 * Este arquivo é o "aparato" que os roteiros manuais em `docs/TESTE_*.md`
 * exigiam de um operador humano. Ele existe uma única vez: cada spec descreve
 * apenas o estado inicial do mundo e as asserções, sem reimplementar
 * autenticação, OTP, papéis ou RLS.
 *
 * Cobre os endpoints que o `@supabase/supabase-js` realmente usa:
 *   POST /auth/v1/otp             — envio de código por telefone
 *   POST /auth/v1/verify          — conferência do código
 *   POST /auth/v1/signup          — cadastro por e-mail
 *   POST /auth/v1/token           — login por senha e refresh
 *   GET  /auth/v1/user            — validação da sessão
 *   POST /auth/v1/logout
 *   GET/POST/PATCH /rest/v1/<tabela>
 *   POST /rest/v1/rpc/<função>
 *
 * O nível AAL (1 = só senha, 2 = com segundo fator) NÃO é uma chamada de rede:
 * o supabase-js lê a claim `aal` de dentro do próprio access token. Por isso o
 * harness monta um JWT de verdade (assinatura falsa, payload real) — ver
 * `makeAccessToken`.
 */

export type StubRole = "visitante" | "gratuito" | "premium" | "equipe" | "moderador" | "admin";

export type StubUser = {
  id: string;
  email?: string;
  phone?: string;
  roles: StubRole[];
  /** aal1 = apenas senha/OTP. aal2 = segundo fator confirmado. */
  aal: "aal1" | "aal2";
  user_metadata?: Record<string, unknown>;
};

export type StubState = {
  /** Usuário com sessão ativa. `null` = visitante deslogado. */
  session: StubUser | null;
  /** Código OTP aceito por `/auth/v1/verify`. Qualquer outro é recusado. */
  otpCode: string;
  /** Linhas devolvidas por tabela, para `GET /rest/v1/<tabela>`. */
  tables: Record<string, unknown[]>;
  /** Respostas de RPC por nome. Uma função recebe o corpo enviado. */
  rpc: Record<string, unknown | ((body: unknown) => unknown)>;
  /** Erros forçados: chave `rpc:<nome>` ou `table:<nome>`. */
  failures: Record<string, { status: number; message: string; code?: string }>;
};

export const DEFAULT_STATE: StubState = {
  session: null,
  otpCode: "123456",
  tables: {},
  rpc: {},
  failures: {},
};

function base64url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Monta um access token cujo payload o supabase-js consegue decodificar.
 * A assinatura é irrelevante aqui: nada valida o token, porque o backend
 * inteiro está sendo interceptado. O que importa são as claims `sub` e `aal`.
 */
export function makeAccessToken(user: StubUser, expiresInSeconds = 3600): string {
  const issuedAt = Math.floor(Date.UTC(2026, 7, 17, 12, 0, 0) / 1000);
  const header = base64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      sub: user.id,
      aud: "authenticated",
      role: "authenticated",
      email: user.email ?? "",
      phone: user.phone ?? "",
      aal: user.aal,
      session_id: `session-${user.id}`,
      iat: issuedAt,
      exp: issuedAt + expiresInSeconds,
      // O supabase-js usa `amr` para calcular o `nextLevel` do AAL.
      amr:
        user.aal === "aal2"
          ? [
              { method: "password", timestamp: issuedAt },
              { method: "totp", timestamp: issuedAt },
            ]
          : [{ method: "password", timestamp: issuedAt }],
    }),
  );
  return `${header}.${payload}.e2e-signature-nao-verificada`;
}

function toAuthUser(user: StubUser) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email ?? "",
    phone: user.phone ?? "",
    email_confirmed_at: user.email ? "2026-08-01T00:00:00.000Z" : null,
    phone_confirmed_at: user.phone ? "2026-08-01T00:00:00.000Z" : null,
    confirmed_at: "2026-08-01T00:00:00.000Z",
    last_sign_in_at: "2026-08-17T12:00:00.000Z",
    app_metadata: { provider: user.email ? "email" : "phone", providers: [] },
    user_metadata: user.user_metadata ?? {},
    identities: [],
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-17T12:00:00.000Z",
    is_anonymous: false,
    factors:
      user.aal === "aal2"
        ? [
            {
              id: "factor-totp-1",
              friendly_name: "Autenticador",
              factor_type: "totp",
              status: "verified",
              created_at: "2026-08-01T00:00:00.000Z",
              updated_at: "2026-08-01T00:00:00.000Z",
            },
          ]
        : [],
  };
}

export function makeSessionPayload(user: StubUser) {
  return {
    access_token: makeAccessToken(user),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.UTC(2026, 7, 17, 13, 0, 0) / 1000),
    refresh_token: `refresh-${user.id}`,
    user: toAuthUser(user),
  };
}

/** Chave usada pelo supabase-js no localStorage, derivada do "project ref". */
export function storageKeyForUrl(supabaseUrl: string): string {
  const host = new URL(supabaseUrl).hostname;
  return `sb-${host.split(".")[0]}-auth-token`;
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify(body),
  });
}

/**
 * Interpreta os filtros PostgREST que o app realmente usa
 * (`coluna=eq.valor`, `coluna=in.(a,b)`), o suficiente para servir as tabelas
 * declaradas em `state.tables`.
 */
function applyFilters(rows: unknown[], params: URLSearchParams): unknown[] {
  let result = [...rows];
  for (const [key, raw] of params.entries()) {
    if (["select", "order", "limit", "offset"].includes(key)) continue;
    const record = (row: unknown) => row as Record<string, unknown>;

    if (raw.startsWith("eq.")) {
      const expected = raw.slice(3);
      result = result.filter((row) => String(record(row)[key]) === expected);
    } else if (raw.startsWith("in.")) {
      const allowed = raw
        .slice(3)
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((value) => value.replace(/^"|"$/g, ""));
      result = result.filter((row) => allowed.includes(String(record(row)[key])));
    } else if (raw.startsWith("is.")) {
      const expected = raw.slice(3);
      result = result.filter((row) => {
        const value = record(row)[key];
        return expected === "null"
          ? value === null || value === undefined
          : String(value) === expected;
      });
    }
  }
  return result;
}

export class SupabaseStub {
  readonly state: StubState;
  /** Log de tudo que o app pediu — permite asserções de "não chamou X". */
  readonly calls: { method: string; path: string; body?: unknown }[] = [];

  constructor(overrides: Partial<StubState> = {}) {
    this.state = {
      ...DEFAULT_STATE,
      ...overrides,
      tables: { ...DEFAULT_STATE.tables, ...(overrides.tables ?? {}) },
      rpc: { ...DEFAULT_STATE.rpc, ...(overrides.rpc ?? {}) },
      failures: { ...DEFAULT_STATE.failures, ...(overrides.failures ?? {}) },
    };
  }

  /** Papéis do usuário logado, no formato da tabela `user_roles`. */
  private roleRows() {
    const user = this.state.session;
    if (!user) return [];
    return user.roles.map((role) => ({ user_id: user.id, role }));
  }

  async install(page: Page): Promise<void> {
    await page.route("**/e2estub.supabase.co/**", async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      let body: unknown;
      try {
        body = request.postDataJSON();
      } catch {
        body = undefined;
      }
      this.calls.push({ method, path: url.pathname, body });

      if (method === "OPTIONS") {
        await route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-headers": "*",
            "access-control-allow-methods": "*",
          },
        });
        return;
      }

      if (url.pathname.startsWith("/auth/v1/")) {
        await this.handleAuth(route, url, method, body);
        return;
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        await this.handleRest(route, url, method, body);
        return;
      }

      await fulfillJson(route, { message: `rota não stubada: ${url.pathname}` }, 404);
    });
  }

  private async handleAuth(route: Route, url: URL, method: string, body: unknown) {
    const endpoint = url.pathname.replace("/auth/v1/", "");
    const payload = (body ?? {}) as Record<string, unknown>;

    // Envio de código por telefone/e-mail.
    if (endpoint === "otp" && method === "POST") {
      await fulfillJson(route, { message_id: "stub-otp" });
      return;
    }

    // Conferência do código. Só o código configurado é aceito.
    if (endpoint === "verify" && method === "POST") {
      if (String(payload.token ?? "") !== this.state.otpCode) {
        await fulfillJson(
          route,
          { error: "invalid_otp", error_description: "Token has expired or is invalid" },
          403,
        );
        return;
      }
      const user =
        this.state.session ??
        ({
          id: "user-otp",
          phone: String(payload.phone ?? ""),
          roles: ["gratuito"],
          aal: "aal1",
        } satisfies StubUser);
      this.state.session = user;
      await fulfillJson(route, makeSessionPayload(user));
      return;
    }

    if (endpoint === "signup" && method === "POST") {
      const user: StubUser = {
        id: "user-novo",
        email: String(payload.email ?? ""),
        roles: ["gratuito"],
        aal: "aal1",
        user_metadata: (payload.data as Record<string, unknown>) ?? {},
      };
      this.state.session = user;
      await fulfillJson(route, makeSessionPayload(user));
      return;
    }

    if (endpoint === "token" && method === "POST") {
      if (!this.state.session) {
        await fulfillJson(
          route,
          { error: "invalid_grant", error_description: "Invalid login credentials" },
          400,
        );
        return;
      }
      await fulfillJson(route, makeSessionPayload(this.state.session));
      return;
    }

    if (endpoint === "user") {
      if (!this.state.session) {
        await fulfillJson(route, { message: "invalid claim: missing sub claim" }, 401);
        return;
      }
      await fulfillJson(route, toAuthUser(this.state.session));
      return;
    }

    if (endpoint === "logout") {
      this.state.session = null;
      await route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
      return;
    }

    if (endpoint === "factors" || endpoint.startsWith("factors/")) {
      await fulfillJson(route, { id: "factor-totp-1", type: "totp", totp: { qr_code: "" } });
      return;
    }

    await fulfillJson(route, {}, 200);
  }

  private async handleRest(route: Route, url: URL, method: string, body: unknown) {
    const path = url.pathname.replace("/rest/v1/", "");

    if (path.startsWith("rpc/")) {
      const name = path.slice(4);
      const failure = this.state.failures[`rpc:${name}`];
      if (failure) {
        await fulfillJson(route, { message: failure.message, code: failure.code }, failure.status);
        return;
      }
      const handler = this.state.rpc[name];
      const value = typeof handler === "function" ? handler(body) : (handler ?? null);
      await fulfillJson(route, value);
      return;
    }

    const table = path.split("?")[0];
    const failure = this.state.failures[`table:${table}`];
    if (failure) {
      await fulfillJson(route, { message: failure.message, code: failure.code }, failure.status);
      return;
    }

    if (method === "GET") {
      const rows = table === "user_roles" ? this.roleRows() : (this.state.tables[table] ?? []);
      await fulfillJson(route, applyFilters(rows, url.searchParams));
      return;
    }

    // Escritas devolvem o próprio corpo, como o PostgREST faz com `returning`.
    await fulfillJson(route, Array.isArray(body) ? body : [body ?? {}], 201);
  }

  /** Quantas vezes uma RPC foi chamada — usado para provar ausência de chamada. */
  rpcCallCount(name: string): number {
    return this.calls.filter((call) => call.path === `/rest/v1/rpc/${name}`).length;
  }
}
