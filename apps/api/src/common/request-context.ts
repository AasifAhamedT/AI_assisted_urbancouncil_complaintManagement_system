import type { Request } from "express";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
}

export const getRequestContext = (request: Request): RequestContext => ({
  ipAddress: request.ip || null,
  userAgent: request.get("user-agent")?.slice(0, 500) ?? null
});

