export type RoleCode = "CITIZEN" | "DEPARTMENT" | "ADMINISTRATOR";

export interface User {
  id: string;
  email: string;
  displayName: string;
  phoneNumber: string | null;
  status: "PENDING" | "ACTIVE" | "INACTIVE" | "LOCKED";
  role: RoleCode;
  createdAt: string;
  updatedAt: string;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresAt: string;
}

export interface Session {
  user: User;
  tokens: SessionTokens;
}

export type ComplaintStatus =
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AWAITING_INFORMATION"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "REJECTED"
  | "CLOSED";

export interface Complaint {
  id: string;
  referenceNumber: string;
  citizenUserId: string;
  categoryId: string | null;
  assignedDepartmentId: string | null;
  title: string;
  description: string;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: ComplaintStatus;
  classificationState: "PENDING" | "RECOMMENDED" | "APPROVED" | "FAILED" | "MANUAL_REVIEW";
  classificationReviewRequired: boolean;
  version: number;
  submittedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintHistory {
  id: string;
  complaintId: string;
  previousStatus: ComplaintStatus | null;
  newStatus: ComplaintStatus;
  changedByUserId: string;
  reason: string | null;
  changedAt: string;
}

export interface ComplaintAttachment {
  id: string;
  complaintId: string;
  uploadedByUserId: string;
  originalFilename: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED" | "FAILED";
  createdAt: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryMapping {
  id: string;
  categoryId: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
  effectiveFrom: string;
  updatedAt: string;
}

export interface DepartmentAccountMapping {
  id: string;
  userId: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
  assignedAt: string;
  user: User | null;
}

export interface IntegrationHealth {
  service: "ai-classifier" | "rag";
  reachable: boolean;
  readiness: "ready" | "configuration_required" | "unavailable" | "invalid_response";
  providerConfigured: boolean | null;
  latencyMs: number;
  failureCode?: string;
}

export interface ComplaintLocation {
  id: string;
  complaintId: string;
  latitude: number;
  longitude: number;
  addressText: string | null;
  locationDescription: string | null;
  accuracyMeters: number | null;
  source: "MAP_SELECTION" | "DEVICE_GPS" | "ADMIN_CORRECTION";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintMapMarker extends ComplaintLocation {
  referenceNumber: string;
  title: string;
  status: ComplaintStatus;
  categoryId: string | null;
  assignedDepartmentId: string | null;
  distanceMeters: number | null;
}

export interface AiRecommendation {
  id: string;
  complaintId: string;
  provider: string;
  modelName: string;
  promptVersion: string;
  recommendedCategoryId: string | null;
  confidence: number | null;
  isAmbiguous: boolean;
  explanation: string | null;
  validationStatus: "VALID" | "INVALID" | "FAILED" | "TIMEOUT";
  failureCode: string | null;
  requestedAt: string;
  completedAt: string | null;
  createdAt: string;
}

export interface ClassificationReview {
  id: string;
  complaintId: string;
  recommendationId: string | null;
  reviewedByUserId: string;
  decision: "APPROVED" | "OVERRIDDEN" | "MANUAL";
  previousCategoryId: string | null;
  finalCategoryId: string;
  wasOverridden: boolean;
  reason: string | null;
  createdAt: string;
}

export interface ClassificationQueueItem {
  id: string;
  referenceNumber: string;
  title: string;
  status: ComplaintStatus;
  categoryId: string | null;
  assignedDepartmentId: string | null;
  classificationState: Complaint["classificationState"];
  classificationReviewRequired: boolean;
  version: number;
  createdAt: string;
  recommendation: AiRecommendation | null;
}

export type ReassignmentStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface ReassignmentRequest {
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
  createdAt: string;
  decidedAt: string | null;
}

export type NotificationEventType =
  | "COMPLAINT_SUBMITTED"
  | "COMPLAINT_ASSIGNED"
  | "COMPLAINT_STATUS_CHANGED"
  | "REASSIGNMENT_REQUESTED"
  | "REASSIGNMENT_APPROVED"
  | "REASSIGNMENT_REJECTED";

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  complaintId: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: false;
  smsEnabled: false;
  updatedAt: string | null;
}

export type KnowledgeIngestionStatus = "PROCESSING" | "READY" | "FAILED";

export interface KnowledgeDocumentVersion {
  version: number;
  originalFilename: string;
  mediaType: string;
  sizeBytes: number;
  checksumSha256: string;
  status: KnowledgeIngestionStatus;
  chunkCount: number;
  versionNote: string | null;
  failureCode: string | null;
  createdByUserId: string;
  createdAt: string;
  completedAt: string | null;
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  isActive: boolean;
  currentVersion: number | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  versions: KnowledgeDocumentVersion[];
}

export interface KnowledgeCitation {
  documentId: string;
  documentTitle: string;
  version: number;
  location: string;
  excerpt: string;
}

export interface KnowledgeAnswer {
  answer: string;
  abstained: boolean;
  citations: KnowledgeCitation[];
  provider: string;
  modelName: string;
}
