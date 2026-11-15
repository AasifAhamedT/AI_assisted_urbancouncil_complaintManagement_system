import type { Request, Response } from "express";

import { getRequestContext } from "../../common/request-context.js";
import type { LoginInput, RegisterInput } from "./auth.schemas.js";
import { AuthService } from "./auth.service.js";

export class AuthController {
  constructor(private readonly authService = new AuthService()) {}

  register = async (request: Request, response: Response): Promise<void> => {
    const user = await this.authService.registerCitizen(request.body as RegisterInput);
    response.status(201).json({ data: { user } });
  };

  login = async (request: Request, response: Response): Promise<void> => {
    const result = await this.authService.login(
      request.body as LoginInput,
      getRequestContext(request)
    );
    response.status(200).json({ data: result });
  };

  refresh = async (request: Request, response: Response): Promise<void> => {
    const tokens = await this.authService.refresh(
      String(request.body.refreshToken),
      getRequestContext(request)
    );
    response.status(200).json({ data: { tokens } });
  };

  logout = async (request: Request, response: Response): Promise<void> => {
    await this.authService.logout(
      String(request.body.refreshToken),
      getRequestContext(request)
    );
    response.status(204).send();
  };

  me = async (request: Request, response: Response): Promise<void> => {
    const user = await this.authService.getCurrentUser(request.auth!.userId);
    response.status(200).json({ data: { user } });
  };
}

