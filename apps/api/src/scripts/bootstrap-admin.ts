import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(apiRoot, ".env.bootstrap"), override: true, quiet: true });

const schema = z.object({
  ADMIN_BOOTSTRAP_EMAIL: z.string().trim().email().transform((value) => value.toLowerCase()),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
  ADMIN_BOOTSTRAP_NAME: z.string().trim().min(2).max(150)
});

const result = schema.safeParse(process.env);
if (!result.success) {
  console.error("Administrator bootstrap configuration is invalid.");
  for (const issue of result.error.issues) {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exitCode = 1;
} else {
  const { AccountAdministrationService } = await import(
    "../modules/auth/account-administration.service.js"
  );
  const accounts = new AccountAdministrationService();
  try {
    const user = await accounts.createManagedAccount({
      role: "ADMINISTRATOR",
      email: result.data.ADMIN_BOOTSTRAP_EMAIL,
      password: result.data.ADMIN_BOOTSTRAP_PASSWORD,
      displayName: result.data.ADMIN_BOOTSTRAP_NAME,
      phoneNumber: null
    });
    console.info(`Administrator account created for ${user.email}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Administrator bootstrap failed.");
    process.exitCode = 1;
  } finally {
    await import("../config/databases.js").then(({ closeDatabasePools }) => closeDatabasePools());
  }
}

