import { createPool, type Pool, type PoolOptions } from "mysql2/promise";

import { env } from "./env.js";

export type DatabaseOwner =
  | "auth"
  | "complaint"
  | "department"
  | "notification"
  | "gis"
  | "reporting";

const databaseNames: Record<DatabaseOwner, string> = {
  auth: env.AUTH_DB_NAME,
  complaint: env.COMPLAINT_DB_NAME,
  department: env.DEPARTMENT_DB_NAME,
  notification: env.NOTIFICATION_DB_NAME,
  gis: env.GIS_DB_NAME,
  reporting: env.REPORTING_DB_NAME
};

const commonOptions: Omit<PoolOptions, "database"> = {
  host: env.MYSQL_HOST,
  port: env.MYSQL_PORT,
  user: env.MYSQL_USER,
  password: env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60_000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  timezone: "Z",
  charset: "utf8mb4"
};

export const databasePools = Object.fromEntries(
  Object.entries(databaseNames).map(([owner, database]) => [
    owner,
    createPool({ ...commonOptions, database })
  ])
) as Record<DatabaseOwner, Pool>;

export const checkDatabaseConnections = async (): Promise<Record<DatabaseOwner, boolean>> => {
  const owners = Object.keys(databasePools) as DatabaseOwner[];
  const checks = await Promise.all(
    owners.map(async (owner) => {
      try {
        await databasePools[owner].query("SELECT 1");
        return [owner, true] as const;
      } catch (error: unknown) {
        const code =
          error instanceof Error && "code" in error
            ? String((error as Error & { code: unknown }).code)
            : "UNKNOWN_DATABASE_ERROR";
        console.error("Database readiness check failed.", { owner, code });
        return [owner, false] as const;
      }
    })
  );

  return Object.fromEntries(checks) as Record<DatabaseOwner, boolean>;
};

export const closeDatabasePools = async (): Promise<void> => {
  await Promise.all(Object.values(databasePools).map((pool) => pool.end()));
};

