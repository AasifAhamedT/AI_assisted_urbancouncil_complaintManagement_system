import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type {
  CreateReassignmentResult,
  DecideReassignmentResult,
  ReassignmentAccessScope,
  ReassignmentListOptions,
  ReassignmentRequestRecord
} from "./reassignment.types.js";

interface ReassignmentRow extends RowDataPacket, ReassignmentRequestRecord {}
interface CountRow extends RowDataPacket { total: number }
interface ComplaintLockRow extends RowDataPacket {
  id: string;
  assignedDepartmentId: string | null;
  status: string;
  classificationReviewRequired: boolean | number;
}

const requestColumns = `
  r.id, r.complaint_id AS complaintId, c.reference_number AS complaintReference,
  r.requested_by_user_id AS requestedByUserId,
  r.from_department_id AS fromDepartmentId,
  r.suggested_department_id AS suggestedDepartmentId,
  r.approved_department_id AS approvedDepartmentId,
  r.reason, r.status, r.decided_by_user_id AS decidedByUserId,
  r.decision_reason AS decisionReason, r.created_at AS createdAt,
  r.decided_at AS decidedAt`;

const scopeCondition = (scope: ReassignmentAccessScope) => scope.kind === "DEPARTMENT"
  ? { sql: "r.from_department_id = ?", values: [scope.departmentId] }
  : { sql: "1 = 1", values: [] as string[] };

export class ReassignmentRepository {
  private readonly pool = databasePools.complaint;

  async createPending(input: {
    id: string;
    complaintId: string;
    actorUserId: string;
    departmentId: string;
    reason: string;
  }): Promise<CreateReassignmentResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const complaint = await this.lockComplaint(connection, input.complaintId);
      if (!complaint) return await this.rollbackWith(connection, "COMPLAINT_NOT_FOUND");
      if (complaint.assignedDepartmentId !== input.departmentId) {
        return await this.rollbackWith(connection, "ASSIGNMENT_CHANGED");
      }
      if (Boolean(complaint.classificationReviewRequired)) {
        return await this.rollbackWith(connection, "CLASSIFICATION_REVIEW_REQUIRED");
      }
      if (complaint.status === "CLOSED") {
        return await this.rollbackWith(connection, "COMPLAINT_CLOSED");
      }
      try {
        await connection.execute(
          `INSERT INTO reassignment_requests
            (id, complaint_id, requested_by_user_id, from_department_id, reason, status)
           VALUES (?, ?, ?, ?, ?, 'PENDING')`,
          [input.id, input.complaintId, input.actorUserId, input.departmentId, input.reason]
        );
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
          return await this.rollbackWith(connection, "PENDING_EXISTS");
        }
        throw error;
      }
      await connection.commit();
      return "CREATED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async list(
    scope: ReassignmentAccessScope,
    options: ReassignmentListOptions
  ): Promise<{ items: ReassignmentRequestRecord[]; total: number }> {
    const scoped = scopeCondition(scope);
    const conditions = [scoped.sql];
    const values: Array<string | number> = [...scoped.values];
    if (options.status) {
      conditions.push("r.status = ?");
      values.push(options.status);
    }
    const where = conditions.join(" AND ");
    const [countRows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM reassignment_requests AS r WHERE ${where}`,
      values
    );
    const [rows] = await this.pool.execute<ReassignmentRow[]>(
      `SELECT ${requestColumns}
       FROM reassignment_requests AS r
       INNER JOIN complaints AS c ON c.id = r.complaint_id
       WHERE ${where}
       ORDER BY CASE WHEN r.status = 'PENDING' THEN 0 ELSE 1 END,
                r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...values, options.pageSize, (options.page - 1) * options.pageSize]
    );
    return { items: rows, total: Number(countRows[0]?.total ?? 0) };
  }

  async findById(
    id: string,
    scope: ReassignmentAccessScope = { kind: "ADMINISTRATOR" }
  ): Promise<ReassignmentRequestRecord | null> {
    const scoped = scopeCondition(scope);
    const [rows] = await this.pool.execute<ReassignmentRow[]>(
      `SELECT ${requestColumns}
       FROM reassignment_requests AS r
       INNER JOIN complaints AS c ON c.id = r.complaint_id
       WHERE r.id = ? AND ${scoped.sql} LIMIT 1`,
      [id, ...scoped.values]
    );
    return rows[0] ?? null;
  }

  async decide(input: {
    requestId: string;
    actorUserId: string;
    decision: "APPROVED" | "REJECTED";
    targetDepartmentId: string | null;
    decisionReason: string;
    assignmentHistoryId: string;
  }): Promise<DecideReassignmentResult> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [requestRows] = await connection.execute<ReassignmentRow[]>(
        `SELECT ${requestColumns}
         FROM reassignment_requests AS r
         INNER JOIN complaints AS c ON c.id = r.complaint_id
         WHERE r.id = ? FOR UPDATE`,
        [input.requestId]
      );
      const request = requestRows[0];
      if (!request) return await this.rollbackWith(connection, "REQUEST_NOT_FOUND");
      if (request.status !== "PENDING") {
        return await this.rollbackWith(connection, "REQUEST_ALREADY_DECIDED");
      }
      if (input.decision === "REJECTED") {
        await connection.execute(
          `UPDATE reassignment_requests
           SET status = 'REJECTED', decided_by_user_id = ?, decision_reason = ?,
               decided_at = CURRENT_TIMESTAMP(3)
           WHERE id = ? AND status = 'PENDING'`,
          [input.actorUserId, input.decisionReason, input.requestId]
        );
        await connection.commit();
        return "DECIDED";
      }

      const complaint = await this.lockComplaint(connection, request.complaintId);
      if (!complaint) return await this.rollbackWith(connection, "COMPLAINT_NOT_FOUND");
      if (complaint.assignedDepartmentId !== request.fromDepartmentId) {
        return await this.rollbackWith(connection, "ASSIGNMENT_CHANGED");
      }
      if (!input.targetDepartmentId || input.targetDepartmentId === request.fromDepartmentId) {
        return await this.rollbackWith(connection, "SAME_DEPARTMENT");
      }
      const [complaintUpdate] = await connection.execute<ResultSetHeader>(
        `UPDATE complaints
         SET assigned_department_id = ?, version = version + 1
         WHERE id = ? AND assigned_department_id = ?`,
        [input.targetDepartmentId, request.complaintId, request.fromDepartmentId]
      );
      if (complaintUpdate.affectedRows !== 1) {
        return await this.rollbackWith(connection, "ASSIGNMENT_CHANGED");
      }
      await connection.execute(
        `UPDATE reassignment_requests
         SET status = 'APPROVED', approved_department_id = ?,
             decided_by_user_id = ?, decision_reason = ?, decided_at = CURRENT_TIMESTAMP(3)
         WHERE id = ? AND status = 'PENDING'`,
        [input.targetDepartmentId, input.actorUserId, input.decisionReason, input.requestId]
      );
      await connection.execute(
        `INSERT INTO assignment_history
          (id, complaint_id, previous_department_id, new_department_id,
           changed_by_user_id, source, reason)
         VALUES (?, ?, ?, ?, ?, 'REASSIGNMENT_APPROVAL', ?)`,
        [
          input.assignmentHistoryId,
          request.complaintId,
          request.fromDepartmentId,
          input.targetDepartmentId,
          input.actorUserId,
          input.decisionReason
        ]
      );
      await connection.commit();
      return "DECIDED";
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async lockComplaint(
    connection: PoolConnection,
    complaintId: string
  ): Promise<ComplaintLockRow | null> {
    const [rows] = await connection.execute<ComplaintLockRow[]>(
      `SELECT id, assigned_department_id AS assignedDepartmentId, status,
              classification_review_required AS classificationReviewRequired
       FROM complaints WHERE id = ? FOR UPDATE`,
      [complaintId]
    );
    return rows[0] ?? null;
  }

  private async rollbackWith<T extends CreateReassignmentResult | DecideReassignmentResult>(
    connection: PoolConnection,
    result: T
  ): Promise<T> {
    await connection.rollback();
    return result;
  }
}
