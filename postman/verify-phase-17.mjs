// Read-only report reconciliation. Run `npm run build --workspace @sucms/api` first.
// Service-layer scope checks complement the separately recorded HTTP login/role tests.
import assert from "node:assert/strict";
import { databasePools, closeDatabasePools } from "../apps/api/dist/config/databases.js";
import { ReportingService } from "../apps/api/dist/modules/reporting/reporting.service.js";
import { reportQuerySchema } from "../apps/api/dist/modules/reporting/reporting.schemas.js";

const service = new ReportingService();
const from = "2026-01-01";
const to = "2026-11-16";
const start = new Date(`${from}T00:00:00Z`);
const end = new Date(`${to}T00:00:00Z`);
end.setUTCDate(end.getUTCDate() + 1);
const inPeriod = value => value && new Date(value) >= start && new Date(value) < end;
const mean = values => values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 100) / 100 : null;
const countGroups = (rows, key) => {
  const result = new Map();
  for (const row of rows) result.set(row[key], (result.get(row[key]) ?? 0) + 1);
  return result;
};
const sorted = entries => [...entries].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
const bucketStart = (value, bucket) => {
  const date = new Date(value);
  if (bucket === "week") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  if (bucket === "month") date.setUTCDate(1);
  return date.toISOString().slice(0, 10);
};

try {
  const [complaints] = await databasePools.complaint.query(
    "SELECT id, assigned_department_id AS departmentId, category_id AS categoryId, status, submitted_at AS submitted, created_at AS created, resolved_at AS resolved, closed_at AS closed FROM complaints"
  );
  const [requests] = await databasePools.complaint.query(
    "SELECT complaint_id AS complaintId, from_department_id AS departmentId, status, created_at AS created, decided_at AS decided FROM reassignment_requests"
  );
  const [mappings] = await databasePools.department.query(
    "SELECT m.user_id AS userId, m.department_id AS departmentId FROM department_account_mappings m JOIN departments d ON d.id = m.department_id WHERE m.is_active = TRUE AND d.is_active = TRUE"
  );
  assert.ok(mappings.length >= 2, "Need at least two active department mappings for isolation verification");
  const scenarios = [{ role: "ADMINISTRATOR", userId: "verification", departmentId: null }, ...mappings.map(m => ({ ...m, role: "DEPARTMENT" }))];
  let verified = 0;
  for (const scenario of scenarios) {
    const principal = { userId: scenario.userId, role: scenario.role, email: "verification@example.invalid", tokenVersion: 0 };
    for (const bucket of ["day", "week", "month"]) {
      const query = reportQuerySchema.parse({ from, to, bucket });
      const report = await service.overview(principal, query);
      const scoped = complaints.filter(c => !scenario.departmentId || c.departmentId === scenario.departmentId);
      const cohort = scoped.filter(c => inPeriod(c.submitted));
      assert.equal(report.summary.total, cohort.length);
      assert.equal(report.summary.open, cohort.filter(c => !["RESOLVED", "CLOSED", "REJECTED"].includes(c.status)).length);
      assert.equal(report.summary.awaitingInformation, cohort.filter(c => c.status === "AWAITING_INFORMATION").length);
      for (const key of ["resolved", "closed", "rejected"]) assert.equal(report.summary[key], cohort.filter(c => c.status === key.toUpperCase()).length);
      const durations = cohort.filter(c => c.resolved || c.closed).map(c => Math.trunc((new Date(c.resolved ?? c.closed) - new Date(c.submitted)) / 1000) / 3600);
      assert.equal(report.summary.resolutionSampleSize, durations.length);
      assert.equal(report.summary.averageResolutionHours, mean(durations));
      assert.deepEqual(sorted(report.byStatus.filter(x => x.count).map(x => [x.key, x.count])), sorted(countGroups(cohort, "status")));
      for (const [field, dimension] of [["byCategory", "categoryId"], ["byDepartment", "departmentId"]]) {
        assert.deepEqual(sorted(report[field].map(x => [x.id, x.count])), sorted(countGroups(cohort, dimension)));
      }
      for (const [metric, field] of [["submitted", "created"], ["resolved", "resolved"], ["closed", "closed"]]) {
        const expected = countGroups(scoped.filter(c => inPeriod(c[field])).map(c => ({ bucket: bucketStart(c[field], bucket) })), "bucket");
        assert.deepEqual(sorted(report.trend.filter(x => x[metric]).map(x => [x.periodStart, x[metric]])), sorted(expected));
      }
      const scopedRequests = requests.filter(r => inPeriod(r.created) && (!scenario.departmentId || r.departmentId === scenario.departmentId));
      assert.equal(report.reassignments.total, scopedRequests.length);
      for (const key of ["pending", "approved", "rejected", "cancelled"]) assert.equal(report.reassignments[key], scopedRequests.filter(r => r.status === key.toUpperCase()).length);
      const decisionTimes = scopedRequests.filter(r => r.decided).map(r => Math.trunc((new Date(r.decided) - new Date(r.created)) / 1000) / 3600);
      assert.equal(report.reassignments.decisionSampleSize, decisionTimes.length);
      assert.equal(report.reassignments.averageDecisionHours, mean(decisionTimes));
      if (scenario.role === "DEPARTMENT") {
        assert.equal(report.scope.departmentId, scenario.departmentId);
        assert.ok(report.byDepartment.every(x => x.id === scenario.departmentId));
        assert.deepEqual(report.filterOptions.departments, []);
      }
      verified++;
    }
    if (scenario.role === "DEPARTMENT") {
      const other = mappings.find(m => m.departmentId !== scenario.departmentId);
      assert.ok(other, "Need a different department");
      await assert.rejects(service.overview(principal, reportQuerySchema.parse({ from, to, departmentId: other.departmentId })), { code: "DEPARTMENT_FILTER_NOT_ALLOWED" });
    }
  }
  console.log(JSON.stringify({ result: "PASS", period: { from, to }, sourceComplaints: complaints.length, departmentAccountsChecked: mappings.length, reportsReconciled: verified, checks: ["totals", "status/category/department counts", "resolution durations", "daily/weekly/monthly event counts", "reassignment counts/durations", "department scope and override denial"] }));
} finally {
  await closeDatabasePools();
}
