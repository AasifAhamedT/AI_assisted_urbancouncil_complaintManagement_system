export const reassignmentStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
export type ReassignmentStatus = (typeof reassignmentStatuses)[number];

export interface ReassignmentRequestRecord {
  id: string;
  complaintId: string;
  complaintReference: string;
  requestedByUserId: string;
  fromDepartmentId: string;
  suggestedDepartmentId: string | null;
  approvedDepartmentId: string | null;
  reason: string;
  status: ReassignmentStatus;
  decidedByUserId: string | null;
  decisionReason: string | null;
  createdAt: Date;
  decidedAt: Date | null;
}

export type ReassignmentAccessScope =
  | { kind: "DEPARTMENT"; departmentId: string }
  | { kind: "ADMINISTRATOR" };

export interface ReassignmentListOptions {
  page: number;
  pageSize: number;
  status?: ReassignmentStatus;
}

export type CreateReassignmentResult =
  | "CREATED"
  | "COMPLAINT_NOT_FOUND"
  | "ASSIGNMENT_CHANGED"
  | "CLASSIFICATION_REVIEW_REQUIRED"
  | "COMPLAINT_CLOSED"
  | "PENDING_EXISTS";

export type DecideReassignmentResult =
  | "DECIDED"
  | "REQUEST_NOT_FOUND"
  | "REQUEST_ALREADY_DECIDED"
  | "COMPLAINT_NOT_FOUND"
  | "ASSIGNMENT_CHANGED"
  | "SAME_DEPARTMENT";
