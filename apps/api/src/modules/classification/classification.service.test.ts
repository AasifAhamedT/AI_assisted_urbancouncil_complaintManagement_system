import { describe, expect, it, vi } from "vitest";

import type { ComplaintRepository } from "../complaint/complaint.repository.js";
import type { Complaint } from "../complaint/complaint.types.js";
import type { DepartmentService } from "../department/department.service.js";
import type { AiClassifierClient } from "./ai-classifier.client.js";
import { AiClassifierClientError } from "./ai-classifier.client.js";
import type { ClassificationRepository } from "./classification.repository.js";
import { ClassificationService } from "./classification.service.js";

const complaint: Complaint = {
  id: "30000000-0000-4000-8000-000000000001",
  referenceNumber: "KUC-2026-AI000001",
  citizenUserId: "10000000-0000-4000-8000-000000000001",
  categoryId: null,
  assignedDepartmentId: null,
  title: "Uncollected household waste",
  description: "Household waste has not been collected from this street for several days.",
  priority: "NORMAL",
  status: "SUBMITTED",
  classificationState: "PENDING",
  classificationReviewRequired: true,
  version: 0,
  submittedAt: new Date(),
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

const category = {
  id: "40000000-0000-4000-8000-000000000001",
  code: "SOLID_WASTE",
  name: "Solid Waste Management",
  description: "Waste concerns",
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
};

const client = (classify: AiClassifierClient["classify"]) => ({
  classify,
  fallbackProvider: "gemini",
  fallbackModelName: "unavailable",
  fallbackPromptVersion: "complaint-category-v1"
}) as AiClassifierClient;

describe("classification workflow", () => {
  it("stores a validated recommendation separately and marks it for human review", async () => {
    const createRecommendation = vi.fn(async () => undefined);
    const setClassificationState = vi.fn(async () => undefined);
    const stored = { id: "70000000-0000-4000-8000-000000000001" };
    const repository = {
      createRecommendation,
      setClassificationState,
      findLatestRecommendation: vi.fn(async () => stored)
    } as unknown as ClassificationRepository;
    const classifier = client(vi.fn(async () => ({
      recommendedCategoryId: category.id,
      recommendedCategoryName: category.name,
      explanation: "The complaint describes uncollected household waste.",
      confidenceEstimate: 0.84,
      confidenceIsCalibrated: false as const,
      isAmbiguous: false,
      requiresClarification: false,
      clarificationQuestion: null,
      provider: "gemini",
      modelName: "test-model",
      promptVersion: "complaint-category-v1",
      sanitizedResponse: { recommended_category_id: category.id }
    })));
    const service = new ClassificationService(
      repository,
      { findComplaint: vi.fn(async () => complaint) } as unknown as ComplaintRepository,
      { listActiveCategories: vi.fn(async () => [category]) } as unknown as DepartmentService,
      classifier
    );

    await service.classifyComplaint(complaint.id, "classification-test");

    expect(createRecommendation).toHaveBeenCalledWith(expect.objectContaining({
      complaintId: complaint.id,
      recommendedCategoryId: category.id,
      validationStatus: "VALID",
      confidence: 0.84
    }));
    expect(setClassificationState).toHaveBeenCalledWith(complaint.id, "RECOMMENDED");
  });

  it("records provider failure without losing or changing the complaint", async () => {
    const createRecommendation = vi.fn(async () => undefined);
    const setClassificationState = vi.fn(async () => undefined);
    const repository = {
      createRecommendation,
      setClassificationState,
      findLatestRecommendation: vi.fn(async () => ({ id: "failure-record" }))
    } as unknown as ClassificationRepository;
    const service = new ClassificationService(
      repository,
      { findComplaint: vi.fn(async () => complaint) } as unknown as ComplaintRepository,
      { listActiveCategories: vi.fn(async () => [category]) } as unknown as DepartmentService,
      client(vi.fn(async () => { throw new AiClassifierClientError("AI_SERVICE_TIMEOUT", "TIMEOUT", "timeout"); }))
    );

    await service.classifyComplaint(complaint.id);

    expect(createRecommendation).toHaveBeenCalledWith(expect.objectContaining({
      complaintId: complaint.id,
      recommendedCategoryId: null,
      validationStatus: "TIMEOUT",
      failureCode: "AI_SERVICE_TIMEOUT"
    }));
    expect(setClassificationState).toHaveBeenCalledWith(complaint.id, "FAILED");
  });

  it("requires an audit reason when the Administrator overrides the recommendation", async () => {
    const repository = {
      findLatestRecommendation: vi.fn(async () => ({
        id: "70000000-0000-4000-8000-000000000001",
        validationStatus: "VALID",
        recommendedCategoryId: "40000000-0000-4000-8000-000000000002"
      }))
    } as unknown as ClassificationRepository;
    const service = new ClassificationService(
      repository,
      { findComplaint: vi.fn(async () => complaint) } as unknown as ComplaintRepository,
      { resolveActiveCategoryRouting: vi.fn(async () => ({ ...category, categoryId: category.id, departmentId: "20000000-0000-4000-8000-000000000001" })) } as unknown as DepartmentService,
      client(vi.fn())
    );

    await expect(service.reviewClassification(
      complaint.id,
      { categoryId: category.id, version: 0 },
      "10000000-0000-4000-8000-000000000003"
    )).rejects.toMatchObject({ code: "CLASSIFICATION_REASON_REQUIRED", statusCode: 400 });
  });
});
