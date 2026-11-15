import type { Request, Response } from "express";

import type { ClassificationListQuery, ReviewClassificationInput } from "./classification.schemas.js";
import { ClassificationService } from "./classification.service.js";
import { NotificationEventDispatcher } from "../notification/notification-events.service.js";

export class ClassificationController {
  constructor(
    private readonly service = new ClassificationService(),
    private readonly notifications = new NotificationEventDispatcher()
  ) {}

  list = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.listReviewQueue(request.validatedQuery as ClassificationListQuery)
    });
  };

  get = async (request: Request, response: Response) => {
    response.json({ data: await this.service.getReviewDetail(String(request.params.id)) });
  };

  retry = async (request: Request, response: Response) => {
    const recommendation = await this.service.classifyComplaint(
      String(request.params.id),
      request.requestId
    );
    response.json({ data: { recommendation } });
  };

  review = async (request: Request, response: Response) => {
    const result = await this.service.reviewClassification(
      String(request.params.id),
      request.body as ReviewClassificationInput,
      request.auth!.userId
    );
    response.json({ data: result });
    this.notifications.queue({
      eventType: "COMPLAINT_ASSIGNED",
      aggregateId: result.complaint.id,
      requestId: request.requestId,
      task: () => this.notifications.eventService.complaintAssigned(result.complaint)
    });
  };
}
