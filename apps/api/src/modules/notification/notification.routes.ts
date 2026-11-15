import { Router } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { NotificationController } from "./notification.controller.js";
import {
  notificationIdentifierParamsSchema,
  notificationListQuerySchema,
  updateNotificationPreferenceSchema
} from "./notification.schemas.js";

const controller = new NotificationController();
export const notificationRouter = Router();

notificationRouter.use(authenticate);
notificationRouter.get("/", validateQuery(notificationListQuerySchema), controller.list);
notificationRouter.get("/unread-count", controller.unreadCount);
notificationRouter.post("/read-all", controller.markAllRead);
notificationRouter.patch(
  "/:id/read",
  validateParams(notificationIdentifierParamsSchema),
  controller.markRead
);
notificationRouter.get("/preferences/me", controller.getPreference);
notificationRouter.put(
  "/preferences/me",
  validateBody(updateNotificationPreferenceSchema),
  controller.updatePreference
);
