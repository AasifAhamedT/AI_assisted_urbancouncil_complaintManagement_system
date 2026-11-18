/// <reference types="node" />
import { createCanvas } from "@napi-rs/canvas";
import { writeFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OperationalReport } from "../api/types";
import { buildReportPdf } from "./report-pdf";

const report: OperationalReport = {
  scope: { type: "DEPARTMENT", departmentId: "department-a", label: "Road maintenance department" },
  period: { from: "2026-01-01", to: "2026-11-18", bucket: "day", timezone: "UTC", generatedAt: "2026-11-18T12:00:00Z" },
  filters: { status: null, categoryId: null, categoryLabel: null, departmentId: "department-a" },
  summary: { total: 9, open: 6, awaitingInformation: 1, resolved: 2, closed: 1, rejected: 0, averageResolutionHours: 28.5, resolutionSampleSize: 3 },
  byStatus: [{ key: "SUBMITTED", label: "Submitted", count: 6 }, { key: "RESOLVED", label: "Resolved", count: 2 }, { key: "CLOSED", label: "Closed", count: 1 }],
  byCategory: [{ id: "roads", label: "Road maintenance / வீதி பராமரிப்பு / මාර්ග නඩත්තුව", count: 9 }],
  byDepartment: [{ id: "department-a", label: "Road maintenance department", count: 9 }],
  trend: [{ periodStart: "2026-11-01", submitted: 9, resolved: 2, closed: 1 }],
  reassignments: { total: 1, pending: 0, approved: 1, rejected: 0, cancelled: 0, averageDecisionHours: 4, decisionSampleSize: 1 },
  filterOptions: { categories: [], departments: [{ id: "other", name: "Unrelated department", isActive: true }] }
};

const setupCanvas = () => {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  const draw = vi.spyOn(context, "fillText");
  vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, createElement: () => canvas });
  return draw;
};

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("report PDF export", () => {
  it("creates a PDF with scoped metrics, Unicode labels and no unrelated filter options", async () => {
    const draw = setupCanvas();
    const blob = await buildReportPdf(report);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const text = new TextDecoder("latin1").decode(bytes);
    expect(blob.type).toBe("application/pdf");
    expect(text.startsWith("%PDF-")).toBe(true);
    expect(text.match(/\/Type \/Page\b/g)?.length).toBeGreaterThan(1);
    const drawn = draw.mock.calls.map(call => call[0]).join("\n");
    expect(drawn).toContain("Road maintenance department");
    expect(drawn).toContain("வீதி");
    expect(drawn).toContain("මාර්ග");
    expect(drawn).toContain("28.5");
    expect(drawn).toContain("REASSIGNMENTS");
    expect(drawn).not.toContain("Unrelated department");
    // Optional local visual QA artifact; normal test runs create no files.
    if (process.env.PDF_TEST_OUTPUT) await writeFile(process.env.PDF_TEST_OUTPUT, bytes);
  });

  it("paginates a full year, repeats trend headers and keeps content above the footer", async () => {
    const draw = setupCanvas();
    const trend = Array.from({ length: 366 }, (_, i) => ({
      periodStart: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10), submitted: i, resolved: 0, closed: 0
    }));
    const blob = await buildReportPdf({ ...report, period: { ...report.period, from: "2024-01-01", to: "2024-12-31" }, trend });
    expect(blob.size).toBeGreaterThan(1000);
    const calls = draw.mock.calls;
    for (const item of trend) expect(calls.some(call => call[0] === item.periodStart)).toBe(true);
    expect(calls.filter(call => call[0] === "TREND: period start (UTC)").length).toBeGreaterThan(10);
    for (const [text, , y] of calls) {
      if (text.startsWith("Academic prototype") || text.startsWith("Page ")) continue;
      expect(y).toBeLessThan(794);
    }
  }, 15000);

  it("handles empty data and reports an unavailable canvas", async () => {
    const draw = setupCanvas();
    await buildReportPdf({ ...report, byStatus: [], byCategory: [], byDepartment: [], trend: [], summary: { ...report.summary, total: 0, averageResolutionHours: null } });
    expect(draw.mock.calls.some(call => call[0] === "Not available")).toBe(true);
    vi.stubGlobal("document", { fonts: { ready: Promise.resolve() }, createElement: () => ({ getContext: () => null }) });
    await expect(buildReportPdf(report)).rejects.toThrow("PDF rendering is unavailable");
  });
});
