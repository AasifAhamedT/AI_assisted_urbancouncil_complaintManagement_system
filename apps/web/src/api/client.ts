import axios, { AxiosError, type AxiosRequestConfig } from "axios";

import { webEnv } from "../env";
import { sessionStore } from "../auth/session-store";
import type { SessionTokens } from "./types";

interface ErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    requestId?: string;
  };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const http = axios.create({
  baseURL: webEnv.apiBaseUrl,
  timeout: 15_000,
  headers: { Accept: "application/json" }
});

let refreshInFlight: Promise<void> | null = null;

const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    const body = error.response?.data as ErrorBody | undefined;
    return new ApiError(
      error.response?.status ?? 0,
      body?.error?.code ?? "NETWORK_ERROR",
      body?.error?.message ?? "The server could not be reached. Please try again.",
      body?.error?.details,
      body?.error?.requestId
    );
  }
  return new ApiError(0, "UNKNOWN_ERROR", "An unexpected error occurred.");
};

const refreshSession = async (): Promise<void> => {
  const session = sessionStore.get();
  if (!session) throw new ApiError(401, "SESSION_REQUIRED", "Please sign in again.");
  const response = await axios.post<{ data: { tokens: SessionTokens } }>(
    `${webEnv.apiBaseUrl}/api/v1/auth/refresh`,
    { refreshToken: session.tokens.refreshToken },
    { timeout: 15_000 }
  );
  sessionStore.set({ ...session, tokens: response.data.data.tokens });
};

export const apiRequest = async <T>(
  config: AxiosRequestConfig,
  allowRefresh = true
): Promise<T> => {
  const session = sessionStore.get();
  try {
    const response = await http.request<T>({
      ...config,
      headers: {
        ...config.headers,
        ...(session ? { Authorization: `Bearer ${session.tokens.accessToken}` } : {})
      }
    });
    return response.data;
  } catch (rawError) {
    const error = toApiError(rawError);
    const isAuthRoute = String(config.url ?? "").includes("/auth/");
    if (error.status === 401 && allowRefresh && session && !isAuthRoute) {
      try {
        refreshInFlight ??= refreshSession().finally(() => {
          refreshInFlight = null;
        });
        await refreshInFlight;
        return await apiRequest<T>(config, false);
      } catch {
        sessionStore.clear();
        throw new ApiError(401, "SESSION_EXPIRED", "Your session expired. Please sign in again.");
      }
    }
    throw error;
  }
};

export const messageFromError = (error: unknown): string =>
  error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
