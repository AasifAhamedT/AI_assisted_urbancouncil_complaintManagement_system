import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import { ComplaintRepository } from "../complaint/complaint.repository.js";
import { DepartmentService } from "../department/department.service.js";
import { AiClassifierClient, AiClassifierClientError } from "./ai-classifier.client.js";
import { ClassificationRepository } from "./classification.repository.js";
import type { ClassificationListQuery, ReviewClassificationInput } from "./classification.schemas.js";
import type { AiRecommendation, ClassificationDecision } from "./classification.types.js";

export class ClassificationService {
  constructor(
    private readonly repository = new ClassificationRepository(),
    private readonly complaints = new ComplaintRepository(),
    private readonly departments = new DepartmentService(),
    private readonly classifier = new AiClassifierClient()
  ) {}

  async classifyComplaint(complaintId: string, requestId: string = randomUUID()): Promise<AiRecommendation> {
    const complaint = await this.complaints.findComplaint(complaintId, { kind: "ADMINISTRATOR" });
    if (!complaint) {
      throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found.");
    }
    const categories = await this.departments.listActiveCategories();
    const requestedAt = new Date();
    if (categories.length === 0) {
      return this.recordFailure({
        complaintId,
        requestedAt,
        validationStatus: "INVALID",
        failureCode: "NO_ACTIVE_CATEGORIES",
        state: "MANUAL_REVIEW"
      });
    }
    try {
      const result = await this.classifier.classify({
        title: complaint.title,
        description: complaint.description,
        categories,
        requestId
      });
      if (!categories.some((category) => category.id === result.recommendedCategoryId)) {
        return this.recordFailure({
          complaintId,
          requestedAt,
          validationStatus: "INVALID",
          failureCode: "AI_CATEGORY_NOT_ACTIVE",
          state: "MANUAL_REVIEW"
        });
      }
      const recommendation: Omit<AiRecommendation, "createdAt"> = {
        id: randomUUID(),
        complaintId,
        provider: result.provider,
        modelName: result.modelName,
        promptVersion: result.promptVersion,
        recommendedCategoryId: result.recommendedCategoryId,
        confidence: result.confidenceEstimate,
        isAmbiguous: result.isAmbiguous,
        explanation: result.explanation,
        validationStatus: "VALID",
        failureCode: null,
        rawResponse: result.sanitizedResponse,
        requestedAt,
        completedAt: new Date()
      };
      await this.repository.createRecommendation(recommendation);
      await this.repository.setClassificationState(complaintId, "RECOMMENDED");
      return (await this.repository.findLatestRecommendation(complaintId))!;
    } catch (error) {
      if (!(error instanceof AiClassifierClientError)) throw error;
      return this.recordFailure({
        complaintId,
        requestedAt,
        validationStatus: error.validationStatus,
        failureCode: error.code,
        state: error.validationStatus === "INVALID" ? "MANUAL_REVIEW" : "FAILED"
      });
    }
  }

  async listReviewQueue(query: ClassificationListQuery) {
    const result = await this.repository.listReviewQueue(query.page, query.pageSize);
    return {
      ...result,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      }
    };
  }

  async getReviewDetail(complaintId: string) {
    const complaint = await this.complaints.findComplaint(complaintId, { kind: "ADMINISTRATOR" });
    if (!complaint) {
      throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found.");
    }
    const [recommendation, reviews] = await Promise.all([
      this.repository.findLatestRecommendation(complaintId),
      this.repository.listReviews(complaintId)
    ]);
    return { complaint, recommendation, reviews };
  }

  async reviewClassification(
    complaintId: string,
    input: ReviewClassificationInput,
    actorUserId: string
  ) {
    const complaint = await this.complaints.findComplaint(complaintId, { kind: "ADMINISTRATOR" });
    if (!complaint) {
      throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found.");
    }
    if (!complaint.classificationReviewRequired) {
      throw new AppError(409, "CLASSIFICATION_ALREADY_REVIEWED", "This classification has already been reviewed.");
    }
    if (complaint.version !== input.version) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    const routing = await this.departments.resolveActiveCategoryRouting(input.categoryId);
    if (!routing.departmentId) {
      throw new AppError(
        409,
        "CATEGORY_MAPPING_REQUIRED",
        "Configure an active department mapping before approving this category."
      );
    }
    const recommendation = await this.repository.findLatestRecommendation(complaintId);
    const decision: ClassificationDecision = recommendation?.validationStatus === "VALID"
      ? recommendation.recommendedCategoryId === input.categoryId ? "APPROVED" : "OVERRIDDEN"
      : "MANUAL";
    if (decision !== "APPROVED" && !input.reason) {
      throw new AppError(
        400,
        "CLASSIFICATION_REASON_REQUIRED",
        "A reason is required when overriding or manually classifying a complaint."
      );
    }
    const applied = await this.repository.applyReview({
      reviewId: randomUUID(),
      assignmentHistoryId: randomUUID(),
      complaintId,
      recommendationId: recommendation?.id ?? null,
      actorUserId,
      decision,
      previousCategoryId: complaint.categoryId,
      previousDepartmentId: complaint.assignedDepartmentId,
      finalCategoryId: routing.categoryId,
      finalDepartmentId: routing.departmentId,
      reason: input.reason ?? null,
      version: input.version
    });
    if (!applied) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    return this.getReviewDetail(complaintId);
  }

  private async recordFailure(input: {
    complaintId: string;
    requestedAt: Date;
    validationStatus: "INVALID" | "FAILED" | "TIMEOUT";
    failureCode: string;
    state: "FAILED" | "MANUAL_REVIEW";
  }): Promise<AiRecommendation> {
    await this.repository.createRecommendation({
      id: randomUUID(),
      complaintId: input.complaintId,
      provider: this.classifier.fallbackProvider,
      modelName: this.classifier.fallbackModelName,
      promptVersion: this.classifier.fallbackPromptVersion,
      recommendedCategoryId: null,
      confidence: null,
      isAmbiguous: true,
      explanation: null,
      validationStatus: input.validationStatus,
      failureCode: input.failureCode,
      rawResponse: null,
      requestedAt: input.requestedAt,
      completedAt: new Date()
    });
    await this.repository.setClassificationState(input.complaintId, input.state);
    return (await this.repository.findLatestRecommendation(input.complaintId))!;
  }
}
