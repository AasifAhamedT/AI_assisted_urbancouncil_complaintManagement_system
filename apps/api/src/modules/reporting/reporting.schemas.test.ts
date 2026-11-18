import { describe, expect, it, vi } from "vitest";

import { reportQuerySchema } from "./reporting.schemas.js";

describe("reporting query schema", () => {
  it("uses an inclusive 30-day default period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-16T08:00:00.000Z"));
    expect(reportQuerySchema.parse({})).toMatchObject({
      from: "2026-10-18",
      to: "2026-11-16",
      bucket: "day"
    });
    vi.useRealTimers();
  });

  it("accepts supported filters and rejects invalid periods", () => {
    expect(reportQuerySchema.safeParse({
      from: "2026-01-01",
      to: "2026-03-31",
      bucket: "week",
      status: "IN_PROGRESS",
      categoryId: "20000000-0000-4000-8000-000000000001"
    }).success).toBe(true);
    expect(reportQuerySchema.safeParse({ from: "2026-02-30", to: "2026-03-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2026-04-02", to: "2026-04-01" }).success).toBe(false);
    expect(reportQuerySchema.safeParse({ from: "2025-01-01", to: "2026-01-02" }).success).toBe(false);
  });
});
