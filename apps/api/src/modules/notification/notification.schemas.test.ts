import { describe, expect, it } from "vitest";

import {
  notificationListQuerySchema,
  updateNotificationPreferenceSchema
} from "./notification.schemas.js";

describe("notification schemas", () => {
  it("applies bounded list defaults and parses the unread filter explicitly", () => {
    expect(notificationListQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
      unreadOnly: false
    });
    expect(notificationListQuerySchema.parse({ unreadOnly: "true" }).unreadOnly).toBe(true);
    expect(notificationListQuerySchema.safeParse({ unreadOnly: "yes" }).success).toBe(false);
    expect(notificationListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("accepts only the implemented in-app preference", () => {
    expect(updateNotificationPreferenceSchema.safeParse({ inAppEnabled: false }).success).toBe(true);
    expect(updateNotificationPreferenceSchema.safeParse({
      inAppEnabled: true,
      emailEnabled: true
    }).success).toBe(false);
  });
});
