import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "./app-error.js";

export const validateBody = (schema: ZodType): RequestHandler =>
  (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body);

    if (!result.success) {
      next(
        new AppError(400, "VALIDATION_ERROR", "The request body is invalid.",
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
          })))
      );
      return;
    }

    request.body = result.data;
    next();
  };

export const validateParams = (schema: ZodType): RequestHandler =>
  (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.params);
    if (!result.success) {
      next(
        new AppError(400, "VALIDATION_ERROR", "The route parameters are invalid.",
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
          })))
      );
      return;
    }
    request.params = result.data as Request["params"];
    next();
  };

export const validateQuery = (schema: ZodType): RequestHandler =>
  (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.query);
    if (!result.success) {
      next(
        new AppError(400, "VALIDATION_ERROR", "The query parameters are invalid.",
          result.error.issues.map((issue) => ({
            field: issue.path.join("."),
            message: issue.message
          })))
      );
      return;
    }
    request.validatedQuery = result.data;
    next();
  };

