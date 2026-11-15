import { describe, expect, it, vi } from "vitest";

import type { RagClient } from "./rag.client.js";
import { KnowledgeService } from "./knowledge.service.js";

const validInput = {
  metadata: { title: "Academic verification guide", versionNote: "Initial version" },
  actorUserId: "10000000-0000-4000-8000-000000000003",
  originalFilename: "guide.txt",
  mediaType: "text/plain",
  content: Buffer.from("Authorized public-information test content."),
  requestId: "knowledge-service-test"
};

describe("knowledge service", () => {
  it("forwards only validated document content and trusted actor identity", async () => {
    const ingest = vi.fn(async () => ({ id: "document-id" }));
    const service = new KnowledgeService({ ingest } as unknown as RagClient);

    await service.ingest(validInput);

    expect(ingest).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: validInput.actorUserId,
      originalFilename: "guide.txt",
      mediaType: "text/plain"
    }));
  });

  it("rejects filename, media type, and content mismatches before calling RAG", async () => {
    const ingest = vi.fn();
    const service = new KnowledgeService({ ingest } as unknown as RagClient);

    expect(() => service.ingest({
      ...validInput,
      originalFilename: "guide.pdf",
      mediaType: "application/pdf"
    })).toThrow(expect.objectContaining({ code: "DOCUMENT_TYPE_MISMATCH", statusCode: 415 }));
    expect(ingest).not.toHaveBeenCalled();
  });

  it("does not accept executable document formats", () => {
    const service = new KnowledgeService({ ingest: vi.fn() } as unknown as RagClient);
    expect(() => service.ingest({
      ...validInput,
      originalFilename: "guide.exe",
      mediaType: "application/octet-stream"
    })).toThrow(expect.objectContaining({ code: "DOCUMENT_TYPE_NOT_SUPPORTED", statusCode: 415 }));
  });
});
