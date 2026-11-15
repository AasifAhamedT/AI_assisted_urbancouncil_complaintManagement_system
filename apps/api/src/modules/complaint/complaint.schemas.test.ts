import { describe, expect, it } from "vitest";

import {
  complaintListQuerySchema,
  createComplaintSchema,
  updateComplaintSchema
} from "./complaint.schemas.js";

describe("complaint schemas", () => {
  it("accepts a valid citizen complaint and rejects privilege fields", () => {
    expect(createComplaintSchema.safeParse({
      title: "Blocked roadside drain",
      description: "The roadside drain has been blocked for several days and is overflowing."
    }).success).toBe(true);

    expect(createComplaintSchema.safeParse({
      title: "Blocked roadside drain",
      description: "The roadside drain has been blocked for several days and is overflowing.",
      assignedDepartmentId: "10000000-0000-4000-8000-000000000001"
    }).success).toBe(false);
  });

  it("requires optimistic concurrency for citizen edits", () => {
    expect(updateComplaintSchema.safeParse({ title: "Updated complaint title" }).success).toBe(false);
    expect(updateComplaintSchema.safeParse({ title: "Updated complaint title", version: 0 }).success).toBe(true);
  });

  it("applies bounded pagination defaults", () => {
    const result = complaintListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 20, sortBy: "createdAt", sortOrder: "desc" });
    expect(complaintListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
});
