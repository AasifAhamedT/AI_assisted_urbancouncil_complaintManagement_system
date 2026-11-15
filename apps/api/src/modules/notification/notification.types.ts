export const notificationEventTypes = [
  "COMPLAINT_SUBMITTED",
  "COMPLAINT_ASSIGNED",
  "COMPLAINT_STATUS_CHANGED",
  "REASSIGNMENT_REQUESTED",
  "REASSIGNMENT_APPROVED",
  "REASSIGNMENT_REJECTED"
] as const;

export type NotificationEventType = (typeof notificationEventTypes)[number];

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  complaintId: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationPreference {
  userId: string;
  inAppEnabled: boolean;
  emailEnabled: false;
  smsEnabled: false;
  updatedAt: Date | null;
}

export interface NotificationListOptions {
  page: number;
  pageSize: number;
  unreadOnly: boolean;
}

export interface NotificationDraft {
  recipientUserId: string;
  complaintId: string | null;
  eventType: NotificationEventType;
  deduplicationKey: string;
  title: string;
  message: string;
  metadata: Record<string, unknown> | null;
}
