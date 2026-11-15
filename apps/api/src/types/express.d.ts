import type { AuthPrincipal } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPrincipal;
      requestId: string;
      validatedQuery?: unknown;
    }
  }
}

export {};

