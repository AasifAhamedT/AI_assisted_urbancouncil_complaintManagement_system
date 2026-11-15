import { randomUUID } from "node:crypto";

import { AppError } from "../../common/app-error.js";
import type { AuthPrincipal } from "../auth/auth.types.js";
import { DepartmentService } from "../department/department.service.js";
import type {
  CreateReassignmentInput,
  DecideReassignmentInput,
  ReassignmentListQuery
} from "./reassignment.schemas.js";
import { ReassignmentRepository } from "./reassignment.repository.js";
import type { ReassignmentAccessScope, ReassignmentListOptions } from "./reassignment.types.js";

export class ReassignmentService {
  constructor(
    private readonly repository = new ReassignmentRepository(),
    private readonly departments = new DepartmentService()
  ) {}

  async create(input: CreateReassignmentInput, principal: AuthPrincipal) {
    if (principal.role !== "DEPARTMENT") {
      throw new AppError(403, "FORBIDDEN", "Only a Department Account can request reassignment.");
    }
    const departmentId = await this.departments.requireActiveDepartmentForAccount(principal.userId);
    const requestId = randomUUID();
    const result = await this.repository.createPending({
      id: requestId,
      complaintId: input.complaintId,
      actorUserId: principal.userId,
      departmentId,
      reason: input.reason
    });
    if (result === "COMPLAINT_NOT_FOUND" || result === "ASSIGNMENT_CHANGED") {
      throw new AppError(404, "COMPLAINT_NOT_FOUND", "Complaint not found in this department.");
    }
    if (result === "CLASSIFICATION_REVIEW_REQUIRED") {
      throw new AppError(
        409,
        "CLASSIFICATION_REVIEW_REQUIRED",
        "Reassignment cannot be requested until classification review is complete."
      );
    }
    if (result === "COMPLAINT_CLOSED") {
      throw new AppError(409, "COMPLAINT_CLOSED", "A closed complaint cannot be reassigned.");
    }
    if (result === "PENDING_EXISTS") {
      throw new AppError(
        409,
        "REASSIGNMENT_ALREADY_PENDING",
        "This complaint already has a pending reassignment request."
      );
    }
    return (await this.repository.findById(requestId, { kind: "DEPARTMENT", departmentId }))!;
  }

  async list(principal: AuthPrincipal, options: ReassignmentListQuery) {
    const repositoryOptions: ReassignmentListOptions = {
      page: options.page,
      pageSize: options.pageSize,
      ...(options.status ? { status: options.status } : {})
    };
    const result = await this.repository.list(await this.scopeFor(principal), repositoryOptions);
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

  async get(id: string, principal: AuthPrincipal) {
    const request = await this.repository.findById(id, await this.scopeFor(principal));
    if (!request) {
      throw new AppError(404, "REASSIGNMENT_NOT_FOUND", "Reassignment request not found.");
    }
    return request;
  }

  async decide(id: string, input: DecideReassignmentInput, principal: AuthPrincipal) {
    if (principal.role !== "ADMINISTRATOR") {
      throw new AppError(403, "FORBIDDEN", "Only an Administrator can decide reassignment requests.");
    }
    const targetDepartmentId = input.decision === "APPROVED"
      ? (await this.departments.requireActiveDepartment(input.targetDepartmentId)).id
      : null;
    const result = await this.repository.decide({
      requestId: id,
      actorUserId: principal.userId,
      decision: input.decision,
      targetDepartmentId,
      decisionReason: input.decisionReason,
      assignmentHistoryId: randomUUID()
    });
    if (result === "REQUEST_NOT_FOUND") {
      throw new AppError(404, "REASSIGNMENT_NOT_FOUND", "Reassignment request not found.");
    }
    if (result === "REQUEST_ALREADY_DECIDED") {
      throw new AppError(409, "REASSIGNMENT_ALREADY_DECIDED", "This request has already been decided.");
    }
    if (result === "COMPLAINT_NOT_FOUND" || result === "ASSIGNMENT_CHANGED") {
      throw new AppError(
        409,
        "REASSIGNMENT_STALE_ASSIGNMENT",
        "The complaint assignment changed after this request was submitted."
      );
    }
    if (result === "SAME_DEPARTMENT") {
      throw new AppError(
        400,
        "REASSIGNMENT_SAME_DEPARTMENT",
        "The target department must differ from the currently assigned department."
      );
    }
    return (await this.repository.findById(id))!;
  }

  private async scopeFor(principal: AuthPrincipal): Promise<ReassignmentAccessScope> {
    if (principal.role === "DEPARTMENT") {
      return {
        kind: "DEPARTMENT",
        departmentId: await this.departments.requireActiveDepartmentForAccount(principal.userId)
      };
    }
    if (principal.role === "ADMINISTRATOR") return { kind: "ADMINISTRATOR" };
    throw new AppError(403, "FORBIDDEN", "Citizens cannot access reassignment administration.");
  }
}
