import { Router } from "express";

import { validateQuery } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { ReportingController } from "./reporting.controller.js";
import { reportQuerySchema } from "./reporting.schemas.js";

const controller = new ReportingController();
export const reportingRouter = Router();

reportingRouter.use(authenticate, authorize("DEPARTMENT", "ADMINISTRATOR"));
reportingRouter.get("/overview", validateQuery(reportQuerySchema), controller.overview);
