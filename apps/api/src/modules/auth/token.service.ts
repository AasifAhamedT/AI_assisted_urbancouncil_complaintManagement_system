import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { AppError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import type { AuthPrincipal, RoleCode, StoredRefreshToken } from "./auth.types.js";

const issuer = "sucms-api";
const audience = "sucms-web";

interface AccessClaims {
  sub: string;
  email: string;
  role: RoleCode;
  tokenVersion: number;
}

interface RefreshClaims {
  sub: string;
  tokenId: string;
  familyId: string;
  tokenVersion: number;
}

export class TokenService {
  private readonly accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
  private readonly refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

  readonly accessTokenExpiresInSeconds = env.JWT_ACCESS_TTL_MINUTES * 60;

  async createAccessToken(principal: AuthPrincipal): Promise<string> {
    return new SignJWT({
      type: "access",
      email: principal.email,
      role: principal.role,
      tokenVersion: principal.tokenVersion
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(principal.userId)
      .setJti(randomUUID())
      .setIssuedAt()
      .setExpirationTime(`${env.JWT_ACCESS_TTL_MINUTES}m`)
      .sign(this.accessSecret);
  }

  async createRefreshToken(input: {
    userId: string;
    tokenVersion: number;
    familyId?: string;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<{ rawToken: string; record: StoredRefreshToken }> {
    const id = randomUUID();
    const familyId = input.familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    const rawToken = await new SignJWT({
      type: "refresh",
      familyId,
      tokenVersion: input.tokenVersion
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(input.userId)
      .setJti(id)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.refreshSecret);

    return {
      rawToken,
      record: {
        id,
        userId: input.userId,
        tokenHash: this.hashToken(rawToken),
        familyId,
        expiresAt,
        createdByIp: input.ipAddress,
        userAgent: input.userAgent
      }
    };
  }

  async verifyAccessToken(token: string): Promise<AccessClaims> {
    try {
      const { payload } = await jwtVerify(token, this.accessSecret, { issuer, audience });
      if (
        payload.type !== "access" ||
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        (payload.role !== "CITIZEN" &&
          payload.role !== "DEPARTMENT" &&
          payload.role !== "ADMINISTRATOR") ||
        typeof payload.tokenVersion !== "number"
      ) {
        throw new Error("Invalid access token claims");
      }
      return {
        sub: payload.sub,
        email: payload.email,
        role: payload.role,
        tokenVersion: payload.tokenVersion
      };
    } catch {
      throw new AppError(401, "INVALID_ACCESS_TOKEN", "The access token is invalid or expired.");
    }
  }

  async verifyRefreshToken(token: string): Promise<RefreshClaims> {
    try {
      const { payload } = await jwtVerify(token, this.refreshSecret, { issuer, audience });
      if (
        payload.type !== "refresh" ||
        typeof payload.sub !== "string" ||
        typeof payload.jti !== "string" ||
        typeof payload.familyId !== "string" ||
        typeof payload.tokenVersion !== "number"
      ) {
        throw new Error("Invalid refresh token claims");
      }
      return {
        sub: payload.sub,
        tokenId: payload.jti,
        familyId: payload.familyId,
        tokenVersion: payload.tokenVersion
      };
    } catch {
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired.");
    }
  }

  hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  tokenHashesMatch(rawToken: string, expectedHash: string): boolean {
    const actual = Buffer.from(this.hashToken(rawToken), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}

