import { describe, expect, it } from "vitest";

import { classificationListQuerySchema, reviewClassificationSchema } from "./classification.schemas.js";

describe("classification request validation", () => {
  it("coerces bounded pagination values", () => {
    expect(classificationListQuerySchema.parse({ page: "2", pageSize: "25" })).toEqual({
      page: 2,
      pageSize: 25
    });
  });

  it("requires an active-category identifier and optimistic version for review", () => {
    expect(reviewClassificationSchema.safeParse({
      categoryId: "40000000-0000-4000-8000-000000000001",
      version: 1
    }).success).toBe(true);
    expect(reviewClassificationSchema.safeParse({ categoryId: "not-a-uuid", version: -1 }).success).toBe(false);
  });
});
