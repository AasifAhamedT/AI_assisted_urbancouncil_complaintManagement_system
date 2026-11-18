import type { Request, Response } from "express";

import type { ReportQuery } from "./reporting.schemas.js";
import { ReportingService } from "./reporting.service.js";

export class ReportingController {
  constructor(private readonly service = new ReportingService()) {}

  overview = async (request: Request, response: Response) => {
    response.json({
      data: {
        report: await this.service.overview(
          request.auth!,
          request.validatedQuery as ReportQuery
        )
      }
    });
  };
}
