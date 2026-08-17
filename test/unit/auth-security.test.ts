import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { createSupabaseMock } from "../helpers/supabase-mock";
import {
  PRIVILEGED_ROLES,
  RECOVERY_MARKER_KEY,
  clearPasswordRecovery,
  friendlyAuthError,
  isPrivilegedRole,
  markPasswordRecovery,
  readValidPasswordRecovery,
  validatePassword,
} from "@/lib/auth-security";

/**
 * `src/lib/auth-security.ts` concentra as regras de senha, a tradução de erros
 * do Supabase, o marcador de recuperação de senha e o cache de papéis.
 *
 * A checagem de AAL2 (`inspectPrivilegedSession` e o guard de rota) já é coberta
 * por `test/regression/aal2-privileged-gate.test.ts` — este arquivo não repete
 * esse terreno. O foco aqui é o resto do módulo, em especial o cache de papéis,
 * que é estado de módulo e por isso exige `vi.resetModules()` + import dinâmico.
 */

const mockRef = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    if (!mockRef.current) throw new Error("dublê do Supabase não foi configurado no teste");
    return mockRef.current;
  },
}));

function injetarSupabase(double: ReturnType<typeof createSupabaseMock>["supabase"]) {
  mockRef.current = double;
}

/** Cada teste de cache precisa de uma instância limpa do módulo. */
async function loadAuthSecurity() {
  vi.resetModules();
  return import("@/lib/auth-security");
}

beforeEach(() => {
  injetarSupabase(createSupabaseMock().supabase);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// validatePassword
// ---------------------------------------------------------------------------

describe("validatePassword — regras individuais", () => {
  it("lista todas as regras violadas por uma senha vazia", () => {
    const resultado = validatePassword("");

    expect(resultado.valid).toBe(false);
    expect(resultado.issues).toEqual([
      "Use pelo menos 12 caracteres.",
      "Inclua pelo menos uma letra maiúscula.",
      "Inclua pelo menos uma letra minúscula.",
      "Inclua pelo menos um número.",
      "Inclua pelo menos um símbolo.",
    ]);
    expect(resultado.score).toBe(0);
  });

  it("aceita senha que cumpre todas as regras", () => {
    const resultado = validatePassword("Chopp!Gelado7");

    expect(resultado.valid).toBe(true);
    expect(resultado.issues).toEqual([]);
  });

  it("cobra 12 caracteres — 11 reclama, 12 não", () => {
    expect(validatePassword("Ab1!xxxxxxx").issues).toContain("Use pelo menos 12 caracteres.");
    expect(validatePassword("Ab1!xxxxxxxx").issues).not.toContain("Use pelo menos 12 caracteres.");
  });

  it("cobra maiúscula, minúscula, número e símbolo separadamente", () => {
    expect(validatePassword("chopp!gelado7").issues).toEqual([
      "Inclua pelo menos uma letra maiúscula.",
    ]);
    expect(validatePassword("CHOPP!GELADO7").issues).toEqual([
      "Inclua pelo menos uma letra minúscula.",
    ]);
    expect(validatePassword("Chopp!Gelado").issues).toEqual(["Inclua pelo menos um número."]);
    expect(validatePassword("ChoppGelado77").issues).toEqual(["Inclua pelo menos um símbolo."]);
  });

  it("aceita espaço como símbolo", () => {
    const resultado = validatePassword("Festa Da Casa 12");

    expect(resultado.issues).toEqual([]);
    expect(resultado.valid).toBe(true);
  });

  it("não aceita letra acentuada como símbolo", () => {
    // O conjunto de símbolos é `[^A-Za-zÀ-ÿ0-9]`, e a faixa À-ÿ cobre os
    // acentuados — então "ç" conta como letra, não como símbolo.
    expect(validatePassword("Brigadeiroç123").issues).toEqual(["Inclua pelo menos um símbolo."]);
  });
});

describe("validatePassword — caracteres acentuados", () => {
  it("reconhece maiúscula e minúscula acentuadas", () => {
    const resultado = validatePassword("Ãgua!Gelada12");

    expect(resultado.valid).toBe(true);
    expect(resultado.score).toBe(4);
  });

  it("reconhece 'ç' como letra minúscula válida", () => {
    const resultado = validatePassword("BRIGADEIRO1!ç");

    expect(resultado.issues).toEqual([]);
    expect(resultado.score).toBe(4);
  });

  it("COMPORTAMENTO ATUAL: 'À' vale como maiúscula na regra mas não na pontuação", () => {
    // A regra de issues lista "À" explicitamente; a de score usa a faixa
    // `[A-ZÁ-Ú]`, que começa em "Á" (U+00C1) e deixa "À" (U+00C0) de fora.
    // Resultado: senha válida que perde um ponto de força.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const resultado = validatePassword("Àgua!gelada12");

    expect(resultado.valid).toBe(true);
    expect(resultado.score).toBe(3);
    expect(validatePassword("Água!gelada12").score).toBe(4);
  });

  it("COMPORTAMENTO ATUAL: 'Ü' não é reconhecido como maiúscula", () => {
    // "Ü" (U+00DC) não está na lista explícita da regra nem na faixa de score.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(validatePassword("Übermeister1!").issues).toEqual([
      "Inclua pelo menos uma letra maiúscula.",
    ]);
  });
});

describe("validatePassword — repetição do mesmo caractere", () => {
  it("reclama de senha feita de um único caractere repetido", () => {
    expect(validatePassword("aaaaaaaaaaaa").issues).toContain("Evite repetir o mesmo caractere.");
    expect(validatePassword("!!!!!!!!!!!!").issues).toContain("Evite repetir o mesmo caractere.");
  });

  it("não reclama de senha com um caractere só (o padrão exige 2+)", () => {
    // `/^(.)\1+$/` precisa de pelo menos uma repetição, então "a" não casa.
    expect(validatePassword("a").issues).not.toContain("Evite repetir o mesmo caractere.");
    expect(validatePassword("aa").issues).toContain("Evite repetir o mesmo caractere.");
  });

  it("não reclama de repetição parcial", () => {
    expect(validatePassword("Aaaaaaaaaa1!").issues).not.toContain(
      "Evite repetir o mesmo caractere.",
    );
  });

  it("COMPORTAMENTO ATUAL: a regra de repetição nunca é o único problema", () => {
    // Uma senha inteira de caracteres iguais não tem como ter maiúscula,
    // minúscula, número e símbolo ao mesmo tempo. A regra é, na prática,
    // redundante. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const resultado = validatePassword("aaaaaaaaaaaa");

    expect(resultado.issues).toContain("Evite repetir o mesmo caractere.");
    expect(resultado.issues.length).toBeGreaterThan(1);
  });
});

describe("validatePassword — palavras fáceis de adivinhar", () => {
  it.each(["MinhaSenha12!", "Password2026!", "Qwerty!Forte99", "Bafafa#Club2026", "Abc123456!Xyz"])(
    "recusa '%s' pela lista de palavras fracas",
    (senha) => {
      expect(validatePassword(senha).issues).toContain(
        "Evite palavras e sequências fáceis de adivinhar.",
      );
    },
  );

  it.each(["SENHA", "senha", "SeNhA"])(
    "aplica a lista sem diferenciar maiúsculas: %s",
    (trecho) => {
      expect(validatePassword(`Xx${trecho}Xx1!aa`).issues).toContain(
        "Evite palavras e sequências fáceis de adivinhar.",
      );
    },
  );

  it("COMPORTAMENTO ATUAL: 'Bafafã' com til escapa da lista de palavras fracas", () => {
    // A lista tem "bafafa" sem til, então o nome da casa escrito corretamente
    // passa. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const resultado = validatePassword("Bafafã#Club2026");

    expect(resultado.valid).toBe(true);
    expect(resultado.issues).toEqual([]);
  });

  it("não reclama de senha forte sem palavra da lista", () => {
    expect(validatePassword("Chopp!Gelado7").issues).toEqual([]);
  });
});

describe("validatePassword — pontuação de força", () => {
  it.each([
    ["", 0],
    ["abc", 0],
    ["abcdefghijkl", 1],
    ["abcdefghijklmn", 2],
    ["Abcdefghijklmn", 3],
    ["Abcdefghijkl1", 3],
    ["Ab1!xxxxxxxx", 4],
    ["Ab1!xxxxxxxxxx", 5],
  ])("pontua a senha '%s' com %d", (senha, esperado) => {
    expect(validatePassword(senha).score).toBe(esperado);
  });

  it("sobe um ponto ao cruzar 12 caracteres e outro ao cruzar 14", () => {
    expect(validatePassword("Ab1!xxxxxxx").score).toBe(3); // 11 caracteres
    expect(validatePassword("Ab1!xxxxxxxx").score).toBe(4); // 12
    expect(validatePassword("Ab1!xxxxxxxxx").score).toBe(4); // 13
    expect(validatePassword("Ab1!xxxxxxxxxx").score).toBe(5); // 14
  });

  it("nunca passa de 5, nem em senha muito longa e variada", () => {
    expect(validatePassword("Ab1!".repeat(30)).score).toBe(5);
  });

  it("pontua senha inválida quando ela cumpre parte das regras", () => {
    // Uma senha pode marcar 4 pontos e ainda ser recusada por palavra fraca —
    // `score` mede força bruta, `valid` mede política.
    const resultado = validatePassword("MinhaSenha12!");

    expect(resultado.score).toBe(4);
    expect(resultado.valid).toBe(false);
  });

  it("valid é exatamente 'nenhuma regra violada'", () => {
    for (const senha of ["", "abc", "Chopp!Gelado7", "MinhaSenha12!", "aaaaaaaaaaaa"]) {
      const resultado = validatePassword(senha);
      expect(resultado.valid).toBe(resultado.issues.length === 0);
    }
  });
});

// ---------------------------------------------------------------------------
// friendlyAuthError
// ---------------------------------------------------------------------------

describe("friendlyAuthError", () => {
  it.each([
    ["Invalid login credentials", "E-mail ou senha não conferem."],
    ["Email not confirmed", "Confirme seu e-mail antes de entrar."],
    [
      "captcha protection: request disallowed",
      "Confirme o desafio de segurança e tente novamente.",
    ],
    ["Email rate limit exceeded", "Muitas tentativas. Espere um pouco e tente novamente."],
    ["Too many requests", "Muitas tentativas. Espere um pouco e tente novamente."],
    ["weak_password", "A senha não atende aos requisitos de segurança."],
  ])("traduz '%s'", (mensagem, esperado) => {
    expect(friendlyAuthError(mensagem)).toBe(esperado);
  });

  it("ignora maiúsculas e minúsculas do Supabase", () => {
    expect(friendlyAuthError("INVALID LOGIN CREDENTIALS")).toBe("E-mail ou senha não conferem.");
    expect(friendlyAuthError("Invalid Login Credentials")).toBe("E-mail ou senha não conferem.");
  });

  it("casa por trecho, não por mensagem inteira", () => {
    expect(friendlyAuthError("AuthApiError: Invalid login credentials (400)")).toBe(
      "E-mail ou senha não conferem.",
    );
  });

  it.each([
    ["", "Não foi possível concluir agora. Tente novamente em instantes."],
    [
      "Signups not allowed for this instance",
      "Não foi possível concluir agora. Tente novamente em instantes.",
    ],
    ["Network request failed", "Não foi possível concluir agora. Tente novamente em instantes."],
    ["User already registered", "Não foi possível concluir agora. Tente novamente em instantes."],
  ])("cai na mensagem genérica para '%s'", (mensagem, esperado) => {
    expect(friendlyAuthError(mensagem)).toBe(esperado);
  });

  it("dá precedência às credenciais sobre os outros ramos", () => {
    // A mensagem contém "password" e "invalid login credentials"; o primeiro
    // ramo do if vence.
    expect(friendlyAuthError("Invalid login credentials: password mismatch")).toBe(
      "E-mail ou senha não conferem.",
    );
  });

  it("dá precedência ao limite de tentativas sobre o ramo de senha", () => {
    expect(friendlyAuthError("Password rate limit exceeded")).toBe(
      "Muitas tentativas. Espere um pouco e tente novamente.",
    );
  });

  it("dá precedência ao captcha sobre o limite de tentativas", () => {
    expect(friendlyAuthError("captcha failed after too many attempts")).toBe(
      "Confirme o desafio de segurança e tente novamente.",
    );
  });

  it("COMPORTAMENTO ATUAL: qualquer mensagem com 'password' vira erro de requisitos", () => {
    // O ramo `normalized.includes("password")` é largo demais: mensagens que
    // não têm nada a ver com força de senha recebem o texto de requisitos.
    // Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    expect(friendlyAuthError("New password should be different from the old password")).toBe(
      "A senha não atende aos requisitos de segurança.",
    );
    expect(friendlyAuthError("Password recovery requires an email")).toBe(
      "A senha não atende aos requisitos de segurança.",
    );
    expect(friendlyAuthError("Auth session missing for password update")).toBe(
      "A senha não atende aos requisitos de segurança.",
    );
  });

  it("nunca devolve string vazia", () => {
    for (const mensagem of ["", "   ", "erro desconhecido", "500"]) {
      expect(friendlyAuthError(mensagem).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// isPrivilegedRole
// ---------------------------------------------------------------------------

describe("isPrivilegedRole", () => {
  it.each(PRIVILEGED_ROLES)("considera '%s' privilegiado", (papel) => {
    expect(isPrivilegedRole([papel])).toBe(true);
  });

  it.each(["gratuito", "premium", "visitante"] as const)(
    "não considera '%s' privilegiado",
    (papel) => {
      expect(isPrivilegedRole([papel])).toBe(false);
    },
  );

  it("devolve false para lista vazia", () => {
    expect(isPrivilegedRole([])).toBe(false);
  });

  it("basta um papel privilegiado no meio dos comuns", () => {
    expect(isPrivilegedRole(["gratuito", "premium", "moderador"])).toBe(true);
  });

  it("expõe exatamente admin, moderador e equipe como privilegiados", () => {
    // Se um papel novo entrar nessa lista, o guard de AAL2 passa a valer para
    // ele — é uma decisão de segurança e não deve acontecer sem querer.
    expect(PRIVILEGED_ROLES).toEqual(["admin", "moderador", "equipe"]);
  });
});

// ---------------------------------------------------------------------------
// Marcador de recuperação de senha
// ---------------------------------------------------------------------------

describe("marcador de recuperação de senha", () => {
  const AGORA = new Date("2026-08-15T22:00:00.000Z");
  const VINTE_MINUTOS = 20 * 60 * 1000;

  function marcadorGravado() {
    const bruto = sessionStorage.getItem(RECOVERY_MARKER_KEY);
    return bruto ? JSON.parse(bruto) : null;
  }

  it("grava o usuário e o instante da solicitação", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);

    markPasswordRecovery("user-1");

    expect(marcadorGravado()).toEqual({ userId: "user-1", createdAt: AGORA.getTime() });
  });

  it("aceita o marcador do mesmo usuário dentro da janela", () => {
    markPasswordRecovery("user-1");

    expect(readValidPasswordRecovery("user-1")).toMatchObject({ userId: "user-1" });
  });

  it("aceita o marcador sem informar usuário", () => {
    markPasswordRecovery("user-1");

    expect(readValidPasswordRecovery()).toMatchObject({ userId: "user-1" });
    expect(readValidPasswordRecovery(null)).toMatchObject({ userId: "user-1" });
  });

  it("devolve null quando não há marcador, sem mexer no storage", () => {
    expect(readValidPasswordRecovery("user-1")).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("aceita o marcador exatamente no limite de 20 minutos", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    markPasswordRecovery("user-1");

    vi.setSystemTime(new Date(AGORA.getTime() + VINTE_MINUTOS));

    expect(readValidPasswordRecovery("user-1")).toMatchObject({ userId: "user-1" });
  });

  it("recusa e apaga o marcador um milissegundo depois da janela", () => {
    vi.useFakeTimers();
    vi.setSystemTime(AGORA);
    markPasswordRecovery("user-1");

    vi.setSystemTime(new Date(AGORA.getTime() + VINTE_MINUTOS + 1));

    expect(readValidPasswordRecovery("user-1")).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("recusa e apaga o marcador de outro usuário", () => {
    markPasswordRecovery("user-1");

    expect(readValidPasswordRecovery("user-2")).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("COMPORTAMENTO ATUAL: consultar com o usuário errado apaga um marcador legítimo", () => {
    // A leitura tem efeito colateral destrutivo. Se uma tela consultar com o id
    // errado (por exemplo antes de a sessão carregar), o fluxo de recuperação do
    // usuário certo é perdido. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    markPasswordRecovery("user-1");

    readValidPasswordRecovery("outro-usuario");

    expect(readValidPasswordRecovery("user-1")).toBeNull();
  });

  it.each([
    ["JSON quebrado", "{ isso não é json"],
    ["string solta", '"user-1"'],
    ["null literal", "null"],
    ["array", "[]"],
  ])("recusa e apaga marcador com conteúdo inválido: %s", (_rotulo, bruto) => {
    sessionStorage.setItem(RECOVERY_MARKER_KEY, bruto);

    expect(readValidPasswordRecovery("user-1")).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it.each([
    ["userId numérico", { userId: 1, createdAt: Date.now() }],
    ["createdAt string", { userId: "user-1", createdAt: "2026-08-15" }],
    ["sem createdAt", { userId: "user-1" }],
    ["objeto vazio", {}],
  ])("recusa e apaga marcador com formato errado: %s", (_rotulo, marcador) => {
    sessionStorage.setItem(RECOVERY_MARKER_KEY, JSON.stringify(marcador));

    expect(readValidPasswordRecovery("user-1")).toBeNull();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("clearPasswordRecovery apaga o marcador e é idempotente", () => {
    markPasswordRecovery("user-1");

    clearPasswordRecovery();
    clearPasswordRecovery();

    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("substitui o marcador anterior ao marcar de novo", () => {
    markPasswordRecovery("user-1");
    markPasswordRecovery("user-2");

    expect(readValidPasswordRecovery("user-2")).toMatchObject({ userId: "user-2" });
  });
});

describe("marcador de recuperação — sem window (SSR)", () => {
  it("markPasswordRecovery não grava nada", () => {
    vi.stubGlobal("window", undefined);

    markPasswordRecovery("user-1");

    vi.unstubAllGlobals();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).toBeNull();
  });

  it("readValidPasswordRecovery devolve null sem tocar no storage", () => {
    markPasswordRecovery("user-1");
    vi.stubGlobal("window", undefined);

    const resultado = readValidPasswordRecovery("user-1");

    vi.unstubAllGlobals();
    expect(resultado).toBeNull();
    // O marcador continua lá — a leitura no servidor não pode destruí-lo.
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).not.toBeNull();
  });

  it("clearPasswordRecovery não apaga nada", () => {
    markPasswordRecovery("user-1");
    vi.stubGlobal("window", undefined);

    clearPasswordRecovery();

    vi.unstubAllGlobals();
    expect(sessionStorage.getItem(RECOVERY_MARKER_KEY)).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Cache de papéis
// ---------------------------------------------------------------------------

describe("loadCurrentUserRoles — cache de 15 segundos", () => {
  it("consulta o banco na primeira chamada", async () => {
    const mock = createSupabaseMock({ roles: ["admin"] });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledWith("user_roles");
    expect(mock.spies.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("reaproveita o cache na segunda chamada", async () => {
    // A segunda resposta do dublê é diferente — se a consulta fosse refeita, o
    // resultado mudaria.
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(1);
  });

  it("ainda usa o cache a 14,999 s e refaz a consulta a 15 s", async () => {
    vi.useFakeTimers();
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    await loadCurrentUserRoles("user-1");

    vi.advanceTimersByTime(14_999);
    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(await loadCurrentUserRoles("user-1")).toEqual(["gratuito"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(2);
  });

  it("mantém caches separados por usuário", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(await loadCurrentUserRoles("user-2")).toEqual(["gratuito"]);
    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(2);
  });

  it("guarda lista vazia em cache como qualquer outra resposta", async () => {
    const mock = createSupabaseMock({ roleResponses: [{ roles: [] }, { roles: ["admin"] }] });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    expect(await loadCurrentUserRoles("user-1")).toEqual([]);
    expect(await loadCurrentUserRoles("user-1")).toEqual([]);
    expect(mock.spies.from).toHaveBeenCalledTimes(1);
  });
});

describe("loadCurrentUserRoles — coalescência de requisições", () => {
  it("junta chamadas simultâneas do mesmo usuário numa consulta só", async () => {
    const mock = createSupabaseMock({ roles: ["admin"], deferRoleQuery: true });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    const primeira = loadCurrentUserRoles("user-1");
    const segunda = loadCurrentUserRoles("user-1");

    expect(mock.spies.from).toHaveBeenCalledTimes(1);

    await mock.controls.releaseRoleQueries();

    expect(await primeira).toEqual(["admin"]);
    expect(await segunda).toEqual(["admin"]);
  });

  it("não junta chamadas de usuários diferentes", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["equipe"] }],
      deferRoleQuery: true,
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    const primeira = loadCurrentUserRoles("user-1");
    const segunda = loadCurrentUserRoles("user-2");
    expect(mock.spies.from).toHaveBeenCalledTimes(2);

    await mock.controls.releaseRoleQueries();

    expect(await primeira).toEqual(["admin"]);
    expect(await segunda).toEqual(["equipe"]);
  });

  it("libera a coalescência depois que a consulta termina", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles, clearAuthSecurityCache } = await loadAuthSecurity();

    await loadCurrentUserRoles("user-1");
    clearAuthSecurityCache();

    // Sem cache e sem requisição em voo, a próxima chamada consulta de novo.
    expect(await loadCurrentUserRoles("user-1")).toEqual(["gratuito"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(2);
  });

  it("propaga o erro do banco e não guarda nada em cache", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ error: new Error("permission denied") }, { roles: ["admin"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    await expect(loadCurrentUserRoles("user-1")).rejects.toThrow("permission denied");

    // A falha não pode virar "usuário sem papéis" em cache.
    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(2);
  });
});

describe("clearAuthSecurityCache — guarda de geração", () => {
  it("esvazia o cache já preenchido", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles, clearAuthSecurityCache } = await loadAuthSecurity();

    await loadCurrentUserRoles("user-1");
    clearAuthSecurityCache();

    expect(await loadCurrentUserRoles("user-1")).toEqual(["gratuito"]);
  });

  it("sem limpeza, a resposta em voo preenche o cache normalmente", async () => {
    // Contraprova do teste seguinte: é este o caminho feliz.
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
      deferRoleQuery: true,
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles } = await loadAuthSecurity();

    const emVoo = loadCurrentUserRoles("user-1");
    await mock.controls.releaseRoleQueries();
    await emVoo;

    expect(await loadCurrentUserRoles("user-1")).toEqual(["admin"]);
    expect(mock.spies.from).toHaveBeenCalledTimes(1);
  });

  it("resposta em voo iniciada antes da limpeza não repovoa o cache", async () => {
    // Este é o ponto sutil do módulo: `roleCacheGeneration` é lido quando a
    // consulta começa e conferido quando ela volta. Sem essa guarda, um logout
    // (ou troca de papel) durante a consulta teria o cache antigo restaurado
    // pela resposta atrasada — e o usuário seguiria com os papéis anteriores.
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
      deferRoleQuery: true,
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles, clearAuthSecurityCache } = await loadAuthSecurity();

    const emVoo = loadCurrentUserRoles("user-1");
    clearAuthSecurityCache();
    await mock.controls.releaseRoleQueries();

    // Quem pediu ainda recebe a resposta — a guarda só impede o cache.
    expect(await emVoo).toEqual(["admin"]);

    const depois = loadCurrentUserRoles("user-1");
    expect(mock.spies.from).toHaveBeenCalledTimes(2);
    await mock.controls.releaseRoleQueries();
    expect(await depois).toEqual(["gratuito"]);
  });

  it("a guarda continua valendo depois de várias limpezas", async () => {
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["equipe"] }, { roles: ["gratuito"] }],
      deferRoleQuery: true,
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles, clearAuthSecurityCache } = await loadAuthSecurity();

    const emVoo = loadCurrentUserRoles("user-1");
    clearAuthSecurityCache();
    clearAuthSecurityCache();
    await mock.controls.releaseRoleQueries();
    await emVoo;

    const depois = loadCurrentUserRoles("user-1");
    await mock.controls.releaseRoleQueries();
    expect(await depois).toEqual(["equipe"]);
  });

  it("COMPORTAMENTO ATUAL: a limpeza não cancela a requisição em voo", async () => {
    // `clearAuthSecurityCache()` zera o cache e a geração, mas não mexe em
    // `roleRequests` — ele só é esvaziado no `.finally()`. Então quem chamar
    // logo depois da limpeza, com a consulta anterior ainda em voo, recebe a
    // resposta ANTERIOR à limpeza. Ver docs/ACHADOS_DOS_TESTES_2026-08.md.
    const mock = createSupabaseMock({
      roleResponses: [{ roles: ["admin"] }, { roles: ["gratuito"] }],
      deferRoleQuery: true,
    });
    injetarSupabase(mock.supabase);
    const { loadCurrentUserRoles, clearAuthSecurityCache } = await loadAuthSecurity();

    const emVoo = loadCurrentUserRoles("user-1");
    clearAuthSecurityCache();
    const depoisDaLimpeza = loadCurrentUserRoles("user-1");

    // Nenhuma consulta nova: a segunda chamada pegou carona na que já estava em voo.
    expect(mock.spies.from).toHaveBeenCalledTimes(1);

    await mock.controls.releaseRoleQueries();
    await emVoo;

    expect(await depoisDaLimpeza).toEqual(["admin"]);
  });
});
