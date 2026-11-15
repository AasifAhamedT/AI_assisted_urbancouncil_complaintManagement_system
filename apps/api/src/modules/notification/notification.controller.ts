import type { Request, Response } from "express";

import type {
  NotificationListQuery,
  UpdateNotificationPreferenceInput
} from "./notification.schemas.js";
import { NotificationService } from "./notification.service.js";

export class NotificationController {
  constructor(private readonly service = new NotificationService()) {}

  list = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.list(request.auth!, request.validatedQuery as NotificationListQuery)
    });
  };

  unreadCount = async (request: Request, response: Response) => {
    response.json({ data: await this.service.unreadCount(request.auth!) });
  };

  markRead = async (request: Request, response: Response) => {
    response.json({
      data: {
        notification: await this.service.markRead(String(request.params.id), request.auth!)
      }
    });
  };

  markAllRead = async (request: Request, response: Response) => {
    response.json({ data: await this.service.markAllRead(request.auth!) });
  };

  getPreference = async (request: Request, response: Response) => {
    response.json({ data: { preference: await this.service.getPreference(request.auth!) } });
  };

  updatePreference = async (request: Request, response: Response) => {
    response.json({
      data: {
        preference: await this.service.updatePreference(
          request.body as UpdateNotificationPreferenceInput,
          request.auth!
        )
      }
    });
  };
}
