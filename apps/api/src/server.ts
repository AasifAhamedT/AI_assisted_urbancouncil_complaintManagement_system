import { createApp } from "./app.js";
import { closeDatabasePools } from "./config/databases.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.info(`API listening on http://${env.API_HOST}:${env.API_PORT}`);
});

const shutdown = (signal: string) => {
  console.info(`${signal} received; shutting down API.`);
  server.close(async (error) => {
    if (error) {
      console.error("API shutdown failed.", error);
      process.exitCode = 1;
      return;
    }

    await closeDatabasePools();
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

