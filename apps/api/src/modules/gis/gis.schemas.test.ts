import { describe, expect, it } from "vitest";

import { markerQuerySchema, upsertComplaintLocationSchema } from "./gis.schemas.js";

describe("GIS request validation", () => {
  it("accepts valid coordinates and rejects out-of-range coordinates", () => {
    expect(upsertComplaintLocationSchema.safeParse({ latitude: 8.49, longitude: 81.18 }).success).toBe(true);
    expect(upsertComplaintLocationSchema.safeParse({ latitude: 91, longitude: 81.18 }).success).toBe(false);
    expect(upsertComplaintLocationSchema.safeParse({ latitude: 8.49, longitude: -181 }).success).toBe(false);
  });

  it("requires complete and ordered map bounds", () => {
    expect(markerQuerySchema.safeParse({ north: "9", south: "8", east: "82", west: "81" }).success).toBe(true);
    expect(markerQuerySchema.safeParse({ north: "9" }).success).toBe(false);
    expect(markerQuerySchema.safeParse({ north: "8", south: "9", east: "82", west: "81" }).success).toBe(false);
  });

  it("requires all nearby-search values", () => {
    expect(markerQuerySchema.safeParse({ latitude: "8.49", longitude: "81.18", radiusMeters: "1000" }).success).toBe(true);
    expect(markerQuerySchema.safeParse({ latitude: "8.49", longitude: "81.18" }).success).toBe(false);
  });
});
