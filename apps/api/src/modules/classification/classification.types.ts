import type { Complaint, ComplaintStatus } from "../complaint/complaint.types.js";

export type RecommendationValidationStatus = "VALID" | "INVALID" | "FAILED" | "TIMEOUT";
export type ClassificationDecision = "APPROVED" | "OVERRIDDEN" | "MANUAL";

export interface AiRecommendation {
  id: string;
  complaintId: string;
  provider: string;
  modelName: string;
  promptVersion: string;
  recommendedCategoryId: string | null;
  confidence: number | null;
  isAmbiguous: boolean;
  explanation: string | null;
  validationStatus: RecommendationValidationStatus;
  failureCode: string | null;
  rawResponse: unknown;
  requestedAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}

export interface ClassificationReview {
  id: string;
  complaintId: string;
  recommendationId: string | null;
  reviewedByUserId: string;
  decision: ClassificationDecision;
  previousCategoryId: string | null;
  finalCategoryId: string;
  wasOverridden: boolean;
  reason: string | null;
  createdAt: Date;
}

export interface ReviewQueueItem {
  id: string;
  referenceNumber: string;
  title: string;
  status: ComplaintStatus;
  categoryId: string | null;
  assignedDepartmentId: string | null;
  classificationState: Complaint["classificationState"];
  classificationReviewRequired: boolean;
  version: number;
  createdAt: Date;
  recommendation: AiRecommendation | null;
}

export interface ClassifierRecommendation {
  recommendedCategoryId: string;
  recommendedCategoryName: string;
  explanation: string;
  confidenceEstimate: number | null;
  confidenceIsCalibrated: false;
  isAmbiguous: boolean;
  requiresClarification: boolean;
  clarificationQuestion: string | null;
  provider: string;
  modelName: string;
  promptVersion: string;
  sanitizedResponse: Record<string, unknown>;
}
