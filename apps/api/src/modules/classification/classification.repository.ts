import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type {
  AiRecommendation,
  ClassificationDecision,
  ClassificationReview,
  RecommendationValidationStatus,
  ReviewQueueItem
} from "./classification.types.js";

interface RecommendationRow extends RowDataPacket {
  id: string;
  complaintId: string;
  provider: string;
  modelName: string;
  promptVersion: string;
  recommendedCategoryId: string | null;
  confidence: number | string | null;
  isAmbiguous: boolean | number;
  explanation: string | null;
  validationStatus: RecommendationValidationStatus;
  failureCode: string | null;
  rawResponse: unknown;
  requestedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

type ReviewRow = RowDataPacket & Omit<ClassificationReview, "wasOverridden"> & {
  wasOverridden: boolean | number;
};

interface QueueRow extends RowDataPacket {
  id: string;
  referenceNumber: string;
  title: string;
  status: ReviewQueueItem["status"];
  categoryId: string | null;
  assignedDepartmentId: string | null;
  classificationState: ReviewQueueItem["classificationState"];
  classificationReviewRequired: boolean | number;
  version: number;
  createdAt: Date;
  recommendationId: string | null;
  recommendationProvider: string | null;
  recommendationModelName: string | null;
  recommendationPromptVersion: string | null;
  recommendedCategoryId: string | null;
  recommendationConfidence: number | string | null;
  recommendationIsAmbiguous: boolean | number | null;
  recommendationExplanation: string | null;
  recommendationValidationStatus: RecommendationValidationStatus | null;
  recommendationFailureCode: string | null;
  recommendationRawResponse: unknown;
  recommendationRequestedAt: Date | null;
  recommendationCompletedAt: Date | null;
  recommendationCreatedAt: Date | null;
}

interface CountRow extends RowDataPacket { total: number }

const recommendationColumns = `
  id, complaint_id AS complaintId, provider, model_name AS modelName,
  prompt_version AS promptVersion, recommended_category_id AS recommendedCategoryId,
  confidence, is_ambiguous AS isAmbiguous, explanation,
  validation_status AS validationStatus, failure_code AS failureCode,
  raw_response AS rawResponse, requested_at AS requestedAt,
  completed_at AS completedAt, created_at AS createdAt`;

const mapRecommendation = (row: RecommendationRow): AiRecommendation => ({
  ...row,
  confidence: row.confidence === null ? null : Number(row.confidence),
  isAmbiguous: Boolean(row.isAmbiguous)
});

export class ClassificationRepository {
  private readonly pool = databasePools.complaint;

  async createRecommendation(input: Omit<AiRecommendation, "createdAt">): Promise<void> {
    await this.pool.execute(
      `INSERT INTO ai_recommendations
        (id, complaint_id, provider, model_name, prompt_version,
         recommended_category_id, confidence, is_ambiguous, explanation,
         validation_status, failure_code, raw_response, requested_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.complaintId,
        input.provider,
        input.modelName,
        input.promptVersion,
        input.recommendedCategoryId,
        input.confidence,
        input.isAmbiguous,
        input.explanation,
        input.validationStatus,
        input.failureCode,
        input.rawResponse === null ? null : JSON.stringify(input.rawResponse),
        input.requestedAt,
        input.completedAt
      ]
    );
  }

  async setClassificationState(
    complaintId: string,
    state: "RECOMMENDED" | "FAILED" | "MANUAL_REVIEW"
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE complaints
       SET classification_state = ?, classification_review_required = TRUE
       WHERE id = ?`,
      [state, complaintId]
    );
  }

  async findLatestRecommendation(complaintId: string): Promise<AiRecommendation | null> {
    const [rows] = await this.pool.execute<RecommendationRow[]>(
      `SELECT ${recommendationColumns}
       FROM ai_recommendations
       WHERE complaint_id = ?
       ORDER BY created_at DESC, id DESC LIMIT 1`,
      [complaintId]
    );
    return rows[0] ? mapRecommendation(rows[0]) : null;
  }

  async listReviews(complaintId: string): Promise<ClassificationReview[]> {
    const [rows] = await this.pool.execute<ReviewRow[]>(
      `SELECT id, complaint_id AS complaintId, recommendation_id AS recommendationId,
              reviewed_by_user_id AS reviewedByUserId, decision,
              previous_category_id AS previousCategoryId, final_category_id AS finalCategoryId,
              was_overridden AS wasOverridden, reason, created_at AS createdAt
       FROM classification_reviews
       WHERE complaint_id = ? ORDER BY created_at, id`,
      [complaintId]
    );
    return rows.map((row) => ({ ...row, wasOverridden: Boolean(row.wasOverridden) }));
  }

  async listReviewQueue(page: number, pageSize: number): Promise<{ items: ReviewQueueItem[]; total: number }> {
    const [countRows] = await this.pool.query<CountRow[]>(
      "SELECT COUNT(*) AS total FROM complaints WHERE classification_review_required = TRUE"
    );
    const [rows] = await this.pool.execute<QueueRow[]>(
      `SELECT c.id, c.reference_number AS referenceNumber, c.title, c.status,
              c.category_id AS categoryId, c.assigned_department_id AS assignedDepartmentId,
              c.classification_state AS classificationState,
              c.classification_review_required AS classificationReviewRequired,
              c.version, c.created_at AS createdAt,
              ar.id AS recommendationId, ar.provider AS recommendationProvider,
              ar.model_name AS recommendationModelName,
              ar.prompt_version AS recommendationPromptVersion,
              ar.recommended_category_id AS recommendedCategoryId,
              ar.confidence AS recommendationConfidence,
              ar.is_ambiguous AS recommendationIsAmbiguous,
              ar.explanation AS recommendationExplanation,
              ar.validation_status AS recommendationValidationStatus,
              ar.failure_code AS recommendationFailureCode,
              ar.raw_response AS recommendationRawResponse,
              ar.requested_at AS recommendationRequestedAt,
              ar.completed_at AS recommendationCompletedAt,
              ar.created_at AS recommendationCreatedAt
       FROM complaints AS c
       LEFT JOIN ai_recommendations AS ar ON ar.id = (
         SELECT candidate.id FROM ai_recommendations AS candidate
         WHERE candidate.complaint_id = c.id
         ORDER BY candidate.created_at DESC, candidate.id DESC LIMIT 1
       )
       WHERE c.classification_review_required = TRUE
       ORDER BY c.created_at ASC, c.id ASC
       LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );
    return { items: rows.map((row) => this.mapQueueRow(row)), total: Number(countRows[0]?.total ?? 0) };
  }

  async applyReview(input: {
    reviewId: string;
    assignmentHistoryId: string;
    complaintId: string;
    recommendationId: string | null;
    actorUserId: string;
    decision: ClassificationDecision;
    previousCategoryId: string | null;
    previousDepartmentId: string | null;
    finalCategoryId: string;
    finalDepartmentId: string;
    reason: string | null;
    version: number;
  }): Promise<boolean> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE complaints
         SET category_id = ?, assigned_department_id = ?,
             classification_state = 'APPROVED', classification_review_required = FALSE,
             version = version + 1
         WHERE id = ? AND version = ? AND classification_review_required = TRUE`,
        [input.finalCategoryId, input.finalDepartmentId, input.complaintId, input.version]
      );
      if (result.affectedRows !== 1) {
        await connection.rollback();
        return false;
      }
      await connection.execute(
        `INSERT INTO classification_reviews
          (id, complaint_id, recommendation_id, reviewed_by_user_id, decision,
           previous_category_id, final_category_id, was_overridden, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.reviewId,
          input.complaintId,
          input.recommendationId,
          input.actorUserId,
          input.decision,
          input.previousCategoryId,
          input.finalCategoryId,
          input.decision !== "APPROVED",
          input.reason
        ]
      );
      if (input.previousDepartmentId !== input.finalDepartmentId) {
        await this.insertAssignmentHistory(connection, input);
      }
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private mapQueueRow(row: QueueRow): ReviewQueueItem {
    const recommendation: AiRecommendation | null = row.recommendationId && row.recommendationProvider &&
      row.recommendationModelName && row.recommendationPromptVersion &&
      row.recommendationValidationStatus && row.recommendationRequestedAt && row.recommendationCreatedAt
      ? {
          id: row.recommendationId,
          complaintId: row.id,
          provider: row.recommendationProvider,
          modelName: row.recommendationModelName,
          promptVersion: row.recommendationPromptVersion,
          recommendedCategoryId: row.recommendedCategoryId,
          confidence: row.recommendationConfidence === null ? null : Number(row.recommendationConfidence),
          isAmbiguous: Boolean(row.recommendationIsAmbiguous),
          explanation: row.recommendationExplanation,
          validationStatus: row.recommendationValidationStatus,
          failureCode: row.recommendationFailureCode,
          rawResponse: row.recommendationRawResponse,
          requestedAt: row.recommendationRequestedAt,
          completedAt: row.recommendationCompletedAt,
          createdAt: row.recommendationCreatedAt
        }
      : null;
    return {
      id: row.id,
      referenceNumber: row.referenceNumber,
      title: row.title,
      status: row.status,
      categoryId: row.categoryId,
      assignedDepartmentId: row.assignedDepartmentId,
      classificationState: row.classificationState,
      classificationReviewRequired: Boolean(row.classificationReviewRequired),
      version: row.version,
      createdAt: row.createdAt,
      recommendation
    };
  }

  private async insertAssignmentHistory(
    connection: PoolConnection,
    input: {
      assignmentHistoryId: string;
      complaintId: string;
      previousDepartmentId: string | null;
      finalDepartmentId: string;
      actorUserId: string;
      reason: string | null;
    }
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO assignment_history
        (id, complaint_id, previous_department_id, new_department_id,
         changed_by_user_id, source, reason)
       VALUES (?, ?, ?, ?, ?, 'ADMIN_OVERRIDE', ?)`,
      [
        input.assignmentHistoryId,
        input.complaintId,
        input.previousDepartmentId,
        input.finalDepartmentId,
        input.actorUserId,
        input.reason ?? "Administrator approved the final classification and configured routing."
      ]
    );
  }
}
