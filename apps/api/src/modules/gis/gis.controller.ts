import type { Request, Response } from "express";

import type { MarkerQuery, UpsertComplaintLocationInput } from "./gis.schemas.js";
import { GisService } from "./gis.service.js";

export class GisController {
  constructor(private readonly service = new GisService()) {}

  getLocation = async (request: Request, response: Response) => {
    const location = await this.service.getComplaintLocation(String(request.params.id), request.auth!);
    response.json({ data: { location } });
  };

  saveLocation = async (request: Request, response: Response) => {
    const location = await this.service.saveComplaintLocation(
      String(request.params.id),
      request.body as UpsertComplaintLocationInput,
      request.auth!
    );
    response.json({ data: { location } });
  };

  listMarkers = async (request: Request, response: Response) => {
    const markers = await this.service.listMarkers(request.auth!, request.validatedQuery as MarkerQuery);
    response.json({ data: { markers } });
  };
}
