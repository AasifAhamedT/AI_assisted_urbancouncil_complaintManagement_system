import { describe, expect, it } from "vitest";

import { formatBytes, humanize } from "./format";

describe("frontend formatting", () => {
  it("turns workflow codes into readable labels", () => {
    expect(humanize("AWAITING_INFORMATION")).toBe("Awaiting information");
  });

  it("formats attachment sizes without overstating precision", () => {
    expect(formatBytes(820)).toBe("820 B");
    expect(formatBytes(1_500)).toBe("1.5 KB");
    expect(formatBytes(2_500_000)).toBe("2.5 MB");
  });
});
