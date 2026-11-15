import cors from "cors";
import express from "express";
import helmet from "helmet";

import { checkDatabaseConnections } from "./config/databases.js";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error-handler.js";
import { requestId } from "./middleware/request-id.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { classificationAdminRouter } from "./modules/classification/classification.routes.js";
import { complaintRouter } from "./modules/complaint/complaint.routes.js";
import { departmentAdminRouter } from "./modules/department/department.routes.js";
import { gisRouter } from "./modules/gis/gis.routes.js";
import { knowledgeRouter } from "./modules/knowledge/knowledge.routes.js";
import { notificationRouter } from "./modules/notification/notification.routes.js";
import { reassignmentRouter } from "./modules/reassignment/reassignment.routes.js";
import { systemRouter } from "./modules/system/system.routes.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(requestId);

  app.get("/health", (_request, response) => {
    response.status(200).json({
      status: "ok",
      service: "api",
      environment: env.NODE_ENV
    });
  });

  app.get("/ready", async (_request, response) => {
    const databases = await checkDatabaseConnections();
    const ready = Object.values(databases).every(Boolean);

    response.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "not_ready",
      service: "api",
      databases
    });
  });

  app.get("/api/v1", (_request, response) => {
    response.json({
      data: {
        service: "api",
        version: "v1",
        documentation: "/docs/api"
      }
    });
  });

  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/admin", departmentAdminRouter);
  app.use("/api/v1/admin/classifications", classificationAdminRouter);
  app.use("/api/v1/complaints", complaintRouter);
  app.use("/api/v1/gis", gisRouter);
  app.use("/api/v1/knowledge", knowledgeRouter);
  app.use("/api/v1/notifications", notificationRouter);
  app.use("/api/v1/reassignments", reassignmentRouter);
  app.use("/api/v1/system", systemRouter);

  app.use((request, response) => {
    response.status(404).json({
      error: {
        code: "ROUTE_NOT_FOUND",
        message: "The requested route does not exist.",
        requestId: request.requestId
      }
    });
  });

  app.use(errorHandler);

  return app;
};

