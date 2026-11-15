import type { Request, Response } from "express";

import { SystemIntegrationService } from "./system-integration.service.js";

export class SystemController {
  constructor(private readonly integrations = new SystemIntegrationService()) {}

  integrationStatus = async (request: Request, response: Response) => {
    response.json({ data: await this.integrations.check(request.requestId) });
  };
}
