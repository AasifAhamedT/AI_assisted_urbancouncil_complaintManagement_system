import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import { AuthRepository } from "./auth.repository.js";
import type { AuthUser, PublicUser } from "./auth.types.js";
import { PasswordService } from "./password.service.js";

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

export class AccountAdministrationService {
  constructor(
    private readonly repository = new AuthRepository(),
    private readonly passwords = new PasswordService()
  ) {}

  async createManagedAccount(input: {
    role: "DEPARTMENT" | "ADMINISTRATOR";
    email: string;
    password: string;
    displayName: string;
    phoneNumber: string | null;
  }): Promise<PublicUser> {
    if (await this.repository.findUserByEmail(input.email)) {
      throw new AppError(409, "EMAIL_ALREADY_REGISTERED", "An account already uses this email.");
    }
    const user = await this.repository.createManagedAccount({
      id: randomUUID(),
      role: input.role,
      email: input.email,
      passwordHash: await this.passwords.hash(input.password),
      displayName: input.displayName,
      phoneNumber: input.phoneNumber
    });
    return toPublicUser(user);
  }

  async setDepartmentAccountStatus(
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "LOCKED"
  ): Promise<void> {
    const user = await this.repository.findUserById(userId);
    if (!user || user.role !== "DEPARTMENT") {
      throw new AppError(404, "DEPARTMENT_ACCOUNT_NOT_FOUND", "Department Account not found.");
    }
    await this.repository.updateAccountStatus(userId, status);
  }

  async listUsers(ids: string[]): Promise<PublicUser[]> {
    return (await this.repository.listUsersByIds(ids)).map(toPublicUser);
  }
}

