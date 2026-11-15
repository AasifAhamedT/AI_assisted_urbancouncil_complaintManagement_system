import { describe, expect, it, vi } from "vitest";

import { ServiceHealthClient } from "./service-health.client.js";

describe("service health client", () => {
  it("validates readiness and propagates the request ID", async () => {
    const fetcher = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("x-request-id")).toBe("request-123");
      return new Response(JSON.stringify({
        status: "configuration_required",
        service: "ai-classifier",
        provider_configured: false
      }), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch;
    const result = await new ServiceHealthClient(500, fetcher)
      .check("ai-classifier", "http://127.0.0.1:8001", "request-123");

    expect(result).toMatchObject({
      reachable: true,
      readiness: "configuration_required",
      providerConfigured: false
    });
  });

  it("contains connection failures without leaking implementation errors", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("private network detail");
    }) as typeof fetch;
    const result = await new ServiceHealthClient(500, fetcher)
      .check("rag", "http://127.0.0.1:8002", "request-456");

    expect(result).toMatchObject({
      service: "rag",
      reachable: false,
      readiness: "unavailable",
      failureCode: "CONNECTION_FAILED"
    });
    expect(JSON.stringify(result)).not.toContain("private network detail");
  });

  it("rejects an unexpected service identity", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      status: "ready",
      service: "unexpected-service",
      provider_configured: true
    }), { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;
    const result = await new ServiceHealthClient(500, fetcher)
      .check("rag", "http://127.0.0.1:8002", "request-789");

    expect(result).toMatchObject({
      reachable: false,
      readiness: "invalid_response",
      failureCode: "INVALID_RESPONSE"
    });
  });
});
