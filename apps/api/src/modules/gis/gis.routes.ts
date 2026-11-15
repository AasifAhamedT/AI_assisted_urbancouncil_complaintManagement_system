import { Router } from "express";

import { validateBody, validateParams, validateQuery } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { GisController } from "./gis.controller.js";
import { gisComplaintParamsSchema, markerQuerySchema, upsertComplaintLocationSchema } from "./gis.schemas.js";

const controller = new GisController();
export const gisRouter = Router();

gisRouter.use(authenticate, authorize("CITIZEN", "DEPARTMENT", "ADMINISTRATOR"));
gisRouter.get("/markers", validateQuery(markerQuerySchema), controller.listMarkers);
gisRouter.get("/complaints/:id/location", validateParams(gisComplaintParamsSchema), controller.getLocation);
gisRouter.put(
  "/complaints/:id/location",
  authorize("CITIZEN", "ADMINISTRATOR"),
  validateParams(gisComplaintParamsSchema),
  validateBody(upsertComplaintLocationSchema),
  controller.saveLocation
);
