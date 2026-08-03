import type { User } from "@supabase/supabase-js";
import type { AppRole } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const PRIVILEGED_ROLES: AppRole[] = ["admin", "moderador", "equipe"];
export const RECOVERY_MARKER_KEY = "bafafa-password-recovery";
const RECOVERY_WINDOW_MS = 20 * 60 * 1000;

export type RecoveryMarker = {
  userId: string;
  createdAt: number;
};

export type AuthAssuranceLevel = "aal1" | "aal2" | null;

export function isPrivilegedRole(roles: AppRole[]): boolean {
  return roles.some((role) => PRIVILEGED_ROLES.includes(role));
}

export async function loadCurrentUserRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (error) throw error;
  return (data ?? []).map((row) => row.role as AppRole);
}

export async function loadCurrentAssuranceLevel(): Promise<AuthAssuranceLevel> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw error;
  return (data?.currentLevel as AuthAssuranceLevel | undefined) ?? "aal1";
}

export type PrivilegedSessionStatus = {
  user: User;
  roles: AppRole[];
  privileged: boolean;
  assuranceLevel: AuthAssuranceLevel;
  requiresMfa: boolean;
};

/**
 * Fonte única para guards de rota. Contas privilegiadas só podem sair da tela
 * de segurança quando a sessão atual estiver em AAL2.
 */
export async function inspectPrivilegedSession(user: User): Promise<PrivilegedSessionStatus> {
  const [roles, assuranceLevel] = await Promise.all([
    loadCurrentUserRoles(user.id),
    loadCurrentAssuranceLevel(),
  ]);
  const privileged = isPrivilegedRole(roles);

  return {
    user,
    roles,
    privileged,
    assuranceLevel,
    requiresMfa: privileged && assuranceLevel !== "aal2",
  };
}

export function markPasswordRecovery(userId: string): void {
  if (typeof window === "undefined") return;
  const marker: RecoveryMarker = { userId, createdAt: Date.now() };
  sessionStorage.setItem(RECOVERY_MARKER_KEY, JSON.stringify(marker));
}

export function clearPasswordRecovery(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(RECOVERY_MARKER_KEY);
}

export function readValidPasswordRecovery(userId?: string | null): RecoveryMarker | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(RECOVERY_MARKER_KEY);
  if (!raw) return null;
  try {
    const marker = JSON.parse(raw) as RecoveryMarker;
    const validShape = typeof marker.userId === "string" && typeof marker.createdAt === "number";
    const fresh = Date.now() - marker.createdAt <= RECOVERY_WINDOW_MS;
    const sameUser = !userId || marker.userId === userId;
    if (!validShape || !fresh || !sameUser) {
      clearPasswordRecovery();
      return null;
    }
    return marker;
  } catch {
    clearPasswordRecovery();
    return null;
  }
}

export type PasswordCheck = {
  valid: boolean;
  issues: string[];
  score: number;
};

export function validatePassword(password: string): PasswordCheck {
  const issues: string[] = [];
  if (password.length < 12) issues.push("Use pelo menos 12 caracteres.");
  if (!/[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]/.test(password)) {
    issues.push("Inclua pelo menos uma letra maiúscula.");
  }
  if (!/[a-záàâãéèêíïóôõöúçñ]/.test(password)) {
    issues.push("Inclua pelo menos uma letra minúscula.");
  }
  if (!/\d/.test(password)) issues.push("Inclua pelo menos um número.");
  if (!/[^A-Za-zÀ-ÿ0-9]/.test(password)) issues.push("Inclua pelo menos um símbolo.");
  if (/^(.)\1+$/.test(password)) issues.push("Evite repetir o mesmo caractere.");
  if (/password|senha|123456|qwerty|bafafa/i.test(password)) {
    issues.push("Evite palavras e sequências fáceis de adivinhar.");
  }

  let score = 0;
  if (password.length >= 12) score += 1;
  if (password.length >= 14) score += 1;
  if (/[A-ZÁ-Ú]/.test(password) && /[a-zá-ú]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-zÀ-ÿ0-9]/.test(password)) score += 1;

  return { valid: issues.length === 0, issues, score: Math.min(score, 5) };
}

export function friendlyAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "E-mail ou senha não conferem.";
  if (normalized.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (normalized.includes("captcha")) return "Confirme o desafio de segurança e tente novamente.";
  if (normalized.includes("rate limit") || normalized.includes("too many")) {
    return "Muitas tentativas. Espere um pouco e tente novamente.";
  }
  if (normalized.includes("weak_password") || normalized.includes("password")) {
    return "A senha não atende aos requisitos de segurança.";
  }
  return "Não foi possível concluir agora. Tente novamente em instantes.";
}
