import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";
import { z } from "zod";

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
config({ path: resolve(apiRoot, ".env"), quiet: true });

const databaseName = z.string().regex(/^[a-z][a-z0-9_]*$/, "Invalid database name");

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  MYSQL_HOST: z.string().min(1),
  MYSQL_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  MYSQL_USER: z.string().min(1),
  MYSQL_PASSWORD: z.string().min(1),
  AUTH_DB_NAME: databaseName.default("auth_db"),
  COMPLAINT_DB_NAME: databaseName.default("complaint_db"),
  DEPARTMENT_DB_NAME: databaseName.default("department_db"),
  NOTIFICATION_DB_NAME: databaseName.default("notification_db"),
  GIS_DB_NAME: databaseName.default("gis_db"),
  REPORTING_DB_NAME: databaseName.default("reporting_db"),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  ATTACHMENT_STORAGE_PATH: z.string().min(1).default("storage/complaint-attachments"),
  MAX_ATTACHMENT_BYTES: z.coerce.number().int().positive().max(25_000_000).default(10_000_000),
  INTEGRATION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(2_000),
  AI_CLASSIFICATION_TIMEOUT_MS: z.coerce.number().int().min(500).max(120_000).default(25_000),
  AI_CLASSIFIER_BASE_URL: z.string().url(),
  RAG_BASE_URL: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info")
});

const parsedEnvironment = environmentSchema.safeParse(process.env);

if (!parsedEnvironment.success) {
  const issues = parsedEnvironment.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
  throw new Error(`Invalid API environment configuration: ${issues}`);
}

export const env = Object.freeze(parsedEnvironment.data);

