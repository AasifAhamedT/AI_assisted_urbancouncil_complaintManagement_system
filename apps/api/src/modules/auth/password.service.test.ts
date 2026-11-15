import { describe, expect, it } from "vitest";

import { PasswordService } from "./password.service.js";

describe("PasswordService", () => {
  it("hashes with Argon2id and verifies only the original password", async () => {
    const service = new PasswordService();
    const hash = await service.hash("SecurePassword123");

    expect(hash).toContain("$argon2id$");
    await expect(service.verify(hash, "SecurePassword123")).resolves.toBe(true);
    await expect(service.verify(hash, "IncorrectPassword123")).resolves.toBe(false);
  });
});

