import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(async () => {
  vi.stubEnv("MYSQL_HOST", "127.0.0.1");
  vi.stubEnv("MYSQL_USER", "test-user");
  vi.stubEnv("MYSQL_PASSWORD", "test-password");
  vi.stubEnv("JWT_ACCESS_SECRET", "test-access-secret-with-32-characters-minimum");
  vi.stubEnv("JWT_REFRESH_SECRET", "test-refresh-secret-with-32-characters-minimum");
  vi.stubEnv("AI_CLASSIFIER_BASE_URL", "http://127.0.0.1:8001");
  vi.stubEnv("RAG_BASE_URL", "http://127.0.0.1:8002");
  // Load dependencies during setup, outside the HTTP response test timeout.
  await import("./app.js");
}, 20_000);

describe("GET /health", () => {
  it("returns API liveness without exposing sensitive configuration", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "api",
      environment: "test"
    });
    expect(response.text).not.toContain("test-password");
  });
});

describe("versioned API gateway", () => {
  it("advertises the v1 boundary and returns a request ID", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/api/v1").set("x-request-id", "gateway-test-1");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("gateway-test-1");
    expect(response.body.data).toMatchObject({ service: "api", version: "v1" });
  });

  it("protects integration status from unauthenticated callers", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/api/v1/system/integrations");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("returns a traceable structured error for unknown routes", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp())
      .get("/api/v1/not-a-real-route")
      .set("x-request-id", "missing-route-test");

    expect(response.status).toBe(404);
    expect(response.body.error).toMatchObject({
      code: "ROUTE_NOT_FOUND",
      requestId: "missing-route-test"
    });
  });
});

describe("authentication route boundaries", () => {
  it("rejects attempts to choose a privileged registration role", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).post("/api/v1/auth/register").send({
      email: "citizen@example.com",
      password: "SecurePassword123",
      displayName: "Example Citizen",
      role: "ADMINISTRATOR"
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("requires a Bearer token for the current-user endpoint", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/api/v1/auth/me");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("protects knowledge document management from unauthenticated callers", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/api/v1/knowledge/documents");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("protects operational reports from unauthenticated callers", async () => {
    const { createApp } = await import("./app.js");
    const response = await request(createApp()).get("/api/v1/reports/overview");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("AUTHENTICATION_REQUIRED");
  });
});

