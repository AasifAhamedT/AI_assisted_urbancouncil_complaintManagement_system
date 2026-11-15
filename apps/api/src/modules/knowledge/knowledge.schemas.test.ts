import { describe, expect, it } from "vitest";

import { knowledgeQuerySchema, knowledgeUploadQuerySchema } from "./knowledge.schemas.js";

describe("knowledge schemas", () => {
  it("accepts a bounded public-information question", () => {
    expect(knowledgeQuerySchema.parse({ question: "Where are documented applications submitted?" })).toEqual({
      question: "Where are documented applications submitted?"
    });
  });

  it("rejects unknown query fields that could carry private complaint data", () => {
    expect(knowledgeQuerySchema.safeParse({
      question: "What is the procedure?",
      complaintDescription: "private complaint text"
    }).success).toBe(false);
  });

  it("requires traceable document metadata", () => {
    expect(knowledgeUploadQuerySchema.safeParse({ title: "Approved service guide", versionNote: "2026 revision" }).success).toBe(true);
    expect(knowledgeUploadQuerySchema.safeParse({ title: "x" }).success).toBe(false);
  });
});
