import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DepartmentService } from "../department/department.service.js";
import { AttachmentStorageService } from "./attachment-storage.service.js";
import { generateComplaintReference } from "./complaint-reference.js";
import { ComplaintRepository } from "./complaint.repository.js";
import type {
  CreateComplaintInput,
  UpdateComplaintInput,
  UpdateComplaintStatusInput
} from "./complaint.schemas.js";
import { assertStatusTransitionAllowed } from "./complaint-transition-policy.js";
import type {
  Complaint,
  ComplaintAccessScope,
  ComplaintActor,
  ComplaintAttachment,
  ComplaintListOptions
} from "./complaint.types.js";

const publicAttachment = (attachment: ComplaintAttachment) => ({
  id: attachment.id,
  complaintId: attachment.complaintId,
  uploadedByUserId: attachment.uploadedByUserId,
  originalFilename: attachment.originalFilename,
  mediaType: attachment.mediaType,
  sizeBytes: attachment.sizeBytes,
  checksumSha256: attachment.checksumSha256,
  scanStatus: attachment.scanStatus,
  createdAt: attachment.createdAt
});

export class ComplaintService {
  constructor(
    private readonly repository = new ComplaintRepository(),
    private readonly departments = new DepartmentService(),
    private readonly storage = new AttachmentStorageService()
  ) {}

  listActiveCategories() {
    return this.departments.listActiveCategories();
  }

  async createComplaint(input: CreateComplaintInput, principal: AuthPrincipal): Promise<Complaint> {
    if (principal.role !== "CITIZEN") {
      throw new AppError(403, "FORBIDDEN", "Only Citizens can submit complaints.");
    }
    const routing = input.categoryId
      ? await this.departments.resolveActiveCategoryRouting(input.categoryId)
      : null;
    const now = new Date();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const id = randomUUID();
      const complaint: Complaint = {
        id,
        referenceNumber: generateComplaintReference(now),
        citizenUserId: principal.userId,
        categoryId: routing?.categoryId ?? null,
        assignedDepartmentId: routing?.departmentId ?? null,
        title: input.title,
        description: input.description,
        priority: "NORMAL",
        status: "SUBMITTED",
        classificationState: "PENDING",
        classificationReviewRequired: true,
        version: 0,
        submittedAt: now,
        resolvedAt: null,
        closedAt: null,
        createdAt: now,
        updatedAt: now
      };
      const created = await this.repository.createComplaint({
        complaint,
        historyId: randomUUID(),
        ...(routing?.departmentId ? { assignmentHistoryId: randomUUID() } : {})
      });
      if (created) {
        return (await this.repository.findComplaint(id, { kind: "CITIZEN", userId: principal.userId }))!;
      }
    }
    throw new AppError(503, "REFERENCE_GENERATION_FAILED", "A complaint reference could not be generated. Please retry.");
  }

  async listComplaints(principal: AuthPrincipal, options: ComplaintListOptions) {
    const scope = await this.scopeFor(principal);
    const result = await this.repository.listComplaints(scope, options);
    return {
      ...result,
      pagination: {
        page: options.page,
        pageSize: options.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / options.pageSize)
      }
    };
  }

  async listAccessibleMapComplaints(
    principal: AuthPrincipal,
    filters: { status?: Complaint["status"]; categoryId?: string }
  ) {
    return this.repository.listMapComplaintSummaries(await this.scopeFor(principal), filters);
  }

  async getComplaint(id: string, principal: AuthPrincipal): Promise<Complaint> {
    const complaint = await this.repository.findComplaint(id, await this.scopeFor(principal));
    if (!complaint) {
      throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found.");
    }
    return complaint;
  }

  async updateComplaint(
    id: string,
    input: UpdateComplaintInput,
    principal: AuthPrincipal
  ): Promise<Complaint> {
    if (principal.role !== "CITIZEN") {
      throw new AppError(403, "FORBIDDEN", "Only the owning Citizen can edit complaint content.");
    }
    const existing = await this.getComplaint(id, principal);
    if (existing.status !== "SUBMITTED") {
      throw new AppError(409, "COMPLAINT_NOT_EDITABLE", "Only submitted complaints can be edited.");
    }
    if (existing.version !== input.version) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    const updated = await this.repository.updateCitizenContent({
      id,
      citizenUserId: principal.userId,
      title: input.title ?? existing.title,
      description: input.description ?? existing.description,
      version: input.version
    });
    if (!updated) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    return this.getComplaint(id, principal);
  }

  async updateStatus(
    id: string,
    input: UpdateComplaintStatusInput,
    principal: AuthPrincipal
  ): Promise<Complaint> {
    const existing = await this.getComplaint(id, principal);
    if (existing.version !== input.version) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    assertStatusTransitionAllowed(existing.status, input.status, principal.role, input.reason);
    const updated = await this.repository.updateStatus({
      id,
      previousStatus: existing.status,
      newStatus: input.status,
      actorUserId: principal.userId,
      reason: input.reason ?? null,
      version: input.version,
      historyId: randomUUID()
    });
    if (!updated) {
      throw new AppError(409, "COMPLAINT_VERSION_CONFLICT", "The complaint was updated by another request.");
    }
    return this.getComplaint(id, principal);
  }

  async listHistory(id: string, principal: AuthPrincipal) {
    await this.getComplaint(id, principal);
    return this.repository.listHistory(id);
  }

  async uploadAttachment(input: {
    complaintId: string;
    originalFilename: string;
    mediaType: string;
    content: Buffer;
    principal: AuthPrincipal;
  }) {
    if (input.principal.role !== "CITIZEN") {
      throw new AppError(403, "FORBIDDEN", "Only the owning Citizen can upload complaint attachments.");
    }
    await this.getComplaint(input.complaintId, input.principal);
    const stored = await this.storage.store(input);
    const attachment: ComplaintAttachment = {
      id: randomUUID(),
      complaintId: input.complaintId,
      uploadedByUserId: input.principal.userId,
      originalFilename: input.originalFilename,
      storageKey: stored.storageKey,
      mediaType: input.mediaType,
      sizeBytes: stored.sizeBytes,
      checksumSha256: stored.checksumSha256,
      scanStatus: "PENDING",
      isActive: true,
      createdAt: new Date()
    };
    try {
      await this.repository.createAttachment(attachment);
    } catch (error) {
      await this.storage.remove(stored.storageKey);
      throw error;
    }
    return publicAttachment(attachment);
  }

  async listAttachments(id: string, principal: AuthPrincipal) {
    await this.getComplaint(id, principal);
    return (await this.repository.listAttachments(id)).map(publicAttachment);
  }

  async downloadAttachment(id: string, attachmentId: string, principal: AuthPrincipal) {
    await this.getComplaint(id, principal);
    const attachment = await this.repository.findAttachment(id, attachmentId);
    if (!attachment) {
      throw new AppError(404, "ATTACHMENT_NOT_FOUND", "Attachment not found.");
    }
    return { attachment: publicAttachment(attachment), content: await this.storage.read(attachment.storageKey) };
  }

  private async scopeFor(actor: ComplaintActor): Promise<ComplaintAccessScope> {
    if (actor.role === "CITIZEN") {
      return { kind: "CITIZEN", userId: actor.userId };
    }
    if (actor.role === "DEPARTMENT") {
      return {
        kind: "DEPARTMENT",
        departmentId: await this.departments.requireActiveDepartmentForAccount(actor.userId)
      };
    }
    return { kind: "ADMINISTRATOR" };
  }
}
