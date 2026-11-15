import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import type { RequestContext } from "../../common/request-context.js";
import { AuthRepository } from "./auth.repository.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import type { AuthPrincipal, AuthUser, PublicUser, SessionTokens } from "./auth.types.js";
import { PasswordService } from "./password.service.js";
import { TokenService } from "./token.service.js";

const toPublicUser = (user: AuthUser): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  phoneNumber: user.phoneNumber,
  status: user.status,
  role: user.role,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString()
});

const toPrincipal = (user: AuthUser): AuthPrincipal => ({
  userId: user.id,
  email: user.email,
  role: user.role,
  tokenVersion: user.tokenVersion
});

export class AuthService {
  constructor(
    private readonly repository = new AuthRepository(),
    private readonly passwords = new PasswordService(),
    private readonly tokens = new TokenService()
  ) {}

  async registerCitizen(input: RegisterInput): Promise<PublicUser> {
    const existing = await this.repository.findUserByEmail(input.email);
    if (existing) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account already uses this email.");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.repository.createCitizen({
      id: randomUUID(),
      email: input.email,
      passwordHash,
      displayName: input.displayName,
      phoneNumber: input.phoneNumber ?? null
    });
    return toPublicUser(user);
  }

  async login(input: LoginInput, context: RequestContext): Promise<{
    user: PublicUser;
    tokens: SessionTokens;
  }> {
    const user = await this.repository.findUserByEmail(input.email);
    if (!user) {
      await this.passwords.consumeDummyVerification(input.password);
      throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
    }

    const passwordMatches = await this.passwords.verify(user.passwordHash, input.password);
    if (!passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "The email or password is incorrect.");
    }
    this.assertAccountActive(user);

    const session = await this.issueSession(user, context);
    await this.repository.updateLastLogin(user.id);
    return { user: toPublicUser(user), tokens: session };
  }

  async refresh(rawToken: string, context: RequestContext): Promise<SessionTokens> {
    const claims = await this.tokens.verifyRefreshToken(rawToken);
    const stored = await this.repository.findRefreshTokenById(claims.tokenId);

    const tokenMatches =
      stored !== null &&
      stored.userId === claims.sub &&
      stored.familyId === claims.familyId &&
      this.tokens.tokenHashesMatch(rawToken, stored.tokenHash);

    if (!stored || !tokenMatches) {
      await this.repository.markTokenFamilyAsReused(claims.familyId);
      throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid.");
    }

    if (stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      await this.repository.markTokenFamilyAsReused(stored.familyId);
      throw new AppError(401, "REFRESH_TOKEN_REUSED", "The refresh token is no longer valid.");
    }

    const user = await this.repository.findUserById(stored.userId);
    if (!user || user.tokenVersion !== claims.tokenVersion) {
      throw new AppError(401, "SESSION_REVOKED", "The session is no longer valid.");
    }
    this.assertAccountActive(user);

    const replacement = await this.tokens.createRefreshToken({
      userId: user.id,
      tokenVersion: user.tokenVersion,
      familyId: stored.familyId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await this.repository.rotateRefreshToken({
      currentTokenId: stored.id,
      currentUserId: user.id,
      replacement: replacement.record,
      revokedByIp: context.ipAddress
    });

    return {
      accessToken: await this.tokens.createAccessToken(toPrincipal(user)),
      refreshToken: replacement.rawToken,
      accessTokenExpiresInSeconds: this.tokens.accessTokenExpiresInSeconds,
      refreshTokenExpiresAt: replacement.record.expiresAt.toISOString()
    };
  }

  async logout(rawToken: string, context: RequestContext): Promise<void> {
    const claims = await this.tokens.verifyRefreshToken(rawToken);
    await this.repository.revokeRefreshToken({
      tokenId: claims.tokenId,
      userId: claims.sub,
      revokedByIp: context.ipAddress
    });
  }

  async authenticateAccessToken(rawToken: string): Promise<AuthPrincipal> {
    const claims = await this.tokens.verifyAccessToken(rawToken);
    const user = await this.repository.findUserById(claims.sub);
    if (!user || user.tokenVersion !== claims.tokenVersion) {
      throw new AppError(401, "SESSION_REVOKED", "The session is no longer valid.");
    }
    this.assertAccountActive(user);
    if (user.email !== claims.email || user.role !== claims.role) {
      throw new AppError(401, "SESSION_REVOKED", "The session is no longer valid.");
    }
    return toPrincipal(user);
  }

  async getCurrentUser(userId: string): Promise<PublicUser> {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new AppError(404, "USER_NOT_FOUND", "The user account does not exist.");
    }
    this.assertAccountActive(user);
    return toPublicUser(user);
  }

  private async issueSession(user: AuthUser, context: RequestContext): Promise<SessionTokens> {
    const refresh = await this.tokens.createRefreshToken({
      userId: user.id,
      tokenVersion: user.tokenVersion,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent
    });
    await this.repository.insertRefreshToken(refresh.record);
    return {
      accessToken: await this.tokens.createAccessToken(toPrincipal(user)),
      refreshToken: refresh.rawToken,
      accessTokenExpiresInSeconds: this.tokens.accessTokenExpiresInSeconds,
      refreshTokenExpiresAt: refresh.record.expiresAt.toISOString()
    };
  }

  private assertAccountActive(user: AuthUser): void {
    if (user.status === "LOCKED") {
      throw new AppError(423, "ACCOUNT_LOCKED", "The account is locked.");
    }
    if (user.status !== "ACTIVE") {
      throw new AppError(403, "ACCOUNT_INACTIVE", "The account is not active.");
    }
  }
}

