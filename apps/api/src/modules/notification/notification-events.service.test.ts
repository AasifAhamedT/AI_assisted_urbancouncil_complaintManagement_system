import { describe, expect, it, vi } from "vitest";

import type { AccountAdministrationService } from "../auth/account-administration.service.js";
import type { ComplaintService } from "../complaint/complaint.service.js";
import type { Complaint } from "../complaint/complaint.types.js";
import type { DepartmentService } from "../department/department.service.js";
import {
  NotificationEventDispatcher,
  NotificationEventService
} from "./notification-events.service.js";
import type { NotificationRepository } from "./notification.repository.js";

const complaint: Complaint = {
  id: "30000000-0000-4000-8000-000000000001",
  referenceNumber: "KUC-2026-NOTIFY01",
  citizenUserId: "10000000-0000-4000-8000-000000000001",
  categoryId: "40000000-0000-4000-8000-000000000001",
  assignedDepartmentId: "20000000-0000-4000-8000-000000000001",
  title: "Notification verification complaint",
  description: "A complaint used to verify notification event recipients and content.",
  priority: "NORMAL",
  status: "UNDER_REVIEW",
  classificationState: "APPROVED",
  classificationReviewRequired: false,
  version: 2,
  submittedAt: new Date(),
  resolvedAt: null,
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date()
};

describe("notification event integration", () => {
  it("notifies the owning Citizen and active Department Account after final assignment", async () => {
    const createMany = vi.fn(async () => 2);
    const service = new NotificationEventService(
      { createMany } as unknown as NotificationRepository,
      {
        findActiveAccountUserIdForDepartment: vi.fn(async () =>
          "10000000-0000-4000-8000-000000000002")
      } as unknown as DepartmentService,
      {} as AccountAdministrationService,
      {} as ComplaintService
    );

    await service.complaintAssigned(complaint);

    expect(createMany).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        recipientUserId: complaint.citizenUserId,
        eventType: "COMPLAINT_ASSIGNED"
      }),
      expect.objectContaining({
        recipientUserId: "10000000-0000-4000-8000-000000000002",
        eventType: "COMPLAINT_ASSIGNED"
      })
    ]));
  });

  it("uses complaint version in status-event deduplication", async () => {
    const createMany = vi.fn(async () => 1);
    const service = new NotificationEventService(
      { createMany } as unknown as NotificationRepository,
      {} as DepartmentService,
      {} as AccountAdministrationService,
      {} as ComplaintService
    );

    await service.complaintStatusChanged(complaint);

    expect(createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientUserId: complaint.citizenUserId,
        deduplicationKey: expect.stringContaining(`version:${complaint.version}`)
      })
    ]);
  });

  it("records dispatch failure without rethrowing into the originating workflow", async () => {
    const recordDispatchFailure = vi.fn(async () => undefined);
    const repository = { recordDispatchFailure } as unknown as NotificationRepository;
    const dispatcher = new NotificationEventDispatcher(
      {} as NotificationEventService,
      repository
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(dispatcher.dispatchNow({
      eventType: "COMPLAINT_STATUS_CHANGED",
      aggregateId: complaint.id,
      requestId: "notification-test",
      task: vi.fn(async () => { throw Object.assign(new Error("unavailable"), { code: "DB_DOWN" }); })
    })).resolves.toBeUndefined();

    expect(recordDispatchFailure).toHaveBeenCalledWith(expect.objectContaining({
      eventType: "COMPLAINT_STATUS_CHANGED",
      aggregateId: complaint.id,
      failureCode: "DB_DOWN"
    }));
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
