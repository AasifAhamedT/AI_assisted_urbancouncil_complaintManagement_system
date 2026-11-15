import { basename, extname } from "node:path";

import { AppError } from "../../common/app-error.js";
import { env } from "../../config/env.js";
import type { KnowledgeUploadQuery } from "./knowledge.schemas.js";
import { RagClient } from "./rag.client.js";

const mediaTypes = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"]
} as const;

export class KnowledgeService {
  constructor(private readonly client = new RagClient()) {}

  listDocuments(requestId: string) {
    return this.client.listDocuments(requestId);
  }

  query(question: string, requestId: string) {
    return this.client.query(question, requestId);
  }

  deactivate(documentId: string, requestId: string) {
    return this.client.deactivate(documentId, requestId);
  }

  ingest(input: {
    documentId?: string;
    metadata: KnowledgeUploadQuery;
    actorUserId: string;
    originalFilename: string;
    mediaType: string;
    content: Buffer;
    requestId: string;
  }) {
    this.validateUpload(input.originalFilename, input.mediaType, input.content);
    return this.client.ingest({
      ...(input.documentId ? { documentId: input.documentId } : {}),
      title: input.metadata.title,
      actorUserId: input.actorUserId,
      ...(input.metadata.versionNote ? { versionNote: input.metadata.versionNote } : {}),
      originalFilename: input.originalFilename.trim(),
      mediaType: input.mediaType,
      content: input.content,
      requestId: input.requestId
    });
  }

  private validateUpload(filename: string, mediaType: string, content: Buffer): void {
    const normalized = filename.trim();
    if (!normalized || normalized.length > 255 || basename(normalized) !== normalized || normalized.includes("\0")) {
      throw new AppError(400, "INVALID_DOCUMENT_FILENAME", "The document filename is invalid.");
    }
    if (!content.length) throw new AppError(400, "EMPTY_DOCUMENT", "The uploaded document is empty.");
    if (content.length > env.MAX_KNOWLEDGE_DOCUMENT_BYTES) {
      throw new AppError(413, "DOCUMENT_TOO_LARGE", "The uploaded document is too large.");
    }
    if (!(mediaType in mediaTypes)) {
      throw new AppError(415, "DOCUMENT_TYPE_NOT_SUPPORTED", "Only PDF, DOCX, and UTF-8 text documents are supported.");
    }
    const type = mediaType as keyof typeof mediaTypes;
    if (!(mediaTypes[type] as readonly string[]).includes(extname(normalized).toLowerCase())) {
      throw new AppError(415, "DOCUMENT_TYPE_MISMATCH", "The filename and media type do not match.");
    }
    const signatureValid = type === "application/pdf"
      ? content.subarray(0, 5).toString("ascii") === "%PDF-"
      : type.endsWith("wordprocessingml.document")
        ? content[0] === 0x50 && content[1] === 0x4b
        : !content.includes(0);
    if (!signatureValid) {
      throw new AppError(415, "DOCUMENT_TYPE_MISMATCH", "The filename, media type, and file content do not match.");
    }
  }
}
