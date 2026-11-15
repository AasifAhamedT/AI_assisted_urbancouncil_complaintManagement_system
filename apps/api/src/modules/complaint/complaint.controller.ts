import type { Request, Response } from "express";

import type {
  CreateComplaintInput,
  UpdateComplaintInput,
  UpdateComplaintStatusInput
} from "./complaint.schemas.js";
import { ClassificationService } from "../classification/classification.service.js";
import { ComplaintService } from "./complaint.service.js";
import type { ComplaintListOptions } from "./complaint.types.js";

export class ComplaintController {
  constructor(
    private readonly service = new ComplaintService(),
    private readonly classifications = new ClassificationService()
  ) {}

  listCategories = async (_request: Request, response: Response) => {
    response.json({ data: { categories: await this.service.listActiveCategories() } });
  };

  create = async (request: Request, response: Response) => {
    const complaint = await this.service.createComplaint(
      request.body as CreateComplaintInput,
      request.auth!
    );
    response.status(201).json({ data: { complaint } });
    setImmediate(() => {
      void this.classifications.classifyComplaint(complaint.id, request.requestId).catch((error: unknown) => {
        const code = error instanceof Error && "code" in error
          ? String((error as Error & { code: unknown }).code)
          : "CLASSIFICATION_PROCESSING_ERROR";
        console.error("Complaint classification processing failed.", {
          complaintId: complaint.id,
          requestId: request.requestId,
          code
        });
      });
    });
  };

  list = async (request: Request, response: Response) => {
    const result = await this.service.listComplaints(
      request.auth!,
      request.validatedQuery as ComplaintListOptions
    );
    response.json({ data: result });
  };

  get = async (request: Request, response: Response) => {
    response.json({
      data: { complaint: await this.service.getComplaint(String(request.params.id), request.auth!) }
    });
  };

  update = async (request: Request, response: Response) => {
    const complaint = await this.service.updateComplaint(
      String(request.params.id),
      request.body as UpdateComplaintInput,
      request.auth!
    );
    response.json({ data: { complaint } });
  };

  updateStatus = async (request: Request, response: Response) => {
    const complaint = await this.service.updateStatus(
      String(request.params.id),
      request.body as UpdateComplaintStatusInput,
      request.auth!
    );
    response.json({ data: { complaint } });
  };

  history = async (request: Request, response: Response) => {
    response.json({
      data: {
        history: await this.service.listHistory(String(request.params.id), request.auth!)
      }
    });
  };

  uploadAttachment = async (request: Request, response: Response) => {
    const attachment = await this.service.uploadAttachment({
      complaintId: String(request.params.id),
      originalFilename: request.get("x-filename") ?? "",
      mediaType: request.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "",
      content: Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0),
      principal: request.auth!
    });
    response.status(201).json({ data: { attachment } });
  };

  listAttachments = async (request: Request, response: Response) => {
    response.json({
      data: {
        attachments: await this.service.listAttachments(String(request.params.id), request.auth!)
      }
    });
  };

  downloadAttachment = async (request: Request, response: Response) => {
    const result = await this.service.downloadAttachment(
      String(request.params.id),
      String(request.params.attachmentId),
      request.auth!
    );
    response.setHeader("Content-Type", result.attachment.mediaType);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(result.attachment.originalFilename)}`
    );
    response.setHeader("Content-Length", String(result.content.length));
    response.send(result.content);
  };
}
