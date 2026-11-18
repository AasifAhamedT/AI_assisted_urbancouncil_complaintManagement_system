import { AppError } from "../../common/app-error.js";
import type { AuthPrincipal } from "../auth/auth.types.js";
import {
  ComplaintReportingReader,
  type ComplaintReportScope
} from "../complaint/complaint-reporting.reader.js";
import { complaintStatuses } from "../complaint/complaint.types.js";
import { DepartmentService } from "../department/department.service.js";
import type { ReportQuery } from "./reporting.schemas.js";

const humanize = (value: string) => value.toLowerCase().replaceAll("_", " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

export class ReportingService {
  constructor(
    private readonly reader = new ComplaintReportingReader(),
    private readonly departments = new DepartmentService()
  ) {}

  async overview(principal: AuthPrincipal, query: ReportQuery) {
    if (principal.role === "CITIZEN") {
      throw new AppError(403, "FORBIDDEN", "Citizens cannot access operational reports.");
    }

    const [departments, categories] = await Promise.all([
      this.departments.listDepartments(),
      this.departments.listCategories()
    ]);
    const category = query.categoryId
      ? categories.find((item) => item.id === query.categoryId)
      : null;
    if (query.categoryId && !category) {
      throw new AppError(400, "INVALID_REPORT_FILTER", "The selected report category does not exist.");
    }

    let scope: ComplaintReportScope;
    let scopeLabel: string;
    if (principal.role === "DEPARTMENT") {
      if (query.departmentId) {
        throw new AppError(
          400,
          "DEPARTMENT_FILTER_NOT_ALLOWED",
          "Department Accounts cannot select a department report scope."
        );
      }
      const departmentId = await this.departments.requireActiveDepartmentForAccount(principal.userId);
      const department = departments.find((item) => item.id === departmentId);
      scope = { departmentId };
      scopeLabel = department?.name ?? "Assigned department";
    } else {
      const selectedDepartment = query.departmentId
        ? departments.find((item) => item.id === query.departmentId)
        : null;
      if (query.departmentId && !selectedDepartment) {
        throw new AppError(400, "INVALID_REPORT_FILTER", "The selected report department does not exist.");
      }
      scope = { departmentId: selectedDepartment?.id ?? null };
      scopeLabel = selectedDepartment?.name ?? "All departments";
    }

    const fromInclusive = new Date(`${query.from}T00:00:00.000Z`);
    const toExclusive = new Date(`${query.to}T00:00:00.000Z`);
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    const data = await this.reader.read(scope, {
      fromInclusive,
      toExclusive,
      bucket: query.bucket,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.status ? { status: query.status } : {})
    });

    const statusCounts = new Map(data.byStatus.map((item) => [item.key, item.count]));
    const categoriesById = new Map(categories.map((item) => [item.id, item.name]));
    const departmentsById = new Map(departments.map((item) => [item.id, item.name]));
    const trend = this.fillTrend(query.from, query.to, query.bucket, data.trend);

    return {
      scope: {
        type: principal.role === "DEPARTMENT" ? "DEPARTMENT" as const : "SYSTEM" as const,
        departmentId: scope.departmentId,
        label: scopeLabel
      },
      period: {
        from: query.from,
        to: query.to,
        bucket: query.bucket,
        timezone: "UTC",
        generatedAt: new Date().toISOString()
      },
      filters: {
        status: query.status ?? null,
        categoryId: query.categoryId ?? null,
        categoryLabel: category?.name ?? null,
        departmentId: scope.departmentId
      },
      summary: data.summary,
      byStatus: complaintStatuses.map((key) => ({
        key,
        label: humanize(key),
        count: statusCounts.get(key) ?? 0
      })),
      byCategory: data.byCategory.map((item) => ({
        ...item,
        label: item.id ? (categoriesById.get(item.id) ?? "Unknown category") : "Unclassified"
      })),
      byDepartment: data.byDepartment.map((item) => ({
        ...item,
        label: item.id ? (departmentsById.get(item.id) ?? "Unknown department") : "Unassigned"
      })),
      trend,
      reassignments: data.reassignments,
      filterOptions: {
        categories: categories.map(({ id, name, isActive }) => ({ id, name, isActive })),
        departments: principal.role === "ADMINISTRATOR"
          ? departments.map(({ id, name, isActive }) => ({ id, name, isActive }))
          : []
      }
    };
  }

  private fillTrend(
    from: string,
    to: string,
    bucket: ReportQuery["bucket"],
    events: Array<{ periodStart: string; eventType: "SUBMITTED" | "RESOLVED" | "CLOSED"; count: number }>
  ) {
    const grouped = new Map<string, { submitted: number; resolved: number; closed: number }>();
    for (const event of events) {
      const counts = grouped.get(event.periodStart) ?? { submitted: 0, resolved: 0, closed: 0 };
      if (event.eventType === "SUBMITTED") counts.submitted = event.count;
      if (event.eventType === "RESOLVED") counts.resolved = event.count;
      if (event.eventType === "CLOSED") counts.closed = event.count;
      grouped.set(event.periodStart, counts);
    }

    const cursor = new Date(`${from}T00:00:00.000Z`);
    const end = new Date(`${to}T00:00:00.000Z`);
    if (bucket === "week") cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() + 6) % 7));
    if (bucket === "month") cursor.setUTCDate(1);
    const result = [];
    while (cursor <= end) {
      const periodStart = cursor.toISOString().slice(0, 10);
      result.push({ periodStart, ...(grouped.get(periodStart) ?? { submitted: 0, resolved: 0, closed: 0 }) });
      if (bucket === "month") cursor.setUTCMonth(cursor.getUTCMonth() + 1);
      else cursor.setUTCDate(cursor.getUTCDate() + (bucket === "week" ? 7 : 1));
    }
    return result;
  }
}
