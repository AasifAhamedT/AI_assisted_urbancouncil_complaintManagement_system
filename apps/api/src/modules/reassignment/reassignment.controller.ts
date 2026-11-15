import type { Request, Response } from "express";

import type {
  CreateReassignmentInput,
  DecideReassignmentInput,
  ReassignmentListQuery
} from "./reassignment.schemas.js";
import { ReassignmentService } from "./reassignment.service.js";
import { NotificationEventDispatcher } from "../notification/notification-events.service.js";

export class ReassignmentController {
  constructor(
    private readonly service = new ReassignmentService(),
    private readonly notifications = new NotificationEventDispatcher()
  ) {}

  create = async (request: Request, response: Response) => {
    const reassignment = await this.service.create(
      request.body as CreateReassignmentInput,
      request.auth!
    );
    response.status(201).json({ data: { reassignment } });
    this.notifications.queue({
      eventType: "REASSIGNMENT_REQUESTED",
      aggregateId: reassignment.id,
      requestId: request.requestId,
      task: () => this.notifications.eventService.reassignmentRequested(reassignment)
    });
  };

  list = async (request: Request, response: Response) => {
    response.json({
      data: await this.service.list(
        request.auth!,
        request.validatedQuery as ReassignmentListQuery
      )
    });
  };

  get = async (request: Request, response: Response) => {
    response.json({
      data: {
        reassignment: await this.service.get(String(request.params.id), request.auth!)
      }
    });
  };

  decide = async (request: Request, response: Response) => {
    const reassignment = await this.service.decide(
      String(request.params.id),
      request.body as DecideReassignmentInput,
      request.auth!
    );
    response.json({ data: { reassignment } });
    this.notifications.queue({
      eventType: reassignment.status === "APPROVED"
        ? "REASSIGNMENT_APPROVED"
        : "REASSIGNMENT_REJECTED",
      aggregateId: reassignment.id,
      requestId: request.requestId,
      task: () => this.notifications.eventService.reassignmentDecided(
        reassignment,
        request.auth!
      )
    });
  };
}
