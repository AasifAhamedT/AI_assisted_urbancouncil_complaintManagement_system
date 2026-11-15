export const roleCodes = ["CITIZEN", "DEPARTMENT", "ADMINISTRATOR"] as const;
export type RoleCode = (typeof roleCodes)[number];

export const accountStatuses = ["PENDING", "ACTIVE", "INACTIVE", "LOCKED"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export interface AuthUser {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  phoneNumber: string | null;
  status: AccountStatus;
  tokenVersion: number;
  role: RoleCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  phoneNumber: string | null;
  status: AccountStatus;
  role: RoleCode;
  createdAt: string;
  updatedAt: string;
}

export interface AuthPrincipal {
  userId: string;
  email: string;
  role: RoleCode;
  tokenVersion: number;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface StoredRefreshToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  createdByIp: string | null;
  userAgent: string | null;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: string;
}

