import type { RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type { ComplaintStatus } from "./complaint.types.js";

export type ReportBucket = "day" | "week" | "month";

export interface ComplaintReportScope {
  departmentId: string | null;
}

export interface ComplaintReportFilters {
  fromInclusive: Date;
  toExclusive: Date;
  bucket: ReportBucket;
  categoryId?: string;
  status?: ComplaintStatus;
}

export interface ComplaintReportData {
  summary: {
    total: number;
    open: number;
    awaitingInformation: number;
    resolved: number;
    closed: number;
    rejected: number;
    averageResolutionHours: number | null;
    resolutionSampleSize: number;
  };
  byStatus: Array<{ key: ComplaintStatus; count: number }>;
  byCategory: Array<{ id: string | null; count: number }>;
  byDepartment: Array<{ id: string | null; count: number }>;
  trend: Array<{
    periodStart: string;
    eventType: "SUBMITTED" | "RESOLVED" | "CLOSED";
    count: number;
  }>;
  reassignments: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    cancelled: number;
    averageDecisionHours: number | null;
    decisionSampleSize: number;
  };
}

interface SummaryRow extends RowDataPacket {
  total: number | string;
  open: number | string | null;
  awaitingInformation: number | string | null;
  resolved: number | string | null;
  closed: number | string | null;
  rejected: number | string | null;
  averageResolutionHours: number | string | null;
  resolutionSampleSize: number | string;
}

interface GroupRow extends RowDataPacket {
  groupKey: string | null;
  count: number | string;
}

interface TrendRow extends RowDataPacket {
  periodStart: string;
  eventType: "SUBMITTED" | "RESOLVED" | "CLOSED";
  count: number | string;
}

interface ReassignmentSummaryRow extends RowDataPacket {
  total: number | string;
  pending: number | string | null;
  approved: number | string | null;
  rejected: number | string | null;
  cancelled: number | string | null;
  averageDecisionHours: number | string | null;
  decisionSampleSize: number | string;
}

const toNumber = (value: number | string | null | undefined): number => Number(value ?? 0);
const toOptionalNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

export class ComplaintReportingReader {
  private readonly pool = databasePools.complaint;

  async read(scope: ComplaintReportScope, filters: ComplaintReportFilters): Promise<ComplaintReportData> {
    const complaintWhere = this.complaintWhere(scope, filters, "c");
    const reassignmentWhere = this.reassignmentWhere(scope, filters);
    const trendBucket = this.trendBucketExpression(filters.bucket);
    const periodValues = [filters.fromInclusive, filters.toExclusive];

    const [summaryResult, statusResult, categoryResult, departmentResult, trendResult, reassignmentResult] =
      await Promise.all([
        this.pool.execute<SummaryRow[]>(
          `SELECT COUNT(*) AS total,
                  COALESCE(SUM(c.status IN ('SUBMITTED', 'UNDER_REVIEW', 'AWAITING_INFORMATION', 'IN_PROGRESS')), 0) AS open,
                  COALESCE(SUM(c.status = 'AWAITING_INFORMATION'), 0) AS awaitingInformation,
                  COALESCE(SUM(c.status = 'RESOLVED'), 0) AS resolved,
                  COALESCE(SUM(c.status = 'CLOSED'), 0) AS closed,
                  COALESCE(SUM(c.status = 'REJECTED'), 0) AS rejected,
                  ROUND(AVG(CASE
                    WHEN COALESCE(c.resolved_at, c.closed_at) IS NOT NULL
                    THEN TIMESTAMPDIFF(SECOND, c.submitted_at, COALESCE(c.resolved_at, c.closed_at)) / 3600
                  END), 2) AS averageResolutionHours,
                  COUNT(CASE WHEN COALESCE(c.resolved_at, c.closed_at) IS NOT NULL THEN 1 END) AS resolutionSampleSize
           FROM complaints AS c
           WHERE c.submitted_at >= ? AND c.submitted_at < ? AND ${complaintWhere.sql}`,
          [...periodValues, ...complaintWhere.values]
        ),
        this.pool.execute<GroupRow[]>(
          `SELECT c.status AS groupKey, COUNT(*) AS count
           FROM complaints AS c
           WHERE c.submitted_at >= ? AND c.submitted_at < ? AND ${complaintWhere.sql}
           GROUP BY c.status`,
          [...periodValues, ...complaintWhere.values]
        ),
        this.pool.execute<GroupRow[]>(
          `SELECT c.category_id AS groupKey, COUNT(*) AS count
           FROM complaints AS c
           WHERE c.submitted_at >= ? AND c.submitted_at < ? AND ${complaintWhere.sql}
           GROUP BY c.category_id ORDER BY count DESC`,
          [...periodValues, ...complaintWhere.values]
        ),
        this.pool.execute<GroupRow[]>(
          `SELECT c.assigned_department_id AS groupKey, COUNT(*) AS count
           FROM complaints AS c
           WHERE c.submitted_at >= ? AND c.submitted_at < ? AND ${complaintWhere.sql}
           GROUP BY c.assigned_department_id ORDER BY count DESC`,
          [...periodValues, ...complaintWhere.values]
        ),
        this.pool.execute<TrendRow[]>(
          `SELECT ${trendBucket} AS periodStart, events.eventType, COUNT(*) AS count
           FROM (
             SELECT c.created_at AS eventAt, 'SUBMITTED' AS eventType,
                    c.category_id AS categoryId, c.assigned_department_id AS departmentId,
                    c.status AS currentStatus
             FROM complaints AS c
             UNION ALL
             SELECT c.resolved_at AS eventAt, 'RESOLVED' AS eventType,
                    c.category_id AS categoryId, c.assigned_department_id AS departmentId,
                    c.status AS currentStatus
             FROM complaints AS c WHERE c.resolved_at IS NOT NULL
             UNION ALL
             SELECT c.closed_at AS eventAt, 'CLOSED' AS eventType,
                    c.category_id AS categoryId, c.assigned_department_id AS departmentId,
                    c.status AS currentStatus
             FROM complaints AS c WHERE c.closed_at IS NOT NULL
           ) AS events
           WHERE events.eventAt >= ? AND events.eventAt < ? AND ${this.trendWhere(scope, filters).sql}
           GROUP BY periodStart, events.eventType ORDER BY periodStart`,
          [...periodValues, ...this.trendWhere(scope, filters).values]
        ),
        this.pool.execute<ReassignmentSummaryRow[]>(
          `SELECT COUNT(*) AS total,
                  COALESCE(SUM(r.status = 'PENDING'), 0) AS pending,
                  COALESCE(SUM(r.status = 'APPROVED'), 0) AS approved,
                  COALESCE(SUM(r.status = 'REJECTED'), 0) AS rejected,
                  COALESCE(SUM(r.status = 'CANCELLED'), 0) AS cancelled,
                  ROUND(AVG(CASE WHEN r.decided_at IS NOT NULL
                    THEN TIMESTAMPDIFF(SECOND, r.created_at, r.decided_at) / 3600 END), 2) AS averageDecisionHours,
                  COUNT(CASE WHEN r.decided_at IS NOT NULL THEN 1 END) AS decisionSampleSize
           FROM reassignment_requests AS r
           INNER JOIN complaints AS c ON c.id = r.complaint_id
           WHERE r.created_at >= ? AND r.created_at < ? AND ${reassignmentWhere.sql}`,
          [...periodValues, ...reassignmentWhere.values]
        )
      ]);

    const summary = summaryResult[0][0]!;
    const reassignment = reassignmentResult[0][0]!;
    return {
      summary: {
        total: toNumber(summary.total),
        open: toNumber(summary.open),
        awaitingInformation: toNumber(summary.awaitingInformation),
        resolved: toNumber(summary.resolved),
        closed: toNumber(summary.closed),
        rejected: toNumber(summary.rejected),
        averageResolutionHours: toOptionalNumber(summary.averageResolutionHours),
        resolutionSampleSize: toNumber(summary.resolutionSampleSize)
      },
      byStatus: statusResult[0].map((row) => ({
        key: row.groupKey as ComplaintStatus,
        count: toNumber(row.count)
      })),
      byCategory: categoryResult[0].map((row) => ({ id: row.groupKey, count: toNumber(row.count) })),
      byDepartment: departmentResult[0].map((row) => ({ id: row.groupKey, count: toNumber(row.count) })),
      trend: trendResult[0].map((row) => ({ ...row, count: toNumber(row.count) })),
      reassignments: {
        total: toNumber(reassignment.total),
        pending: toNumber(reassignment.pending),
        approved: toNumber(reassignment.approved),
        rejected: toNumber(reassignment.rejected),
        cancelled: toNumber(reassignment.cancelled),
        averageDecisionHours: toOptionalNumber(reassignment.averageDecisionHours),
        decisionSampleSize: toNumber(reassignment.decisionSampleSize)
      }
    };
  }

  private complaintWhere(
    scope: ComplaintReportScope,
    filters: ComplaintReportFilters,
    alias: string
  ): { sql: string; values: string[] } {
    const conditions = ["1 = 1"];
    const values: string[] = [];
    if (scope.departmentId) {
      conditions.push(`${alias}.assigned_department_id = ?`);
      values.push(scope.departmentId);
    }
    if (filters.categoryId) {
      conditions.push(`${alias}.category_id = ?`);
      values.push(filters.categoryId);
    }
    if (filters.status) {
      conditions.push(`${alias}.status = ?`);
      values.push(filters.status);
    }
    return { sql: conditions.join(" AND "), values };
  }

  private trendWhere(
    scope: ComplaintReportScope,
    filters: ComplaintReportFilters
  ): { sql: string; values: string[] } {
    const conditions = ["1 = 1"];
    const values: string[] = [];
    if (scope.departmentId) {
      conditions.push("events.departmentId = ?");
      values.push(scope.departmentId);
    }
    if (filters.categoryId) {
      conditions.push("events.categoryId = ?");
      values.push(filters.categoryId);
    }
    if (filters.status) {
      conditions.push("events.currentStatus = ?");
      values.push(filters.status);
    }
    return { sql: conditions.join(" AND "), values };
  }

  private reassignmentWhere(
    scope: ComplaintReportScope,
    filters: ComplaintReportFilters
  ): { sql: string; values: string[] } {
    const conditions = ["1 = 1"];
    const values: string[] = [];
    if (scope.departmentId) {
      conditions.push("r.from_department_id = ?");
      values.push(scope.departmentId);
    }
    if (filters.categoryId) {
      conditions.push("c.category_id = ?");
      values.push(filters.categoryId);
    }
    if (filters.status) {
      conditions.push("c.status = ?");
      values.push(filters.status);
    }
    return { sql: conditions.join(" AND "), values };
  }

  private trendBucketExpression(bucket: ReportBucket): string {
    if (bucket === "month") return "DATE_FORMAT(events.eventAt, '%Y-%m-01')";
    if (bucket === "week") {
      return "DATE_FORMAT(DATE_SUB(DATE(events.eventAt), INTERVAL WEEKDAY(events.eventAt) DAY), '%Y-%m-%d')";
    }
    return "DATE_FORMAT(events.eventAt, '%Y-%m-%d')";
  }
}
