import type { Request, Response } from "express";

import type { KnowledgeQueryInput, KnowledgeUploadQuery } from "./knowledge.schemas.js";
import { KnowledgeService } from "./knowledge.service.js";

export class KnowledgeController {
  constructor(private readonly service = new KnowledgeService()) {}

  list = async (request: Request, response: Response) => {
    response.json({ data: { documents: await this.service.listDocuments(request.requestId) } });
  };

  upload = async (request: Request, response: Response) => {
    const document = await this.service.ingest({
      metadata: request.validatedQuery as KnowledgeUploadQuery,
      actorUserId: request.auth!.userId,
      originalFilename: request.get("x-filename") ?? "",
      mediaType: request.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "",
      content: Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0),
      requestId: request.requestId
    });
    response.status(201).json({ data: { document } });
  };

  uploadVersion = async (request: Request, response: Response) => {
    const document = await this.service.ingest({
      documentId: String(request.params.id),
      metadata: request.validatedQuery as KnowledgeUploadQuery,
      actorUserId: request.auth!.userId,
      originalFilename: request.get("x-filename") ?? "",
      mediaType: request.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "",
      content: Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0),
      requestId: request.requestId
    });
    response.status(201).json({ data: { document } });
  };

  deactivate = async (request: Request, response: Response) => {
    response.json({ data: { document: await this.service.deactivate(String(request.params.id), request.requestId) } });
  };

  query = async (request: Request, response: Response) => {
    const input = request.body as KnowledgeQueryInput;
    response.json({ data: { result: await this.service.query(input.question, request.requestId) } });
  };
}
