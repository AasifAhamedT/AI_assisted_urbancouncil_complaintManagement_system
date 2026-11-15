import { z } from "zod";

import { AppError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import type { KnowledgeAnswer, KnowledgeDocument } from "./knowledge.types.js";

const versionSchema = z.object({
  version: z.number().int().positive(),
  originalFilename: z.string(),
  mediaType: z.string(),
  sizeBytes: z.number().int().positive(),
  checksumSha256: z.string().length(64),
  status: z.enum(["PROCESSING", "READY", "FAILED"]),
  chunkCount: z.number().int().nonnegative(),
  versionNote: z.string().nullable(),
  failureCode: z.string().nullable(),
  createdByUserId: z.string().uuid(),
  createdAt: z.string(),
  completedAt: z.string().nullable()
}).strict();

const documentSchema: z.ZodType<KnowledgeDocument> = z.object({
  id: z.string().uuid(),
  title: z.string(),
  isActive: z.boolean(),
  currentVersion: z.number().int().positive().nullable(),
  createdByUserId: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
  versions: z.array(versionSchema)
}).strict();

const answerSchema: z.ZodType<KnowledgeAnswer> = z.object({
  answer: z.string(),
  abstained: z.boolean(),
  citations: z.array(z.object({
    documentId: z.string().uuid(),
    documentTitle: z.string(),
    version: z.number().int().positive(),
    location: z.string(),
    excerpt: z.string()
  }).strict()),
  provider: z.string(),
  modelName: z.string()
}).strict();

export class RagClient {
  async listDocuments(requestId: string): Promise<KnowledgeDocument[]> {
    const body = await this.request("/v1/documents", { method: "GET" }, requestId);
    return this.parse(z.object({ documents: z.array(documentSchema) }).strict(), body).documents;
  }

  async ingest(input: {
    documentId?: string;
    title: string;
    actorUserId: string;
    versionNote?: string;
    originalFilename: string;
    mediaType: string;
    content: Buffer;
    requestId: string;
  }): Promise<KnowledgeDocument> {
    const form = new FormData();
    form.set("title", input.title);
    form.set("actor_user_id", input.actorUserId);
    if (input.versionNote) form.set("version_note", input.versionNote);
    form.set("file", new Blob([new Uint8Array(input.content)], { type: input.mediaType }), input.originalFilename);
    const path = input.documentId
      ? `/v1/documents/${encodeURIComponent(input.documentId)}/versions`
      : "/v1/documents";
    const body = await this.request(path, { method: "POST", body: form }, input.requestId);
    return this.parse(z.object({ document: documentSchema }).strict(), body).document;
  }

  async deactivate(documentId: string, requestId: string): Promise<KnowledgeDocument> {
    const body = await this.request(
      `/v1/documents/${encodeURIComponent(documentId)}/deactivate`,
      { method: "POST" },
      requestId
    );
    return this.parse(z.object({ document: documentSchema }).strict(), body).document;
  }

  async query(question: string, requestId: string): Promise<KnowledgeAnswer> {
    const body = await this.request("/v1/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question })
    }, requestId);
    return this.parse(answerSchema, body);
  }

  private async request(path: string, init: RequestInit, requestId: string): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.RAG_TIMEOUT_MS);
    try {
      const response = await fetch(`${env.RAG_BASE_URL}${path}`, {
        ...init,
        headers: { accept: "application/json", "x-request-id": requestId, ...init.headers },
        signal: controller.signal
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw this.upstreamError(response.status, body);
      }
      return body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (error instanceof z.ZodError) {
        throw new AppError(502, "RAG_INVALID_RESPONSE", "The knowledge service returned an invalid response.");
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError(504, "RAG_TIMEOUT", "The knowledge service timed out.");
      }
      throw new AppError(503, "RAG_UNAVAILABLE", "The knowledge service is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private upstreamError(status: number, body: unknown): AppError {
    const parsed = z.object({ error: z.object({ code: z.string(), message: z.string() }) }).safeParse(body);
    const code = parsed.success ? parsed.data.error.code : "RAG_SERVICE_ERROR";
    const message = parsed.success ? parsed.data.error.message : "The knowledge service could not complete the request.";
    return new AppError(status >= 500 ? status : 502, code, message);
  }

  private parse<T>(schema: z.ZodType<T>, body: unknown): T {
    const result = schema.safeParse(body);
    if (!result.success) {
      throw new AppError(502, "RAG_INVALID_RESPONSE", "The knowledge service returned an invalid response.");
    }
    return result.data;
  }
}
