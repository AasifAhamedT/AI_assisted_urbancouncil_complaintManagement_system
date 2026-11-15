import type { Session } from "../api/types";

const storageKey = "sucms.session";
const listeners = new Set<() => void>();

const readSession = (): Session | null => {
  const stored = sessionStorage.getItem(storageKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Session;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
};

let currentSession = readSession();

const emit = () => listeners.forEach((listener) => listener());

export const sessionStore = {
  get: () => currentSession,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  set: (session: Session) => {
    currentSession = session;
    sessionStorage.setItem(storageKey, JSON.stringify(session));
    emit();
  },
  clear: () => {
    currentSession = null;
    sessionStorage.removeItem(storageKey);
    emit();
  }
};
