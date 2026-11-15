import { describe, expect, it } from "vitest";

import { createDepartmentAccountSchema, createDepartmentSchema } from "./department.schemas.js";

describe("department schemas", () => {
  it("accepts a configurable department definition", () => {
    expect(
      createDepartmentSchema.safeParse({ code: "PUBLIC_HEALTH", name: "Public Health Branch" }).success
    ).toBe(true);
  });

  it("rejects Department Account input containing a role override", () => {
    const result = createDepartmentAccountSchema.safeParse({
      departmentId: "20000000-0000-4000-8000-000000000002",
      email: "department@example.com",
      password: "SecurePassword123",
      displayName: "Planning Department",
      role: "ADMINISTRATOR"
    });
    expect(result.success).toBe(false);
  });
});

