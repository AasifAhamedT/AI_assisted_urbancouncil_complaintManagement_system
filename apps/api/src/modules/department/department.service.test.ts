import { describe, expect, it, vi } from "vitest";

import type { AccountAdministrationService } from "../auth/account-administration.service.js";
import type { DepartmentRepository } from "./department.repository.js";
import { DepartmentService } from "./department.service.js";

describe("Department Account uniqueness", () => {
  it("rejects a second account for the same department before creating an Auth user", async () => {
    const createManagedAccount = vi.fn();
    const repository = {
      findDepartment: vi.fn(async () => ({
        id: "20000000-0000-4000-8000-000000000002",
        code: "PLANNING",
        name: "Planning Branch",
        description: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })),
      findDepartmentAccountMappingByDepartmentId: vi.fn(async () => ({
        id: "50000000-0000-4000-8000-000000000001",
        userId: "60000000-0000-4000-8000-000000000001",
        departmentId: "20000000-0000-4000-8000-000000000002",
        departmentName: "Planning Branch",
        isActive: true,
        assignedAt: new Date()
      }))
    } as unknown as DepartmentRepository;
    const accounts = { createManagedAccount } as unknown as AccountAdministrationService;
    const service = new DepartmentService(repository, accounts);

    await expect(service.createDepartmentAccount({
      departmentId: "20000000-0000-4000-8000-000000000002",
      email: "second.planning@example.com",
      password: "SecurePassword123",
      displayName: "Second Planning Account"
    }, "10000000-0000-4000-8000-000000000003")).rejects.toMatchObject({
      statusCode: 409,
      code: "DEPARTMENT_ACCOUNT_ALREADY_EXISTS"
    });
    expect(createManagedAccount).not.toHaveBeenCalled();
  });
});
