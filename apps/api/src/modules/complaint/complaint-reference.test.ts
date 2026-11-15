import { describe, expect, it } from "vitest";

import { generateComplaintReference } from "./complaint-reference.js";

describe("complaint reference generation", () => {
  it("creates a non-sequential public reference with the UTC year", () => {
    const first = generateComplaintReference(new Date("2026-01-02T00:00:00Z"));
    const second = generateComplaintReference(new Date("2026-01-02T00:00:00Z"));
    expect(first).toMatch(/^KUC-2026-[23456789A-HJ-NP-Z]{8}$/);
    expect(second).not.toBe(first);
  });
});
