import { Router } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ReassignmentController } from "./reassignment.controller.js";
import {
  createReassignmentSchema,
  decideReassignmentSchema,
  reassignmentIdentifierParamsSchema,
  reassignmentListQuerySchema
} from "./reassignment.schemas.js";

const controller = new ReassignmentController();
export const reassignmentRouter = Router();

reassignmentRouter.use(authenticate, authorize("DEPARTMENT", "ADMINISTRATOR"));
reassignmentRouter.post(
  "/",
  authorize("DEPARTMENT"),
  validateBody(createReassignmentSchema),
  controller.create
);
reassignmentRouter.get(
  "/",
  validateQuery(reassignmentListQuerySchema),
  controller.list
);
reassignmentRouter.get(
  "/:id",
  validateParams(reassignmentIdentifierParamsSchema),
  controller.get
);
reassignmentRouter.post(
  "/:id/decision",
  authorize("ADMINISTRATOR"),
  validateParams(reassignmentIdentifierParamsSchema),
  validateBody(decideReassignmentSchema),
  controller.decide
);
