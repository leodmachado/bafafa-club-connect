import { vi } from "vitest";
import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/hooks/use-auth";

/**
 * Dublê do cliente Supabase.
 *
 * O cliente real (`src/integrations/supabase/client.ts`) é um Proxy preguiçoso
 * que estoura se as variáveis de ambiente não existirem. Nos testes trocamos o
 * módulo inteiro por este dublê, que só implementa o que os guards de rota e as
 * libs realmente usam: `auth.getUser`, `auth.mfa.getAuthenticatorAssuranceLevel`,
 * `from(...).select(...).eq(...)` e `rpc(...)`.
 */

export type SupabaseMockOptions = {
  /** Usuário devolvido por `auth.getUser()`. `null` simula sessão ausente. */
  user?: User | null;
  /** Papéis devolvidos pela consulta a `user_roles`. */
  roles?: AppRole[];
  /** Nível de garantia atual da sessão (AAL1 = só senha, AAL2 = senha + 2FA). */
  assuranceLevel?: "aal1" | "aal2";
  /** Respostas de RPC por nome, quando o teste precisar. */
  rpcResponses?: Record<string, { data?: unknown; error?: unknown }>;
  /**
   * Respostas sucessivas da consulta a `user_roles`, uma por chamada. Serve para
   * provar cache: se a segunda resposta é diferente e o resultado não muda, é
   * porque a consulta não foi refeita. A última resposta da fila se repete
   * indefinidamente. Quando omitido, todas as chamadas devolvem `roles`.
   */
  roleResponses?: RoleQueryResponse[];
  /**
   * Segura a resposta da consulta a `user_roles` até o teste chamar
   * `controls.releaseRoleQueries()`. Necessário para observar o estado
   * "requisição em voo" (coalescência e guarda de geração).
   */
  deferRoleQuery?: boolean;
};

/** Uma resposta da consulta a `user_roles`. `error` preenchido simula falha do banco. */
export type RoleQueryResponse = {
  roles?: AppRole[];
  error?: unknown;
};

type RoleQueryResult = {
  data: { role: AppRole }[];
  error: unknown;
};

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    aud: "authenticated",
    role: "authenticated",
    email: "teste@bafafa.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as User;
}

export function createSupabaseMock(options: SupabaseMockOptions = {}) {
  const {
    user = makeUser(),
    roles = [],
    assuranceLevel = "aal1",
    rpcResponses = {},
    roleResponses,
    deferRoleQuery = false,
  } = options;

  // Fila de respostas da consulta a `user_roles`. Sem `roleResponses`, é uma
  // fila de um item só — o comportamento antigo, em que toda chamada devolve
  // os mesmos papéis.
  const queue: RoleQueryResponse[] = roleResponses?.length ? [...roleResponses] : [{ roles }];

  function nextRoleResult(): RoleQueryResult {
    // A última resposta fica "presa" na fila e se repete.
    const response = queue.length > 1 ? (queue.shift() as RoleQueryResponse) : queue[0];
    return {
      data: (response.roles ?? []).map((role) => ({ role })),
      error: response.error ?? null,
    };
  }

  /** Consultas seguradas por `deferRoleQuery`, aguardando liberação do teste. */
  const heldRoleQueries: Array<() => void> = [];

  // `from("user_roles").select("role").eq("user_id", id)` é "thenable":
  // o código de produção faz `Promise.resolve(query)`, então o objeto
  // devolvido pelo `.eq()` precisa se comportar como uma promise.
  const eq = vi.fn(() => ({
    then: (resolve: (value: RoleQueryResult) => unknown) => {
      const deliver = () => resolve(nextRoleResult());
      if (deferRoleQuery) {
        heldRoleQueries.push(deliver);
        return undefined;
      }
      return Promise.resolve(deliver());
    },
  }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  const getAuthenticatorAssuranceLevel = vi.fn(async () => ({
    data: { currentLevel: assuranceLevel, nextLevel: assuranceLevel },
    error: null,
  }));

  const getUser = vi.fn(async () =>
    user ? { data: { user }, error: null } : { data: { user: null }, error: null },
  );

  const rpc = vi.fn(async (name: string) => {
    const configured = rpcResponses[name];
    return { data: configured?.data ?? null, error: configured?.error ?? null };
  });

  const supabase = {
    from,
    rpc,
    auth: {
      getUser,
      mfa: { getAuthenticatorAssuranceLevel },
    },
  };

  const controls = {
    /**
     * Libera todas as consultas de papéis seguradas por `deferRoleQuery`.
     *
     * É `async` de propósito: `Promise.resolve(thenable)` só chama o `then` do
     * thenable numa microtask, então logo depois de `loadCurrentUserRoles(...)`
     * a consulta ainda não chegou aqui. O `await` inicial deixa essa microtask
     * rodar antes de liberar. Funciona com timers falsos — microtask não é timer.
     */
    async releaseRoleQueries() {
      await Promise.resolve();
      await Promise.resolve();
      for (const deliver of heldRoleQueries.splice(0)) deliver();
    },
  };

  return {
    supabase,
    spies: { from, select, eq, rpc, getUser, getAuthenticatorAssuranceLevel },
    controls,
  };
}
