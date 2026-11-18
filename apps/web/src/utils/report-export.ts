import type { OperationalReport } from "../api/types";

// Quote every cell and neutralize spreadsheet formulas in configurable labels.
export const csvCell = (value: string | number | null): string => {
  let text = value === null ? "Not available" : String(value);
  if (typeof value === "string" && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};

export const reportRows = (report: OperationalReport): Array<Array<string | number | null>> => {
  const rows: Array<Array<string | number | null>> = [];
  const add = (...values: Array<string | number | null>) => { rows.push(values); };
  add("Smart Urban Council Complaint Management System", "Operational report");
  add("Scope", report.scope.label);
  add("Access scope", report.scope.type);
  add("From (inclusive)", report.period.from);
  add("To (inclusive)", report.period.to);
  add("Period timezone", report.period.timezone);
  add("Interval", report.period.bucket);
  add("Generated at", report.period.generatedAt);
  add("Status filter", report.filters.status ?? "All statuses");
  add("Category filter", report.filters.categoryLabel ?? "All categories");
  add("Department filter", report.scope.label);
  add("Metric definitions", "Totals use submissions within the period and current status/assignment. Trends use each event date. Resolution duration prefers resolved time, falling back to closed time. Reassignments use request creation date and originating department.");
  add();
  add("SUMMARY", "Value");
  add("Submitted complaints", report.summary.total);
  add("Open workload", report.summary.open);
  add("Awaiting information", report.summary.awaitingInformation);
  add("Resolved", report.summary.resolved);
  add("Closed", report.summary.closed);
  add("Rejected", report.summary.rejected);
  add("Average resolution (hours)", report.summary.averageResolutionHours);
  add("Resolution sample size", report.summary.resolutionSampleSize);
  for (const [title, items] of [
    ["BY STATUS", report.byStatus],
    ["BY CATEGORY", report.byCategory],
    ["BY DEPARTMENT", report.byDepartment]
  ] as const) {
    add();
    add(title, "Count");
    for (const item of items) add(item.label, item.count);
  }
  add();
  add("TREND: period start (UTC)", "Submitted", "Resolved", "Closed");
  for (const item of report.trend) add(item.periodStart, item.submitted, item.resolved, item.closed);
  add();
  add("REASSIGNMENTS", "Value");
  add("Requests", report.reassignments.total);
  add("Pending", report.reassignments.pending);
  add("Approved", report.reassignments.approved);
  add("Rejected", report.reassignments.rejected);
  add("Cancelled", report.reassignments.cancelled);
  add("Average decision (hours)", report.reassignments.averageDecisionHours);
  add("Decision sample size", report.reassignments.decisionSampleSize);
  return rows;
};

export const reportCsv = (report: OperationalReport): string => {
  const rows = reportRows(report);
  // UTF-8 BOM makes non-English category/department labels readable in Excel.
  return "\uFEFF" + rows.map(row => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
};

export const saveReportBlob = (report: OperationalReport, blob: Blob, extension: "csv" | "pdf"): void => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `council-report-${report.scope.departmentId ? "department" : "system"}-${report.period.from}-${report.period.to}.${extension}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
};

export const downloadReport = (report: OperationalReport): void => {
  saveReportBlob(report, new Blob([reportCsv(report)], { type: "text/csv;charset=utf-8" }), "csv");
};
