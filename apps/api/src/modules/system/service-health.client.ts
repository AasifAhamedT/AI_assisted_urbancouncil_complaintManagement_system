import { performance } from "node:perf_hooks";

import { z } from "zod";

const readinessSchema = z.object({
  status: z.enum(["ready", "configuration_required"]),
  service: z.string().min(1).max(100),
  provider_configured: z.boolean()
}).strict();

export interface IntegrationHealth {
  service: "ai-classifier" | "rag";
  reachable: boolean;
  readiness: "ready" | "configuration_required" | "unavailable" | "invalid_response";
  providerConfigured: boolean | null;
  latencyMs: number;
  failureCode?: "TIMEOUT" | "CONNECTION_FAILED" | "HTTP_ERROR" | "INVALID_RESPONSE";
}

export class ServiceHealthClient {
  constructor(
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async check(
    service: IntegrationHealth["service"],
    baseUrl: string,
    requestId: string
  ): Promise<IntegrationHealth> {
    const started = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetcher(new URL("/ready", baseUrl), {
        method: "GET",
        headers: {
          accept: "application/json",
          "x-request-id": requestId
        },
        signal: controller.signal
      });
      if (!response.ok) {
        return this.failure(service, started, "HTTP_ERROR");
      }
      const parsed = readinessSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.service !== service) {
        return this.failure(service, started, "INVALID_RESPONSE", "invalid_response");
      }
      return {
        service,
        reachable: true,
        readiness: parsed.data.status,
        providerConfigured: parsed.data.provider_configured,
        latencyMs: Math.round(performance.now() - started)
      };
    } catch (error) {
      const failureCode = error instanceof Error && error.name === "AbortError"
        ? "TIMEOUT"
        : "CONNECTION_FAILED";
      return this.failure(service, started, failureCode);
    } finally {
      clearTimeout(timeout);
    }
  }

  private failure(
    service: IntegrationHealth["service"],
    started: number,
    failureCode: NonNullable<IntegrationHealth["failureCode"]>,
    readiness: IntegrationHealth["readiness"] = "unavailable"
  ): IntegrationHealth {
    return {
      service,
      reachable: false,
      readiness,
      providerConfigured: null,
      latencyMs: Math.round(performance.now() - started),
      failureCode
    };
  }
}
