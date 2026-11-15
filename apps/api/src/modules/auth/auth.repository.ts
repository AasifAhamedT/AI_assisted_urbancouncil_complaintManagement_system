import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { AppError } from "../../common/app-error.js";
import { databasePools } from "../../config/databases.js";
import type {
  AccountStatus,
  AuthUser,
  RefreshTokenRecord,
  RoleCode,
  StoredRefreshToken
} from "./auth.types.js";

interface UserRow extends RowDataPacket {
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

interface RoleRow extends RowDataPacket {
  id: string;
}
interface UserIdRow extends RowDataPacket { id: string }

interface RefreshTokenRow extends RowDataPacket {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

const userSelect = `
  SELECT
    u.id,
    u.email,
    u.password_hash AS passwordHash,
    u.display_name AS displayName,
    u.phone_number AS phoneNumber,
    u.status,
    u.token_version AS tokenVersion,
    r.code AS role,
    u.created_at AS createdAt,
    u.updated_at AS updatedAt
  FROM users AS u
  INNER JOIN roles AS r ON r.id = u.role_id
`;

export class AuthRepository {
  private readonly pool = databasePools.auth;

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    const [rows] = await this.pool.execute<UserRow[]>(`${userSelect} WHERE u.email = ? LIMIT 1`, [
      email
    ]);
    return rows[0] ?? null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    const [rows] = await this.pool.execute<UserRow[]>(`${userSelect} WHERE u.id = ? LIMIT 1`, [id]);
    return rows[0] ?? null;
  }

  async createCitizen(input: {
    id: string;
    email: string;
    passwordHash: string;
    displayName: string;
    phoneNumber: string | null;
  }): Promise<AuthUser> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleId = await this.findRoleId(connection, "CITIZEN");
      await connection.execute(
        `INSERT INTO users
          (id, role_id, email, password_hash, display_name, phone_number, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [input.id, roleId, input.email, input.passwordHash, input.displayName, input.phoneNumber]
      );
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account already uses this email.");
      }
      throw error;
    } finally {
      connection.release();
    }

    const user = await this.findUserById(input.id);
    if (!user) {
      throw new AppError(500, "ACCOUNT_CREATION_FAILED", "The account could not be loaded.");
    }
    return user;
  }

  async createManagedAccount(input: {
    id: string;
    role: "DEPARTMENT" | "ADMINISTRATOR";
    email: string;
    passwordHash: string;
    displayName: string;
    phoneNumber: string | null;
  }): Promise<AuthUser> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const roleId = await this.findRoleId(connection, input.role);
      await connection.execute(
        `INSERT INTO users
          (id, role_id, email, password_hash, display_name, phone_number, status)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [input.id, roleId, input.email, input.passwordHash, input.displayName, input.phoneNumber]
      );
      await connection.commit();
    } catch (error: unknown) {
      await connection.rollback();
      if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account already uses this email.");
      }
      throw error;
    } finally {
      connection.release();
    }
    const user = await this.findUserById(input.id);
    if (!user) {
      throw new AppError(500, "ACCOUNT_CREATION_FAILED", "The account could not be loaded.");
    }
    return user;
  }

  async updateAccountStatus(
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "LOCKED"
  ): Promise<void> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE users
       SET status = ?, token_version = token_version + 1
       WHERE id = ?`,
      [status, userId]
    );
    if (result.affectedRows !== 1) {
      throw new AppError(404, "USER_NOT_FOUND", "The user account does not exist.");
    }
    if (status !== "ACTIVE") {
      await this.pool.execute(
        `UPDATE refresh_tokens
         SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3))
         WHERE user_id = ?`,
        [userId]
      );
    }
  }

  async listUsersByIds(ids: string[]): Promise<AuthUser[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(", ");
    const [rows] = await this.pool.execute<UserRow[]>(
      `${userSelect} WHERE u.id IN (${placeholders})`,
      ids
    );
    return rows;
  }

  async listActiveUserIdsByRole(role: RoleCode): Promise<string[]> {
    const [rows] = await this.pool.execute<UserIdRow[]>(
      `SELECT u.id
       FROM users AS u
       INNER JOIN roles AS r ON r.id = u.role_id
       WHERE r.code = ? AND u.status = 'ACTIVE'
       ORDER BY u.id`,
      [role]
    );
    return rows.map((row) => row.id);
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.pool.execute("UPDATE users SET last_login_at = CURRENT_TIMESTAMP(3) WHERE id = ?", [
      userId
    ]);
  }

  async insertRefreshToken(token: StoredRefreshToken): Promise<void> {
    await this.pool.execute(
      `INSERT INTO refresh_tokens
        (id, user_id, token_hash, family_id, expires_at, created_by_ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        token.id,
        token.userId,
        token.tokenHash,
        token.familyId,
        token.expiresAt,
        token.createdByIp,
        token.userAgent
      ]
    );
  }

  async findRefreshTokenById(id: string): Promise<RefreshTokenRecord | null> {
    const [rows] = await this.pool.execute<RefreshTokenRow[]>(
      `SELECT
        id,
        user_id AS userId,
        token_hash AS tokenHash,
        family_id AS familyId,
        expires_at AS expiresAt,
        revoked_at AS revokedAt
       FROM refresh_tokens
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    return rows[0] ?? null;
  }

  async rotateRefreshToken(input: {
    currentTokenId: string;
    currentUserId: string;
    replacement: StoredRefreshToken;
    revokedByIp: string | null;
  }): Promise<void> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO refresh_tokens
          (id, user_id, token_hash, family_id, expires_at, created_by_ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.replacement.id,
          input.replacement.userId,
          input.replacement.tokenHash,
          input.replacement.familyId,
          input.replacement.expiresAt,
          input.replacement.createdByIp,
          input.replacement.userAgent
        ]
      );
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP(3), replaced_by_token_id = ?, revoked_by_ip = ?
         WHERE id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP(3)`,
        [
          input.replacement.id,
          input.revokedByIp,
          input.currentTokenId,
          input.currentUserId
        ]
      );
      if (result.affectedRows !== 1) {
        throw new AppError(401, "REFRESH_TOKEN_REUSED", "The refresh token is no longer valid.");
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async markTokenFamilyAsReused(familyId: string): Promise<void> {
    await this.pool.execute(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)),
           reuse_detected_at = COALESCE(reuse_detected_at, CURRENT_TIMESTAMP(3))
       WHERE family_id = ?`,
      [familyId]
    );
  }

  async revokeRefreshToken(input: {
    tokenId: string;
    userId: string;
    revokedByIp: string | null;
  }): Promise<void> {
    await this.pool.execute(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP(3)), revoked_by_ip = ?
       WHERE id = ? AND user_id = ?`,
      [input.revokedByIp, input.tokenId, input.userId]
    );
  }

  private async findRoleId(connection: PoolConnection, code: RoleCode): Promise<string> {
    const [rows] = await connection.execute<RoleRow[]>(
      "SELECT id FROM roles WHERE code = ? LIMIT 1",
      [code]
    );
    const role = rows[0];
    if (!role) {
      throw new AppError(500, "ROLE_CONFIGURATION_MISSING", "Required role configuration is missing.");
    }
    return role.id;
  }
}

