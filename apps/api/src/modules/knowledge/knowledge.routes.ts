import { Router, raw } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { env } from "../../config/env.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { KnowledgeController } from "./knowledge.controller.js";
import {
  knowledgeIdentifierParamsSchema,
  knowledgeQuerySchema,
  knowledgeUploadQuerySchema
} from "./knowledge.schemas.js";

const controller = new KnowledgeController();
export const knowledgeRouter = Router();

knowledgeRouter.use(authenticate);
knowledgeRouter.post("/query", authorize("CITIZEN", "ADMINISTRATOR"), validateBody(knowledgeQuerySchema), controller.query);
knowledgeRouter.get("/documents", authorize("ADMINISTRATOR"), controller.list);
knowledgeRouter.post(
  "/documents",
  authorize("ADMINISTRATOR"),
  validateQuery(knowledgeUploadQuerySchema),
  raw({ type: () => true, limit: env.MAX_KNOWLEDGE_DOCUMENT_BYTES }),
  controller.upload
);
knowledgeRouter.post(
  "/documents/:id/versions",
  authorize("ADMINISTRATOR"),
  validateParams(knowledgeIdentifierParamsSchema),
  validateQuery(knowledgeUploadQuerySchema),
  raw({ type: () => true, limit: env.MAX_KNOWLEDGE_DOCUMENT_BYTES }),
  controller.uploadVersion
);
knowledgeRouter.post(
  "/documents/:id/deactivate",
  authorize("ADMINISTRATOR"),
  validateParams(knowledgeIdentifierParamsSchema),
  controller.deactivate
);
