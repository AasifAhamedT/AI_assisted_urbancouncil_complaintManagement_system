import { describe, expect, it, vi } from "vitest";

import type { AttachmentStorageService } from "./attachment-storage.service.js";
import type { ComplaintRepository } from "./complaint.repository.js";
import { ComplaintService } from "./complaint.service.js";
import type { ComplaintAccessScope, ComplaintListOptions } from "./complaint.types.js";
import type { DepartmentService } from "../department/department.service.js";

const options: ComplaintListOptions = {
  page: 1,
  pageSize: 20,
  sortBy: "createdAt",
  sortOrder: "desc"
};

describe("complaint access scopes", () => {
  it("derives Citizen and Department scope from the authenticated principal", async () => {
    const scopes: ComplaintAccessScope[] = [];
    const repository = {
      listComplaints: vi.fn(async (scope: ComplaintAccessScope) => {
        scopes.push(scope);
        return { items: [], total: 0 };
      })
    } as unknown as ComplaintRepository;
    const departments = {
      requireActiveDepartmentForAccount: vi.fn(async () => "20000000-0000-4000-8000-000000000001")
    } as unknown as DepartmentService;
    const service = new ComplaintService(
      repository,
      departments,
      {} as AttachmentStorageService
    );

    await service.listComplaints({
      userId: "10000000-0000-4000-8000-000000000001",
      email: "citizen@example.com",
      role: "CITIZEN",
      tokenVersion: 0
    }, options);
    await service.listComplaints({
      userId: "10000000-0000-4000-8000-000000000002",
      email: "department@example.com",
      role: "DEPARTMENT",
      tokenVersion: 0
    }, options);
    await service.listComplaints({
      userId: "10000000-0000-4000-8000-000000000003",
      email: "admin@example.com",
      role: "ADMINISTRATOR",
      tokenVersion: 0
    }, options);

    expect(scopes).toEqual([
      { kind: "CITIZEN", userId: "10000000-0000-4000-8000-000000000001" },
      { kind: "DEPARTMENT", departmentId: "20000000-0000-4000-8000-000000000001" },
      { kind: "ADMINISTRATOR" }
    ]);
  });
});
