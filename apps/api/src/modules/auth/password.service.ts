import argon2 from "argon2";

const hashOptions = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1
} as const;

export class PasswordService {
  private readonly dummyHash = argon2.hash("Dummy-password-123456789", hashOptions);

  hash(password: string): Promise<string> {
    return argon2.hash(password, hashOptions);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async consumeDummyVerification(password: string): Promise<void> {
    await argon2.verify(await this.dummyHash, password);
  }
}

