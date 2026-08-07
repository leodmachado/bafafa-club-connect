import { createContext, createElement, useContext, useMemo, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";

export type AppRole = "visitante" | "gratuito" | "premium" | "equipe" | "moderador" | "admin";

export interface AuthState {
  loading: boolean;
  session: Session | null;
  user: User | null;
  roles: AppRole[];
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({
  user,
  roles,
  children,
}: {
  user: User;
  roles: AppRole[];
  children: ReactNode;
}) {
  const value = useMemo<AuthState>(
    () => ({ loading: false, session: null, user, roles }),
    [roles, user],
  );

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (!state) {
    throw new Error("useAuth precisa estar dentro da área autenticada.");
  }
  return state;
}

export function hasRole(roles: AppRole[], ...target: AppRole[]) {
  return roles.some((r) => target.includes(r));
}
