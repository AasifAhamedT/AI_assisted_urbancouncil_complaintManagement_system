import { Router, raw } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ComplaintController } from "./complaint.controller.js";
import {
  attachmentIdentifierParamsSchema,
  complaintIdentifierParamsSchema,
  complaintListQuerySchema,
  createComplaintSchema,
  updateComplaintSchema,
  updateComplaintStatusSchema
} from "./complaint.schemas.js";

const controller = new ComplaintController();
export const complaintRouter = Router();

complaintRouter.use(authenticate, authorize("CITIZEN", "DEPARTMENT", "ADMINISTRATOR"));

complaintRouter.get("/categories", controller.listCategories);
complaintRouter.post("/", authorize("CITIZEN"), validateBody(createComplaintSchema), controller.create);
complaintRouter.get("/", validateQuery(complaintListQuerySchema), controller.list);
complaintRouter.get(
  "/:id",
  validateParams(complaintIdentifierParamsSchema),
  controller.get
);
complaintRouter.patch(
  "/:id",
  authorize("CITIZEN"),
  validateParams(complaintIdentifierParamsSchema),
  validateBody(updateComplaintSchema),
  controller.update
);
complaintRouter.patch(
  "/:id/status",
  authorize("DEPARTMENT", "ADMINISTRATOR"),
  validateParams(complaintIdentifierParamsSchema),
  validateBody(updateComplaintStatusSchema),
  controller.updateStatus
);
complaintRouter.get(
  "/:id/history",
  validateParams(complaintIdentifierParamsSchema),
  controller.history
);
complaintRouter.post(
  "/:id/attachments",
  authorize("CITIZEN"),
  validateParams(complaintIdentifierParamsSchema),
  raw({ type: () => true, limit: env.MAX_ATTACHMENT_BYTES }),
  controller.uploadAttachment
);
complaintRouter.get(
  "/:id/attachments",
  validateParams(complaintIdentifierParamsSchema),
  controller.listAttachments
);
complaintRouter.get(
  "/:id/attachments/:attachmentId/content",
  validateParams(attachmentIdentifierParamsSchema),
  controller.downloadAttachment
);
