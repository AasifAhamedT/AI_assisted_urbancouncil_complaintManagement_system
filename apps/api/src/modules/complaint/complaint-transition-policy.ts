import { AppError } from "../../common/app-error.js";
import type { RoleCode } from "../auth/auth.types.js";
import type { ComplaintStatus } from "./complaint.types.js";

const transitions: Readonly<Record<ComplaintStatus, readonly ComplaintStatus[]>> = {
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["IN_PROGRESS", "AWAITING_INFORMATION", "REJECTED"],
  AWAITING_INFORMATION: ["UNDER_REVIEW"],
  IN_PROGRESS: ["AWAITING_INFORMATION", "RESOLVED"],
  RESOLVED: ["CLOSED", "IN_PROGRESS"],
  REJECTED: ["CLOSED", "UNDER_REVIEW"],
  CLOSED: []
};

export const assertStatusTransitionAllowed = (
  current: ComplaintStatus,
  next: ComplaintStatus,
  role: RoleCode,
  reason?: string
): void => {
  if (role !== "DEPARTMENT" && role !== "ADMINISTRATOR") {
    throw new AppError(403, "FORBIDDEN", "Citizens cannot change complaint status.");
  }
  if (!transitions[current].includes(next)) {
    throw new AppError(
      409,
      "INVALID_STATUS_TRANSITION",
      `A complaint cannot move from ${current} to ${next}.`
    );
  }
  const reasonRequired =
    role === "ADMINISTRATOR" ||
    next === "REJECTED" ||
    (current === "RESOLVED" && next === "IN_PROGRESS") ||
    (current === "REJECTED" && next === "UNDER_REVIEW");
  if (reasonRequired && !reason?.trim()) {
    throw new AppError(400, "STATUS_REASON_REQUIRED", "A reason is required for this status change.");
  }
};
