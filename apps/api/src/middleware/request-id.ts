import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export const requestId = (request: Request, response: Response, next: NextFunction): void => {
  const supplied = request.get("x-request-id");
  const id = supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : randomUUID();
  request.requestId = id;
  response.setHeader("x-request-id", id);
  next();
};

