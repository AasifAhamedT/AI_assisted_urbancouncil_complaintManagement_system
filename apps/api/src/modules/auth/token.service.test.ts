import { describe, expect, it } from "vitest";

import { TokenService } from "./token.service.js";

describe("TokenService", () => {
  it("signs and verifies an access token", async () => {
    const service = new TokenService();
    const token = await service.createAccessToken({
      userId: "50000000-0000-4000-8000-000000000001",
      email: "citizen@example.com",
      role: "CITIZEN",
      tokenVersion: 0
    });

    await expect(service.verifyAccessToken(token)).resolves.toMatchObject({
      sub: "50000000-0000-4000-8000-000000000001",
      email: "citizen@example.com",
      role: "CITIZEN",
      tokenVersion: 0
    });
  });

  it("creates verifiable refresh tokens and constant-time hashes", async () => {
    const service = new TokenService();
    const refresh = await service.createRefreshToken({
      userId: "50000000-0000-4000-8000-000000000001",
      tokenVersion: 0,
      ipAddress: "127.0.0.1",
      userAgent: "test"
    });

    await expect(service.verifyRefreshToken(refresh.rawToken)).resolves.toMatchObject({
      sub: refresh.record.userId,
      tokenId: refresh.record.id,
      familyId: refresh.record.familyId,
      tokenVersion: 0
    });
    expect(service.tokenHashesMatch(refresh.rawToken, refresh.record.tokenHash)).toBe(true);
    expect(service.tokenHashesMatch(`${refresh.rawToken}tampered`, refresh.record.tokenHash)).toBe(false);
  });
});

