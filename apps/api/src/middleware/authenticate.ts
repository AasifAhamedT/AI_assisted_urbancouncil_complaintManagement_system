import type { NextFunction, Request, Response } from "express";

import { AppError } from "../common/app-error.js";
import { AuthService } from "../modules/auth/auth.service.js";

const authService = new AuthService();

export const authenticate = async (
  request: Request,
  _response: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authorization = request.get("authorization");
    const [scheme, token] = authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || !token) {
      throw new AppError(401, "AUTHENTICATION_REQUIRED", "A Bearer access token is required.");
    }
    request.auth = await authService.authenticateAccessToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

