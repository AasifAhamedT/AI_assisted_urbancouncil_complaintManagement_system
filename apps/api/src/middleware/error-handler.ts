import type { ErrorRequestHandler } from "express";

import { AppError } from "../common/app-error.js";

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  if (
    error instanceof Error &&
    "type" in error &&
    (error as Error & { type?: string }).type === "entity.too.large"
  ) {
    response.status(413).json({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "The uploaded file exceeds the configured size limit.",
        requestId: request.requestId
      }
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "The request body contains invalid JSON.",
        requestId: request.requestId
      }
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
        requestId: request.requestId
      }
    });
    return;
  }

  console.error("Unhandled request error.", {
    requestId: request.requestId,
    method: request.method,
    path: request.path,
    error: error instanceof Error ? error.message : "Unknown error"
  });

  response.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
      requestId: request.requestId
    }
  });
};

