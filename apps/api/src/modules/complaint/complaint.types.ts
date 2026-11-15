import type { RoleCode } from "../auth/auth.types.js";

export const complaintStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "AWAITING_INFORMATION",
  "IN_PROGRESS",
  "RESOLVED",
  "REJECTED",
  "CLOSED"
] as const;
export type ComplaintStatus = (typeof complaintStatuses)[number];

export const complaintPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type ComplaintPriority = (typeof complaintPriorities)[number];

export type ClassificationState =
  | "PENDING"
  | "RECOMMENDED"
  | "APPROVED"
  | "FAILED"
  | "MANUAL_REVIEW";

export interface Complaint {
  id: string;
  referenceNumber: string;
  citizenUserId: string;
  categoryId: string | null;
  assignedDepartmentId: string | null;
  title: string;
  description: string;
  priority: ComplaintPriority;
  status: ComplaintStatus;
  classificationState: ClassificationState;
  classificationReviewRequired: boolean;
  version: number;
  submittedAt: Date;
  resolvedAt: Date | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ComplaintHistoryEntry {
  id: string;
  complaintId: string;
  previousStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus;
  changedByUserId: string;
  reason: string | null;
  changedAt: Date;
}

export interface ComplaintAttachment {
  id: string;
  complaintId: string;
  uploadedByUserId: string;
  originalFilename: string;
  storageKey: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED" | "FAILED";
  isActive: boolean;
  createdAt: Date;
}

export type ComplaintAccessScope =
  | { kind: "CITIZEN"; userId: string }
  | { kind: "DEPARTMENT"; departmentId: string }
  | { kind: "ADMINISTRATOR" };

export interface ComplaintListOptions {
  page: number;
  pageSize: number;
  search?: string;
  status?: ComplaintStatus;
  priority?: ComplaintPriority;
  categoryId?: string;
  sortBy: "createdAt" | "updatedAt" | "referenceNumber" | "status" | "priority";
  sortOrder: "asc" | "desc";
}

export interface ComplaintActor {
  userId: string;
  role: RoleCode;
}

export interface MapComplaintSummary {
  id: string;
  referenceNumber: string;
  title: string;
  status: ComplaintStatus;
  categoryId: string | null;
  assignedDepartmentId: string | null;
}
