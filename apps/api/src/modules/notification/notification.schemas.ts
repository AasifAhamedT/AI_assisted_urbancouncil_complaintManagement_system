import { z } from "zod";

export const notificationIdentifierParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  unreadOnly: z.enum(["true", "false"]).transform((value) => value === "true").default(false)
}).strict();

export const updateNotificationPreferenceSchema = z.object({
  inAppEnabled: z.boolean()
}).strict();

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;
export type UpdateNotificationPreferenceInput = z.infer<typeof updateNotificationPreferenceSchema>;
