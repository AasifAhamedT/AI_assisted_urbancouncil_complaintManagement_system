import type { NextFunction, Request, Response } from "express";

import { AppError } from "../common/app-error.js";
import type { RoleCode } from "../modules/auth/auth.types.js";

export const authorize = (...roles: RoleCode[]) =>
  (request: Request, _response: Response, next: NextFunction): void => {
    if (!request.auth) {
      next(new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required."));
      return;
    }
    if (!roles.includes(request.auth.role)) {
      next(new AppError(403, "FORBIDDEN", "You are not permitted to perform this action."));
      return;
    }
    next();
  };

