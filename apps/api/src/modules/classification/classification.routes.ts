import { Router } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ClassificationController } from "./classification.controller.js";
import {
  classificationIdentifierParamsSchema,
  classificationListQuerySchema,
  reviewClassificationSchema
} from "./classification.schemas.js";

const controller = new ClassificationController();
export const classificationAdminRouter = Router();

classificationAdminRouter.use(authenticate, authorize("ADMINISTRATOR"));
classificationAdminRouter.get("/", validateQuery(classificationListQuerySchema), controller.list);
classificationAdminRouter.get("/:id", validateParams(classificationIdentifierParamsSchema), controller.get);
classificationAdminRouter.post("/:id/retry", validateParams(classificationIdentifierParamsSchema), controller.retry);
classificationAdminRouter.post(
  "/:id/review",
  validateParams(classificationIdentifierParamsSchema),
  validateBody(reviewClassificationSchema),
  controller.review
);
