import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { AppError } from "../../common/app-error.js";
import { validateBody } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { AuthController } from "./auth.controller.js";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "./auth.schemas.js";

const authController = new AuthController();

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, _response, next) =>
    next(new AppError(429, "RATE_LIMIT_EXCEEDED", "Too many registration attempts."))
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_request, _response, next) =>
    next(new AppError(429, "RATE_LIMIT_EXCEEDED", "Too many authentication attempts."))
});

export const authRouter = Router();

authRouter.post(
  "/register",
  registrationLimiter,
  validateBody(registerSchema),
  authController.register
);
authRouter.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
authRouter.post("/refresh", loginLimiter, validateBody(refreshSchema), authController.refresh);
authRouter.post("/logout", validateBody(logoutSchema), authController.logout);
authRouter.get("/me", authenticate, authController.me);

