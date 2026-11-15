import { randomUUID } from "node:crypto";

import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { databasePools } from "../../config/databases.js";
import type {
  NotificationDraft,
  NotificationListOptions,
  NotificationPreference,
  NotificationRecord
} from "./notification.types.js";

interface NotificationRow extends RowDataPacket {
  id: string;
  recipientUserId: string;
  complaintId: string | null;
  eventType: NotificationRecord["eventType"];
  title: string;
  message: string;
  metadata: unknown;
  readAt: Date | null;
  createdAt: Date;
}
interface CountRow extends RowDataPacket { total: number }
interface PreferenceRow extends RowDataPacket {
  userId: string;
  inAppEnabled: boolean | number;
  emailEnabled: boolean | number;
  smsEnabled: boolean | number;
  updatedAt: Date;
}

const notificationColumns = `
  id, recipient_user_id AS recipientUserId, complaint_id AS complaintId,
  event_type AS eventType, title, message, metadata,
  read_at AS readAt, created_at AS createdAt`;

const parseMetadata = (metadata: unknown): Record<string, unknown> | null => {
  if (metadata === null) return null;
  if (typeof metadata === "string") {
    const parsed: unknown = JSON.parse(metadata);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  }
  return typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown>
    : null;
};

const mapNotification = (row: NotificationRow): NotificationRecord => ({
  ...row,
  metadata: parseMetadata(row.metadata)
});

export class NotificationRepository {
  private readonly pool = databasePools.notification;

  async listForUser(
    userId: string,
    options: NotificationListOptions
  ): Promise<{ items: NotificationRecord[]; total: number }> {
    const unreadCondition = options.unreadOnly ? " AND read_at IS NULL" : "";
    const [countRows] = await this.pool.execute<CountRow[]>(
      `SELECT COUNT(*) AS total FROM notifications
       WHERE recipient_user_id = ?${unreadCondition}`,
      [userId]
    );
    const [rows] = await this.pool.execute<NotificationRow[]>(
      `SELECT ${notificationColumns}
       FROM notifications
       WHERE recipient_user_id = ?${unreadCondition}
       ORDER BY created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [userId, options.pageSize, (options.page - 1) * options.pageSize]
    );
    return { items: rows.map(mapNotification), total: Number(countRows[0]?.total ?? 0) };
  }

  async unreadCount(userId: string): Promise<number> {
    const [rows] = await this.pool.execute<CountRow[]>(
      "SELECT COUNT(*) AS total FROM notifications WHERE recipient_user_id = ? AND read_at IS NULL",
      [userId]
    );
    return Number(rows[0]?.total ?? 0);
  }

  async markRead(id: string, userId: string): Promise<NotificationRecord | null> {
    await this.pool.execute(
      `UPDATE notifications SET read_at = COALESCE(read_at, CURRENT_TIMESTAMP(3))
       WHERE id = ? AND recipient_user_id = ?`,
      [id, userId]
    );
    const [rows] = await this.pool.execute<NotificationRow[]>(
      `SELECT ${notificationColumns} FROM notifications
       WHERE id = ? AND recipient_user_id = ? LIMIT 1`,
      [id, userId]
    );
    return rows[0] ? mapNotification(rows[0]) : null;
  }

  async markAllRead(userId: string): Promise<number> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP(3)
       WHERE recipient_user_id = ? AND read_at IS NULL`,
      [userId]
    );
    return result.affectedRows;
  }

  async findPreference(userId: string): Promise<NotificationPreference | null> {
    const [rows] = await this.pool.execute<PreferenceRow[]>(
      `SELECT user_id AS userId, in_app_enabled AS inAppEnabled,
              email_enabled AS emailEnabled, sms_enabled AS smsEnabled,
              updated_at AS updatedAt
       FROM notification_preferences WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    return row ? {
      userId: row.userId,
      inAppEnabled: Boolean(row.inAppEnabled),
      emailEnabled: false,
      smsEnabled: false,
      updatedAt: row.updatedAt
    } : null;
  }

  async upsertPreference(userId: string, inAppEnabled: boolean): Promise<void> {
    await this.pool.execute(
      `INSERT INTO notification_preferences
        (id, user_id, in_app_enabled, email_enabled, sms_enabled)
       VALUES (?, ?, ?, FALSE, FALSE)
       AS incoming
       ON DUPLICATE KEY UPDATE in_app_enabled = incoming.in_app_enabled`,
      [randomUUID(), userId, inAppEnabled]
    );
  }

  async createMany(drafts: NotificationDraft[]): Promise<number> {
    if (drafts.length === 0) return 0;
    const recipientIds = [...new Set(drafts.map((draft) => draft.recipientUserId))];
    const placeholders = recipientIds.map(() => "?").join(", ");
    const [preferenceRows] = await this.pool.execute<PreferenceRow[]>(
      `SELECT user_id AS userId, in_app_enabled AS inAppEnabled,
              email_enabled AS emailEnabled, sms_enabled AS smsEnabled,
              updated_at AS updatedAt
       FROM notification_preferences WHERE user_id IN (${placeholders})`,
      recipientIds
    );
    const disabled = new Set(
      preferenceRows.filter((row) => !Boolean(row.inAppEnabled)).map((row) => row.userId)
    );
    const enabledDrafts = drafts.filter((draft) => !disabled.has(draft.recipientUserId));
    if (enabledDrafts.length === 0) return 0;

    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      let created = 0;
      for (const draft of enabledDrafts) {
        const [result] = await connection.execute<ResultSetHeader>(
          `INSERT INTO notifications
            (id, recipient_user_id, complaint_id, event_type, deduplication_key,
             title, message, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           AS incoming
           ON DUPLICATE KEY UPDATE deduplication_key = incoming.deduplication_key`,
          [
            randomUUID(),
            draft.recipientUserId,
            draft.complaintId,
            draft.eventType,
            draft.deduplicationKey,
            draft.title,
            draft.message,
            draft.metadata === null ? null : JSON.stringify(draft.metadata)
          ]
        );
        created += result.affectedRows;
      }
      await connection.commit();
      return created;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async recordDispatchFailure(input: {
    eventType: string;
    aggregateId: string;
    failureCode: string;
    requestId?: string;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO notification_dispatch_failures
        (id, event_type, aggregate_id, failure_code, request_id)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), input.eventType, input.aggregateId, input.failureCode, input.requestId ?? null]
    );
  }
}
