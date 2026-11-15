import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type {
  Complaint,
  ComplaintAccessScope,
  ComplaintAttachment,
  ComplaintHistoryEntry,
  ComplaintListOptions,
  MapComplaintSummary,
  ComplaintStatus
} from "./complaint.types.js";

interface ComplaintRow extends RowDataPacket, Complaint {}
interface HistoryRow extends RowDataPacket, ComplaintHistoryEntry {}
interface AttachmentRow extends RowDataPacket, ComplaintAttachment {}
interface CountRow extends RowDataPacket { total: number }
interface MapComplaintRow extends RowDataPacket, MapComplaintSummary {}

const complaintColumns = `
  id, reference_number AS referenceNumber, citizen_user_id AS citizenUserId,
  category_id AS categoryId, assigned_department_id AS assignedDepartmentId,
  title, description, priority, status, classification_state AS classificationState,
  classification_review_required AS classificationReviewRequired, version,
  submitted_at AS submittedAt, resolved_at AS resolvedAt, closed_at AS closedAt,
  created_at AS createdAt, updated_at AS updatedAt`;

const mapComplaint = (row: ComplaintRow): Complaint => ({
  ...row,
  classificationReviewRequired: Boolean(row.classificationReviewRequired)
});

const scopeCondition = (scope: ComplaintAccessScope): { sql: string; values: string[] } => {
  if (scope.kind === "CITIZEN") {
    return { sql: "citizen_user_id = ?", values: [scope.userId] };
  }
  if (scope.kind === "DEPARTMENT") {
    return { sql: "assigned_department_id = ?", values: [scope.departmentId] };
  }
  return { sql: "1 = 1", values: [] };
};

export class ComplaintRepository {
  private readonly pool = databasePools.complaint;

  async createComplaint(input: {
    complaint: Complaint;
    historyId: string;
    assignmentHistoryId?: string;
  }): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `INSERT INTO complaints
          (id, reference_number, citizen_user_id, category_id, assigned_department_id,
           title, description, priority, status, classification_state,
           classification_review_required, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.complaint.id,
          input.complaint.referenceNumber,
          input.complaint.citizenUserId,
          input.complaint.categoryId,
          input.complaint.assignedDepartmentId,
          input.complaint.title,
          input.complaint.description,
          input.complaint.priority,
          input.complaint.status,
          input.complaint.classificationState,
          input.complaint.classificationReviewRequired,
          input.complaint.version
        ]
      );
      await connection.execute(
        `INSERT INTO complaint_status_history
          (id, complaint_id, previous_status, new_status, changed_by_user_id, reason)
         VALUES (?, ?, NULL, 'SUBMITTED', ?, NULL)`,
        [input.historyId, input.complaint.id, input.complaint.citizenUserId]
      );
      if (input.complaint.assignedDepartmentId && input.assignmentHistoryId) {
        await connection.execute(
          `INSERT INTO assignment_history
            (id, complaint_id, previous_department_id, new_department_id,
             changed_by_user_id, source, reason)
           VALUES (?, ?, NULL, ?, ?, 'INITIAL_ROUTING', ?)`,
          [
            input.assignmentHistoryId,
            input.complaint.id,
            input.complaint.assignedDepartmentId,
            input.complaint.citizenUserId,
            "Assigned from the active category routing configuration."
          ]
        );
      }
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
        return false;
      }
      throw error;
    } finally {
      connection.release();
    }
  }

  async findComplaint(id: string, scope: ComplaintAccessScope): Promise<Complaint | null> {
    const scoped = scopeCondition(scope);
    const [rows] = await this.pool.execute<ComplaintRow[]>(
      `SELECT ${complaintColumns} FROM complaints
       WHERE id = ? AND ${scoped.sql} LIMIT 1`,
      [id, ...scoped.values]
    );
    return rows[0] ? mapComplaint(rows[0]) : null;
  }

  async listComplaints(scope: ComplaintAccessScope, options: ComplaintListOptions): Promise<{
    items: Complaint[];
    total: number;
  }> {
    const scoped = scopeCondition(scope);
    const conditions = [scoped.sql];
    const values: Array<string | number> = [...scoped.values];
    if (options.search) {
      conditions.push("(reference_number LIKE ? OR title LIKE ? OR description LIKE ?)");
      const pattern = `%${options.search}%`;
      values.push(pattern, pattern, pattern);
    }
    if (options.status) {
      conditions.push("status = ?");
      values.push(options.status);
    }
    if (options.priority) {
      conditions.push("priority = ?");
      values.push(options.priority);
    }
    if (options.categoryId) {
      conditions.push("category_id = ?");
      values.push(options.categoryId);
    }
    const where = conditions.join(" AND ");
    const [countRows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM complaints WHERE ${where}`,
      values
    );
    const sortColumns = {
      createdAt: "created_at",
      updatedAt: "updated_at",
      referenceNumber: "reference_number",
      status: "status",
      priority: "priority"
    } as const;
    const direction = options.sortOrder === "asc" ? "ASC" : "DESC";
    const offset = (options.page - 1) * options.pageSize;
    const [rows] = await this.pool.execute<ComplaintRow[]>(
      `SELECT ${complaintColumns} FROM complaints
       WHERE ${where}
       ORDER BY ${sortColumns[options.sortBy]} ${direction}, id ${direction}
       LIMIT ? OFFSET ?`,
      [...values, options.pageSize, offset]
    );
    return { items: rows.map(mapComplaint), total: Number(countRows[0]?.total ?? 0) };
  }

  async listMapComplaintSummaries(
    scope: ComplaintAccessScope,
    filters: { status?: ComplaintStatus; categoryId?: string }
  ): Promise<MapComplaintSummary[]> {
    const scoped = scopeCondition(scope);
    const conditions = [scoped.sql];
    const values: string[] = [...scoped.values];
    if (filters.status) {
      conditions.push("status = ?");
      values.push(filters.status);
    }
    if (filters.categoryId) {
      conditions.push("category_id = ?");
      values.push(filters.categoryId);
    }
    const [rows] = await this.pool.execute<MapComplaintRow[]>(
      `SELECT id, reference_number AS referenceNumber, title, status,
              category_id AS categoryId, assigned_department_id AS assignedDepartmentId
       FROM complaints
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT 5000`,
      values
    );
    return rows;
  }

  async updateCitizenContent(input: {
    id: string;
    citizenUserId: string;
    title: string;
    description: string;
    version: number;
  }): Promise<boolean> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE complaints
       SET title = ?, description = ?, version = version + 1
       WHERE id = ? AND citizen_user_id = ? AND status = 'SUBMITTED' AND version = ?`,
      [input.title, input.description, input.id, input.citizenUserId, input.version]
    );
    return result.affectedRows === 1;
  }

  async updateStatus(input: {
    id: string;
    previousStatus: ComplaintStatus;
    newStatus: ComplaintStatus;
    actorUserId: string;
    reason: string | null;
    version: number;
    historyId: string;
  }): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE complaints
         SET status = ?, version = version + 1,
             resolved_at = CASE
               WHEN ? = 'RESOLVED' THEN CURRENT_TIMESTAMP(3)
               WHEN ? = 'IN_PROGRESS' THEN NULL
               ELSE resolved_at END,
             closed_at = CASE WHEN ? = 'CLOSED' THEN CURRENT_TIMESTAMP(3) ELSE closed_at END
         WHERE id = ? AND status = ? AND version = ?`,
        [
          input.newStatus,
          input.newStatus,
          input.newStatus,
          input.newStatus,
          input.id,
          input.previousStatus,
          input.version
        ]
      );
      if (result.affectedRows !== 1) {
        await connection.rollback();
        return false;
      }
      await this.insertStatusHistory(connection, input);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async listHistory(complaintId: string): Promise<ComplaintHistoryEntry[]> {
    const [rows] = await this.pool.execute<HistoryRow[]>(
      `SELECT id, complaint_id AS complaintId, previous_status AS previousStatus,
              new_status AS newStatus, changed_by_user_id AS changedByUserId,
              reason, changed_at AS changedAt
       FROM complaint_status_history
       WHERE complaint_id = ? ORDER BY changed_at, id`,
      [complaintId]
    );
    return rows;
  }

  async createAttachment(attachment: ComplaintAttachment): Promise<void> {
    await this.pool.execute(
      `INSERT INTO complaint_attachments
        (id, complaint_id, uploaded_by_user_id, original_filename, storage_key,
         media_type, size_bytes, checksum_sha256, scan_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attachment.id,
        attachment.complaintId,
        attachment.uploadedByUserId,
        attachment.originalFilename,
        attachment.storageKey,
        attachment.mediaType,
        attachment.sizeBytes,
        attachment.checksumSha256,
        attachment.scanStatus,
        attachment.isActive
      ]
    );
  }

  async listAttachments(complaintId: string): Promise<ComplaintAttachment[]> {
    const [rows] = await this.pool.execute<AttachmentRow[]>(
      `SELECT id, complaint_id AS complaintId, uploaded_by_user_id AS uploadedByUserId,
              original_filename AS originalFilename, storage_key AS storageKey,
              media_type AS mediaType, size_bytes AS sizeBytes,
              checksum_sha256 AS checksumSha256, scan_status AS scanStatus,
              is_active AS isActive, created_at AS createdAt
       FROM complaint_attachments
       WHERE complaint_id = ? AND is_active = TRUE ORDER BY created_at, id`,
      [complaintId]
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async findAttachment(complaintId: string, attachmentId: string): Promise<ComplaintAttachment | null> {
    const [rows] = await this.pool.execute<AttachmentRow[]>(
      `SELECT id, complaint_id AS complaintId, uploaded_by_user_id AS uploadedByUserId,
              original_filename AS originalFilename, storage_key AS storageKey,
              media_type AS mediaType, size_bytes AS sizeBytes,
              checksum_sha256 AS checksumSha256, scan_status AS scanStatus,
              is_active AS isActive, created_at AS createdAt
       FROM complaint_attachments
       WHERE complaint_id = ? AND id = ? AND is_active = TRUE LIMIT 1`,
      [complaintId, attachmentId]
    );
    return rows[0] ? { ...rows[0], isActive: Boolean(rows[0].isActive) } : null;
  }

  private async insertStatusHistory(
    connection: PoolConnection,
    input: {
      historyId: string;
      id: string;
      previousStatus: ComplaintStatus;
      newStatus: ComplaintStatus;
      actorUserId: string;
      reason: string | null;
    }
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO complaint_status_history
        (id, complaint_id, previous_status, new_status, changed_by_user_id, reason)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        input.historyId,
        input.id,
        input.previousStatus,
        input.newStatus,
        input.actorUserId,
        input.reason
      ]
    );
  }
}
