import { AppError } from "../../common/app-error.js";
import type { AuthPrincipal } from "../auth/auth.types.js";
import type {
  NotificationListQuery,
  UpdateNotificationPreferenceInput
} from "./notification.schemas.js";
import { NotificationRepository } from "./notification.repository.js";

export class NotificationService {
  constructor(private readonly repository = new NotificationRepository()) {}

  async list(principal: AuthPrincipal, query: NotificationListQuery) {
    const result = await this.repository.listForUser(principal.userId, query);
    return {
      ...result,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize)
      }
    };
  }

  async unreadCount(principal: AuthPrincipal) {
    return { unreadCount: await this.repository.unreadCount(principal.userId) };
  }

  async markRead(id: string, principal: AuthPrincipal) {
    const notification = await this.repository.markRead(id, principal.userId);
    if (!notification) {
      throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found.");
    }
    return notification;
  }

  async markAllRead(principal: AuthPrincipal) {
    return { updated: await this.repository.markAllRead(principal.userId) };
  }

  async getPreference(principal: AuthPrincipal) {
    return (await this.repository.findPreference(principal.userId)) ?? {
      userId: principal.userId,
      inAppEnabled: true,
      emailEnabled: false as const,
      smsEnabled: false as const,
      updatedAt: null
    };
  }

  async updatePreference(input: UpdateNotificationPreferenceInput, principal: AuthPrincipal) {
    await this.repository.upsertPreference(principal.userId, input.inAppEnabled);
    return (await this.repository.findPreference(principal.userId))!;
  }
}
