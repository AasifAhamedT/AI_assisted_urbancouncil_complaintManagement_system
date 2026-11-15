import { Router } from "express";

import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { SystemController } from "./system.controller.js";

const controller = new SystemController();
export const systemRouter = Router();

systemRouter.use(authenticate, authorize("ADMINISTRATOR"));
systemRouter.get("/integrations", controller.integrationStatus);
