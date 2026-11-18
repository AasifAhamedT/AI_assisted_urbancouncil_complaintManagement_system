import { describe, expect, it, vi } from "vitest";

import type { AuthPrincipal } from "../auth/auth.types.js";
import type { ComplaintReportingReader } from "../complaint/complaint-reporting.reader.js";
import type { DepartmentService } from "../department/department.service.js";
import { reportQuerySchema } from "./reporting.schemas.js";
import { ReportingService } from "./reporting.service.js";

const departmentId = "20000000-0000-4000-8000-000000000001";
const anotherDepartmentId = "20000000-0000-4000-8000-000000000002";
const categoryId = "30000000-0000-4000-8000-000000000001";

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

const citizenPrincipal: AuthPrincipal = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "citizen@example.com",
  role: "CITIZEN",
  tokenVersion: 0
};

const reportData = {
  summary: {
    total: 2,
    open: 1,
    awaitingInformation: 0,
    resolved: 1,
    closed: 0,
    rejected: 0,
    averageResolutionHours: 24,
    resolutionSampleSize: 1
  },
  byStatus: [{ key: "IN_PROGRESS" as const, count: 1 }, { key: "RESOLVED" as const, count: 1 }],
  byCategory: [{ id: categoryId, count: 2 }],
  byDepartment: [{ id: departmentId, count: 2 }],
  trend: [{ periodStart: "2026-11-01", eventType: "SUBMITTED" as const, count: 2 }],
  reassignments: {
    total: 1,
    pending: 1,
    approved: 0,
    rejected: 0,
    cancelled: 0,
    averageDecisionHours: null,
    decisionSampleSize: 0
  }
};

const departmentRecords = [
  { id: departmentId, code: "ENG", name: "Engineering", description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: anotherDepartmentId, code: "HEALTH", name: "Public Health", description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }
];
const categoryRecords = [
  { id: categoryId, code: "ROAD", name: "Road damage", description: null, isActive: true, createdAt: new Date(), updatedAt: new Date() }
];

const query = reportQuerySchema.parse({ from: "2026-11-01", to: "2026-11-30", bucket: "day" });

const services = () => {
  const read = vi.fn(async () => reportData);
  const reader = { read } as unknown as ComplaintReportingReader;
  const departments = {
    listDepartments: vi.fn(async () => departmentRecords),
    listCategories: vi.fn(async () => categoryRecords),
    requireActiveDepartmentForAccount: vi.fn(async () => departmentId)
  } as unknown as DepartmentService;
  return { read, service: new ReportingService(reader, departments) };
};

describe("reporting service", () => {
  it("denies Citizen access to operational reports", async () => {
    const { service } = services();

    await expect(service.overview(citizenPrincipal, query)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN"
    });
  });

  it("derives Department scope from the authenticated account", async () => {
    const { read, service } = services();
    const report = await service.overview(departmentPrincipal, query);

    expect(read).toHaveBeenCalledWith(
      { departmentId },
      expect.objectContaining({
        fromInclusive: new Date("2026-11-01T00:00:00.000Z"),
        toExclusive: new Date("2026-12-01T00:00:00.000Z")
      })
    );
    expect(report.scope).toEqual({ type: "DEPARTMENT", departmentId, label: "Engineering" });
    expect(report.byStatus).toHaveLength(7);
  });

  it("rejects a Department attempt to choose another department", async () => {
    const { service } = services();
    const filtered = reportQuerySchema.parse({
      from: "2026-11-01",
      to: "2026-11-30",
      departmentId: anotherDepartmentId
    });

    await expect(service.overview(departmentPrincipal, filtered)).rejects.toMatchObject({
      statusCode: 400,
      code: "DEPARTMENT_FILTER_NOT_ALLOWED"
    });
  });

  it("allows an Administrator to select a validated department scope", async () => {
    const { read, service } = services();
    const filtered = reportQuerySchema.parse({
      from: "2026-11-01",
      to: "2026-11-30",
      departmentId: anotherDepartmentId
    });

    const report = await service.overview(administratorPrincipal, filtered);

    expect(read).toHaveBeenCalledWith(
      { departmentId: anotherDepartmentId },
      expect.any(Object)
    );
    expect(report.scope.label).toBe("Public Health");
  });
});
