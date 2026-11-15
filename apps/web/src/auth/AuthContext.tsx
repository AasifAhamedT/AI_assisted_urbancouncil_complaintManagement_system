import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

import { apiRequest } from "../api/client";
import type { Session, User } from "../api/types";
import { sessionStore } from "./session-store";

interface AuthContextValue {
  session: Session | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.get, sessionStore.get);
  const value = useMemo<AuthContextValue>(() => ({
    session,
    login: async (email, password) => {
      const response = await apiRequest<{ data: Session }>({
        method: "POST",
        url: "/api/v1/auth/login",
        data: { email, password }
      });
      sessionStore.set(response.data);
      return response.data.user;
    },
    logout: async () => {
      const active = sessionStore.get();
      try {
        if (active) {
          await apiRequest<void>({
            method: "POST",
            url: "/api/v1/auth/logout",
            data: { refreshToken: active.tokens.refreshToken }
          }, false);
        }
      } finally {
        sessionStore.clear();
      }
    }
  }), [session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
};
