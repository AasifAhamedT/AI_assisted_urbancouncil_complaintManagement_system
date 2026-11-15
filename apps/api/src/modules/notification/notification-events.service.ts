import type { AuthPrincipal } from "../auth/auth.types.js";
import { AccountAdministrationService } from "../auth/account-administration.service.js";
import { ComplaintService } from "../complaint/complaint.service.js";
import type { Complaint } from "../complaint/complaint.types.js";
import { DepartmentService } from "../department/department.service.js";
import type { ReassignmentRequestRecord } from "../reassignment/reassignment.types.js";
import { NotificationRepository } from "./notification.repository.js";
import type {
  NotificationDraft,
  NotificationEventType
} from "./notification.types.js";

const statusLabel = (status: string) => status.toLowerCase().replaceAll("_", " ");

export class NotificationEventService {
  constructor(
    private readonly repository = new NotificationRepository(),
    private readonly departments = new DepartmentService(),
    private readonly accounts = new AccountAdministrationService(),
    private readonly complaints = new ComplaintService()
  ) {}

  complaintSubmitted(complaint: Complaint): Promise<number> {
    return this.repository.createMany([{
      recipientUserId: complaint.citizenUserId,
      complaintId: complaint.id,
      eventType: "COMPLAINT_SUBMITTED",
      deduplicationKey: `complaint:${complaint.id}:submitted:${complaint.citizenUserId}`,
      title: "Complaint submitted",
      message: `${complaint.referenceNumber} was received and is awaiting classification review.`,
      metadata: { path: `/complaints/${complaint.id}`, referenceNumber: complaint.referenceNumber }
    }]);
  }

  async complaintAssigned(complaint: Complaint): Promise<number> {
    const drafts: NotificationDraft[] = [{
      recipientUserId: complaint.citizenUserId,
      complaintId: complaint.id,
      eventType: "COMPLAINT_ASSIGNED",
      deduplicationKey: `complaint:${complaint.id}:assigned:citizen:${complaint.citizenUserId}:${complaint.assignedDepartmentId ?? "none"}`,
      title: "Complaint routed",
      message: `${complaint.referenceNumber} was classified and routed to the responsible department.`,
      metadata: { path: `/complaints/${complaint.id}`, referenceNumber: complaint.referenceNumber }
    }];
    if (complaint.assignedDepartmentId) {
      const departmentUserId = await this.departments.findActiveAccountUserIdForDepartment(
        complaint.assignedDepartmentId
      );
      if (departmentUserId) {
        drafts.push({
          recipientUserId: departmentUserId,
          complaintId: complaint.id,
          eventType: "COMPLAINT_ASSIGNED",
          deduplicationKey: `complaint:${complaint.id}:assigned:department:${departmentUserId}:${complaint.assignedDepartmentId}`,
          title: "New complaint assigned",
          message: `${complaint.referenceNumber} is now assigned to your department.`,
          metadata: { path: `/complaints/${complaint.id}`, referenceNumber: complaint.referenceNumber }
        });
      }
    }
    return this.repository.createMany(drafts);
  }

  complaintStatusChanged(complaint: Complaint): Promise<number> {
    const title = complaint.status === "RESOLVED"
      ? "Complaint resolved"
      : complaint.status === "CLOSED"
        ? "Complaint closed"
        : "Complaint status updated";
    return this.repository.createMany([{
      recipientUserId: complaint.citizenUserId,
      complaintId: complaint.id,
      eventType: "COMPLAINT_STATUS_CHANGED",
      deduplicationKey: `complaint:${complaint.id}:status:${complaint.status}:version:${complaint.version}:${complaint.citizenUserId}`,
      title,
      message: `${complaint.referenceNumber} is now ${statusLabel(complaint.status)}.`,
      metadata: {
        path: `/complaints/${complaint.id}`,
        referenceNumber: complaint.referenceNumber,
        status: complaint.status
      }
    }]);
  }

  async reassignmentRequested(request: ReassignmentRequestRecord): Promise<number> {
    const administratorIds = await this.accounts.listActiveAdministratorIds();
    return this.repository.createMany(administratorIds.map((recipientUserId) => ({
      recipientUserId,
      complaintId: request.complaintId,
      eventType: "REASSIGNMENT_REQUESTED" as const,
      deduplicationKey: `reassignment:${request.id}:requested:${recipientUserId}`,
      title: "Reassignment requested",
      message: `${request.complaintReference} has a new department reassignment request.`,
      metadata: { path: "/reassignments", requestId: request.id, referenceNumber: request.complaintReference }
    })));
  }

  async reassignmentDecided(
    request: ReassignmentRequestRecord,
    administrator: AuthPrincipal
  ): Promise<number> {
    const complaint = await this.complaints.getComplaint(request.complaintId, administrator);
    const approved = request.status === "APPROVED";
    const eventType: NotificationEventType = approved
      ? "REASSIGNMENT_APPROVED"
      : "REASSIGNMENT_REJECTED";
    const drafts: NotificationDraft[] = [{
      recipientUserId: request.requestedByUserId,
      complaintId: request.complaintId,
      eventType,
      deduplicationKey: `reassignment:${request.id}:decision:${request.status}:${request.requestedByUserId}`,
      title: approved ? "Reassignment approved" : "Reassignment rejected",
      message: approved
        ? `${request.complaintReference} was reassigned to the approved department.`
        : `${request.complaintReference} remains assigned to your department.`,
      metadata: { path: "/reassignments", requestId: request.id, referenceNumber: request.complaintReference }
    }];
    if (approved) {
      drafts.push({
        recipientUserId: complaint.citizenUserId,
        complaintId: complaint.id,
        eventType,
        deduplicationKey: `reassignment:${request.id}:decision:${request.status}:${complaint.citizenUserId}`,
        title: "Complaint reassigned",
        message: `${request.complaintReference} was transferred to another responsible department.`,
        metadata: { path: `/complaints/${complaint.id}`, requestId: request.id, referenceNumber: request.complaintReference }
      });
      if (request.approvedDepartmentId) {
        const newDepartmentUserId = await this.departments.findActiveAccountUserIdForDepartment(
          request.approvedDepartmentId
        );
        if (newDepartmentUserId) {
          drafts.push({
            recipientUserId: newDepartmentUserId,
            complaintId: complaint.id,
            eventType,
            deduplicationKey: `reassignment:${request.id}:decision:${request.status}:${newDepartmentUserId}`,
            title: "Complaint reassigned to your department",
            message: `${request.complaintReference} is now assigned to your department.`,
            metadata: { path: `/complaints/${complaint.id}`, requestId: request.id, referenceNumber: request.complaintReference }
          });
        }
      }
    }
    return this.repository.createMany(drafts);
  }
}

export class NotificationEventDispatcher {
  constructor(
    private readonly events = new NotificationEventService(),
    private readonly repository = new NotificationRepository()
  ) {}

  queue(input: {
    eventType: NotificationEventType;
    aggregateId: string;
    requestId?: string;
    task: () => Promise<unknown>;
  }): void {
    setImmediate(() => { void this.dispatchNow(input); });
  }

  async dispatchNow(input: {
    eventType: NotificationEventType;
    aggregateId: string;
    requestId?: string;
    task: () => Promise<unknown>;
  }): Promise<void> {
    try {
      await input.task();
    } catch (error) {
      const failureCode = error instanceof Error && "code" in error
        ? String((error as Error & { code: unknown }).code)
        : "NOTIFICATION_DISPATCH_FAILED";
      try {
        await this.repository.recordDispatchFailure({
          eventType: input.eventType,
          aggregateId: input.aggregateId,
          failureCode,
          ...(input.requestId ? { requestId: input.requestId } : {})
        });
      } catch {
        // The notification database itself may be unavailable; structured logging remains observable.
      }
      console.error("Notification dispatch failed.", {
        eventType: input.eventType,
        aggregateId: input.aggregateId,
        requestId: input.requestId,
        failureCode
      });
    }
  }

  get eventService(): NotificationEventService {
    return this.events;
  }
}
