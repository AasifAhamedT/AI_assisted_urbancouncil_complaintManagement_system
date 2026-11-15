import { describe, expect, it, vi } from "vitest";

import type { AuthPrincipal } from "../auth/auth.types.js";
import type { DepartmentService } from "../department/department.service.js";
import type { ReassignmentRepository } from "./reassignment.repository.js";
import { ReassignmentService } from "./reassignment.service.js";

const departmentPrincipal: AuthPrincipal = {
  userId: "10000000-0000-4000-8000-000000000002",
  email: "department@example.com",
  role: "DEPARTMENT",
  tokenVersion: 0
};

const administratorPrincipal: AuthPrincipal = {
  userId: "10000000-0000-4000-8000-000000000003",
  email: "admin@example.com",
  role: "ADMINISTRATOR",
  tokenVersion: 0
};

const complaintId = "30000000-0000-4000-8000-000000000001";
const currentDepartmentId = "20000000-0000-4000-8000-000000000001";
const targetDepartmentId = "20000000-0000-4000-8000-000000000002";

const requestRecord = {
  id: "80000000-0000-4000-8000-000000000001",
  complaintId,
  complaintReference: "KUC-2026-TEST0001",
  requestedByUserId: departmentPrincipal.userId,
  fromDepartmentId: currentDepartmentId,
  suggestedDepartmentId: null,
  approvedDepartmentId: null,
  reason: "The issue belongs to another department based on its responsibilities.",
  status: "PENDING" as const,
  decidedByUserId: null,
  decisionReason: null,
  createdAt: new Date(),
  decidedAt: null
};

describe("reassignment workflow", () => {
  it("derives the requesting department from the authenticated account", async () => {
    const createPending = vi.fn(async () => "CREATED" as const);
    const repository = {
      createPending,
      findById: vi.fn(async () => requestRecord)
    } as unknown as ReassignmentRepository;
    const departments = {
      requireActiveDepartmentForAccount: vi.fn(async () => currentDepartmentId)
    } as unknown as DepartmentService;
    const service = new ReassignmentService(repository, departments);

    await service.create({
      complaintId,
      reason: requestRecord.reason
    }, departmentPrincipal);

    expect(createPending).toHaveBeenCalledWith(expect.objectContaining({
      complaintId,
      actorUserId: departmentPrincipal.userId,
      departmentId: currentDepartmentId
    }));
  });

  it("does not reveal complaints assigned to another department", async () => {
    const service = new ReassignmentService(
      { createPending: vi.fn(async () => "ASSIGNMENT_CHANGED") } as unknown as ReassignmentRepository,
      { requireActiveDepartmentForAccount: vi.fn(async () => currentDepartmentId) } as unknown as DepartmentService
    );

    await expect(service.create({ complaintId, reason: requestRecord.reason }, departmentPrincipal))
      .rejects.toMatchObject({ statusCode: 404, code: "COMPLAINT_NOT_FOUND" });
  });

  it("prevents duplicate pending requests", async () => {
    const service = new ReassignmentService(
      { createPending: vi.fn(async () => "PENDING_EXISTS") } as unknown as ReassignmentRepository,
      { requireActiveDepartmentForAccount: vi.fn(async () => currentDepartmentId) } as unknown as DepartmentService
    );

    await expect(service.create({ complaintId, reason: requestRecord.reason }, departmentPrincipal))
      .rejects.toMatchObject({ statusCode: 409, code: "REASSIGNMENT_ALREADY_PENDING" });
  });

  it("validates the active target before approving and records the administrator actor", async () => {
    const decide = vi.fn(async () => "DECIDED" as const);
    const repository = {
      decide,
      findById: vi.fn(async () => ({
        ...requestRecord,
        status: "APPROVED",
        approvedDepartmentId: targetDepartmentId
      }))
    } as unknown as ReassignmentRepository;
    const departments = {
      requireActiveDepartment: vi.fn(async () => ({ id: targetDepartmentId, isActive: true }))
    } as unknown as DepartmentService;
    const service = new ReassignmentService(repository, departments);

    await service.decide(requestRecord.id, {
      decision: "APPROVED",
      targetDepartmentId,
      decisionReason: "The target department is responsible for this complaint."
    }, administratorPrincipal);

    expect(decide).toHaveBeenCalledWith(expect.objectContaining({
      requestId: requestRecord.id,
      actorUserId: administratorPrincipal.userId,
      decision: "APPROVED",
      targetDepartmentId
    }));
  });

  it("scopes department lists using the authenticated account mapping", async () => {
    const list = vi.fn(async () => ({ items: [], total: 0 }));
    const service = new ReassignmentService(
      { list } as unknown as ReassignmentRepository,
      { requireActiveDepartmentForAccount: vi.fn(async () => currentDepartmentId) } as unknown as DepartmentService
    );

    await service.list(departmentPrincipal, { page: 1, pageSize: 20 });

    expect(list).toHaveBeenCalledWith(
      { kind: "DEPARTMENT", departmentId: currentDepartmentId },
      { page: 1, pageSize: 20 }
    );
  });
});
