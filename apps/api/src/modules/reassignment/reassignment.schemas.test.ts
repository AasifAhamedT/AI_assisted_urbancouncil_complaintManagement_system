import { describe, expect, it } from "vitest";

import {
  createReassignmentSchema,
  decideReassignmentSchema,
  reassignmentListQuerySchema
} from "./reassignment.schemas.js";

const complaintId = "30000000-0000-4000-8000-000000000001";
const departmentId = "20000000-0000-4000-8000-000000000002";

describe("reassignment schemas", () => {
  it("requires a meaningful reason and rejects client-controlled department identity", () => {
    expect(createReassignmentSchema.safeParse({
      complaintId,
      reason: "The drainage complaint belongs to the engineering department."
    }).success).toBe(true);

    expect(createReassignmentSchema.safeParse({ complaintId, reason: "too short" }).success).toBe(false);
    expect(createReassignmentSchema.safeParse({
      complaintId,
      reason: "The drainage complaint belongs to the engineering department.",
      fromDepartmentId: departmentId
    }).success).toBe(false);
  });

  it("requires an explicit active target only for approval and a reason for every decision", () => {
    expect(decideReassignmentSchema.safeParse({
      decision: "APPROVED",
      targetDepartmentId: departmentId,
      decisionReason: "Confirmed against the approved department responsibilities."
    }).success).toBe(true);
    expect(decideReassignmentSchema.safeParse({
      decision: "APPROVED",
      decisionReason: "Missing target department."
    }).success).toBe(false);
    expect(decideReassignmentSchema.safeParse({
      decision: "REJECTED",
      targetDepartmentId: departmentId,
      decisionReason: "The current assignment is correct."
    }).success).toBe(false);
  });

  it("bounds pagination and accepts only known lifecycle states", () => {
    expect(reassignmentListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(reassignmentListQuerySchema.safeParse({ status: "PENDING" }).success).toBe(true);
    expect(reassignmentListQuerySchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });
});
