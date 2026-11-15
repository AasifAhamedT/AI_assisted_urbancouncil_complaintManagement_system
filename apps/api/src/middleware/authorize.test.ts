import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { AppError } from "../common/app-error.js";
import { authorize } from "./authorize.js";

const response = {} as Response;

describe("authorize", () => {
  it("allows only configured roles", () => {
    const next = vi.fn() as NextFunction;
    const request = {
      auth: { userId: "user", email: "citizen@example.com", role: "CITIZEN", tokenVersion: 0 }
    } as Request;

    authorize("ADMINISTRATOR")(request, response, next);

    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(AppError);
    expect((next.mock.calls[0]?.[0] as AppError).statusCode).toBe(403);
  });
});

