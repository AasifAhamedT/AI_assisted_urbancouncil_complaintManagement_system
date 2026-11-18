import { describe, expect, it } from "vitest";
import type { OperationalReport } from "../api/types";
import { csvCell, reportCsv } from "./report-export";

const report: OperationalReport = {
  scope: { type: "DEPARTMENT", departmentId: "department-a", label: "Department A" },
  period: { from: "2026-11-01", to: "2026-11-16", bucket: "day", timezone: "UTC", generatedAt: "2026-11-16T10:00:00Z" },
  filters: { status: "SUBMITTED", categoryId: "category-a", categoryLabel: "Roads", departmentId: "department-a" },
  summary: { total: 2, open: 2, awaitingInformation: 0, resolved: 0, closed: 0, rejected: 0, averageResolutionHours: null, resolutionSampleSize: 0 },
  byStatus: [{ key: "SUBMITTED", label: "Submitted", count: 2 }],
  byCategory: [{ id: "category-a", label: "Roads", count: 2 }],
  byDepartment: [{ id: "department-a", label: "Department A", count: 2 }],
  trend: [{ periodStart: "2026-11-01", submitted: 2, resolved: 0, closed: 0 }],
  reassignments: { total: 1, pending: 0, approved: 0, rejected: 0, cancelled: 1, averageDecisionHours: null, decisionSampleSize: 0 },
  filterOptions: { categories: [], departments: [{ id: "b", name: "Unrelated department", isActive: true }] }
};

describe("report CSV export", () => {
  it("quotes commas, quotes, newlines and preserves Unicode", () => {
    expect(csvCell('தமிழ், "Roads"\nNext')).toBe('"தமிழ், ""Roads""\nNext"');
  });
  it("neutralizes formulas even after whitespace or control characters", () => {
    for (const text of ["=1+1", "+CMD", "@SUM(A1)", "-1+1", " \t=1+1", "\r=1+1"]) {
      expect(csvCell(text)).toBe(`"'${text}"`);
    }
    expect(csvCell(2)).toBe('"2"');
  });
  it("exports applied metadata and metrics without unrelated filter options", () => {
    const csv = reportCsv(report);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Status filter","SUBMITTED"');
    expect(csv).toContain('"From (inclusive)","2026-11-01"');
    expect(csv).toContain('"Submitted complaints","2"');
    expect(csv).toContain('"Cancelled","1"');
    expect(csv).toContain('"Average resolution (hours)","Not available"');
    expect(csv).not.toContain("Unrelated department");
  });
  it("exports an empty report without inventing values", () => {
    const csv = reportCsv({ ...report, summary: { ...report.summary, total: 0, open: 0 }, byCategory: [], byDepartment: [], byStatus: [], trend: [] });
    expect(csv).toContain('"Submitted complaints","0"');
    expect(csv).toContain('"TREND: period start (UTC)","Submitted","Resolved","Closed"');
  });
});
