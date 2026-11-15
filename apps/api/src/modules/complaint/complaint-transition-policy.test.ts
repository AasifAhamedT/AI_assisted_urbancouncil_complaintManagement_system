import { describe, expect, it } from "vitest";

import { AppError } from "../../common/app-error.js";
import { assertStatusTransitionAllowed } from "./complaint-transition-policy.js";

describe("complaint transition policy", () => {
  it("allows an approved department transition", () => {
    expect(() => assertStatusTransitionAllowed("SUBMITTED", "UNDER_REVIEW", "DEPARTMENT"))
      .not.toThrow();
  });

  it("rejects invalid transitions and Citizen status changes", () => {
    expect(() => assertStatusTransitionAllowed("SUBMITTED", "RESOLVED", "DEPARTMENT"))
      .toThrowError(AppError);
    expect(() => assertStatusTransitionAllowed("SUBMITTED", "UNDER_REVIEW", "CITIZEN"))
      .toThrowError(AppError);
  });

  it("requires reasons for rejection, reopening, and Administrator intervention", () => {
    expect(() => assertStatusTransitionAllowed("UNDER_REVIEW", "REJECTED", "DEPARTMENT"))
      .toThrowError(/reason is required/i);
    expect(() => assertStatusTransitionAllowed("UNDER_REVIEW", "IN_PROGRESS", "ADMINISTRATOR"))
      .toThrowError(/reason is required/i);
    expect(() => assertStatusTransitionAllowed(
      "UNDER_REVIEW",
      "IN_PROGRESS",
      "ADMINISTRATOR",
      "Approved intervention"
    )).not.toThrow();
  });
});
