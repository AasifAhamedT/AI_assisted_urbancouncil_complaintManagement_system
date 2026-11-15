import { z } from "zod";

import { env } from "../../config/env.js";
import type { Category } from "../department/department.types.js";
import type { ClassifierRecommendation, RecommendationValidationStatus } from "./classification.types.js";

const classifierResponseSchema = z.object({
  recommendation: z.object({
    recommendedCategoryId: z.string().uuid(),
    recommendedCategoryName: z.string().min(1).max(150),
    explanation: z.string().min(10).max(1000),
    confidenceEstimate: z.number().min(0).max(1).nullable(),
    confidenceIsCalibrated: z.literal(false),
    isAmbiguous: z.boolean(),
    requiresClarification: z.boolean(),
    clarificationQuestion: z.string().min(5).max(500).nullable(),
    provider: z.string().min(1).max(50),
    modelName: z.string().min(1).max(100),
    promptVersion: z.string().min(1).max(50),
    sanitizedResponse: z.record(z.string(), z.unknown())
  }).strict()
}).strict();

export class AiClassifierClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly validationStatus: Exclude<RecommendationValidationStatus, "VALID">,
    message: string
  ) {
    super(message);
    this.name = "AiClassifierClientError";
  }
}

export class AiClassifierClient {
  readonly fallbackProvider = "gemini";
  readonly fallbackModelName = "unavailable";
  readonly fallbackPromptVersion = "complaint-category-v1";

  async classify(input: {
    title: string;
    description: string;
    categories: Category[];
    requestId: string;
  }): Promise<ClassifierRecommendation> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.AI_CLASSIFICATION_TIMEOUT_MS);
    try {
      const response = await fetch(`${env.AI_CLASSIFIER_BASE_URL}/v1/classify`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
          "x-request-id": input.requestId
        },
        body: JSON.stringify({
          title: input.title,
          description: input.description,
          categories: input.categories.map((category) => ({
            id: category.id,
            name: category.name,
            description: category.description
          }))
        }),
        signal: controller.signal
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const code = this.readErrorCode(body);
        throw new AiClassifierClientError(
          code,
          response.status === 504 || code === "AI_PROVIDER_TIMEOUT" ? "TIMEOUT" :
            code === "AI_INVALID_RESPONSE" || code === "AI_UNSUPPORTED_CATEGORY" ? "INVALID" : "FAILED",
          "The AI classification service could not complete the request."
        );
      }
      const parsed = classifierResponseSchema.safeParse(body);
      if (!parsed.success) {
        throw new AiClassifierClientError(
          "AI_SERVICE_INVALID_RESPONSE",
          "INVALID",
          "The AI classification service returned an invalid response."
        );
      }
      return parsed.data.recommendation;
    } catch (error) {
      if (error instanceof AiClassifierClientError) throw error;
      if (error instanceof Error && error.name === "AbortError") {
        throw new AiClassifierClientError("AI_SERVICE_TIMEOUT", "TIMEOUT", "The AI classification service timed out.");
      }
      throw new AiClassifierClientError("AI_SERVICE_UNAVAILABLE", "FAILED", "The AI classification service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private readErrorCode(body: unknown): string {
    if (typeof body !== "object" || body === null || !("error" in body)) return "AI_SERVICE_ERROR";
    const error = body.error;
    if (typeof error !== "object" || error === null || !("code" in error)) return "AI_SERVICE_ERROR";
    return typeof error.code === "string" ? error.code : "AI_SERVICE_ERROR";
  }
}
