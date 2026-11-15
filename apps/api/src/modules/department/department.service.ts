import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import { AccountAdministrationService } from "../auth/account-administration.service.js";
import type {
  CreateCategoryInput,
  CreateDepartmentAccountInput,
  CreateDepartmentInput,
  UpdateCategoryInput,
  UpdateDepartmentInput
} from "./department.schemas.js";
import { DepartmentRepository } from "./department.repository.js";

export class DepartmentService {
  constructor(
    private readonly repository = new DepartmentRepository(),
    private readonly accounts = new AccountAdministrationService()
  ) {}

  listDepartments() {
    return this.repository.listDepartments();
  }

  listActiveCategories() {
    return this.repository.listActiveCategories();
  }

  async resolveActiveCategoryRouting(categoryId: string) {
    const routing = await this.repository.findActiveCategoryRouting(categoryId);
    if (!routing) {
      throw new AppError(400, "INVALID_CATEGORY", "The selected category is not active.");
    }
    return routing;
  }

  async requireActiveDepartmentForAccount(userId: string): Promise<string> {
    const departmentId = await this.repository.findActiveDepartmentIdForAccount(userId);
    if (!departmentId) {
      throw new AppError(
        403,
        "DEPARTMENT_ACCESS_UNAVAILABLE",
        "This Department Account has no active department assignment."
      );
    }
    return departmentId;
  }

  async createDepartment(input: CreateDepartmentInput, actorUserId: string) {
    const id = randomUUID();
    await this.repository.createDepartment({
      id,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
      actorUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.requireDepartment(id);
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput, actorUserId: string) {
    const existing = await this.requireDepartment(id);
    await this.repository.updateDepartment({
      ...existing,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      isActive: input.isActive ?? existing.isActive,
      actorUserId
    });
    return this.requireDepartment(id);
  }

  listCategories() {
    return this.repository.listCategories();
  }

  async createCategory(input: CreateCategoryInput, actorUserId: string) {
    const id = randomUUID();
    await this.repository.createCategory({
      id,
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      isActive: true,
      actorUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return this.requireCategory(id);
  }

  async updateCategory(id: string, input: UpdateCategoryInput, actorUserId: string) {
    const existing = await this.requireCategory(id);
    await this.repository.updateCategory({
      ...existing,
      code: input.code ?? existing.code,
      name: input.name ?? existing.name,
      description: input.description === undefined ? existing.description : input.description,
      isActive: input.isActive ?? existing.isActive,
      actorUserId
    });
    return this.requireCategory(id);
  }

  listMappings() {
    return this.repository.listMappings();
  }

  async setMapping(categoryId: string, departmentId: string, actorUserId: string) {
    const category = await this.requireCategory(categoryId);
    const department = await this.requireDepartment(departmentId);
    if (!category.isActive) {
      throw new AppError(409, "CATEGORY_INACTIVE", "An inactive category cannot be routed.");
    }
    if (!department.isActive) {
      throw new AppError(409, "DEPARTMENT_INACTIVE", "An inactive department cannot receive routing.");
    }
    await this.repository.upsertMapping({
      id: randomUUID(),
      categoryId,
      departmentId,
      actorUserId
    });
    return (await this.repository.listMappings()).find((mapping) => mapping.categoryId === categoryId)!;
  }

  async createDepartmentAccount(input: CreateDepartmentAccountInput, actorUserId: string) {
    const department = await this.requireDepartment(input.departmentId);
    if (!department.isActive) {
      throw new AppError(409, "DEPARTMENT_INACTIVE", "An inactive department cannot receive an account.");
    }
    if (await this.repository.findDepartmentAccountMappingByDepartmentId(department.id)) {
      throw new AppError(
        409,
        "DEPARTMENT_ACCOUNT_ALREADY_EXISTS",
        "This department already has a Department Account. Reactivate the existing account instead."
      );
    }
    const user = await this.accounts.createManagedAccount({
      role: "DEPARTMENT",
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      phoneNumber: input.phoneNumber ?? null
    });
    try {
      await this.repository.createDepartmentAccountMapping({
        id: randomUUID(),
        userId: user.id,
        departmentId: department.id,
        actorUserId
      });
    } catch (error) {
      await this.accounts.setDepartmentAccountStatus(user.id, "INACTIVE");
      throw error;
    }
    return { user, department };
  }

  async listDepartmentAccounts() {
    const mappings = await this.repository.listDepartmentAccountMappings();
    const users = await this.accounts.listUsers(mappings.map((mapping) => mapping.userId));
    const usersById = new Map(users.map((user) => [user.id, user]));
    return mappings.map((mapping) => ({
      ...mapping,
      user: usersById.get(mapping.userId) ?? null
    }));
  }

  async setDepartmentAccountStatus(
    userId: string,
    status: "ACTIVE" | "INACTIVE" | "LOCKED"
  ): Promise<void> {
    if (status === "ACTIVE") {
      await this.accounts.setDepartmentAccountStatus(userId, status);
      try {
        await this.repository.setDepartmentAccountMappingActive(userId, true);
      } catch (error) {
        await this.accounts.setDepartmentAccountStatus(userId, "INACTIVE");
        throw error;
      }
      return;
    }
    await this.repository.setDepartmentAccountMappingActive(userId, false);
    await this.accounts.setDepartmentAccountStatus(userId, status);
  }

  private async requireDepartment(id: string) {
    const department = await this.repository.findDepartment(id);
    if (!department) {
      throw new AppError(404, "DEPARTMENT_NOT_FOUND", "Department not found.");
    }
    return department;
  }

  private async requireCategory(id: string) {
    const category = await this.repository.findCategory(id);
    if (!category) {
      throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found.");
    }
    return category;
  }
}

