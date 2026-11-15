import { describe, expect, it, vi } from "vitest";

import type { AuthPrincipal } from "../auth/auth.types.js";
import type { NotificationRepository } from "./notification.repository.js";
import { NotificationService } from "./notification.service.js";

const principal: AuthPrincipal = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "citizen@example.com",
  role: "CITIZEN",
  tokenVersion: 0
};

describe("notification recipient isolation", () => {
  it("always scopes list and unread count to the authenticated user", async () => {
    const listForUser = vi.fn(async () => ({ items: [], total: 0 }));
    const unreadCount = vi.fn(async () => 3);
    const service = new NotificationService({
      listForUser,
      unreadCount
    } as unknown as NotificationRepository);

    await service.list(principal, { page: 1, pageSize: 20, unreadOnly: true });
    await service.unreadCount(principal);

    expect(listForUser).toHaveBeenCalledWith(principal.userId, {
      page: 1,
      pageSize: 20,
      unreadOnly: true
    });
    expect(unreadCount).toHaveBeenCalledWith(principal.userId);
  });

  it("returns not found instead of revealing another user's notification", async () => {
    const service = new NotificationService({
      markRead: vi.fn(async () => null)
    } as unknown as NotificationRepository);

    await expect(service.markRead(
      "90000000-0000-4000-8000-000000000001",
      principal
    )).rejects.toMatchObject({ statusCode: 404, code: "NOTIFICATION_NOT_FOUND" });
  });

  it("uses secure defaults when no preference row exists", async () => {
    const service = new NotificationService({
      findPreference: vi.fn(async () => null)
    } as unknown as NotificationRepository);

    await expect(service.getPreference(principal)).resolves.toMatchObject({
      userId: principal.userId,
      inAppEnabled: true,
      emailEnabled: false,
      smsEnabled: false
    });
  });
});
