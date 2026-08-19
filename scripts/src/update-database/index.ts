import path from "path";

import { parseRequiredArgs } from "../helpers/args.ts";
import { buildDatabase } from "./build-database.ts";
import { notifyDatabase } from "./send-discord-notifications.ts";

function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    console.error(`Required env var: ${name}`);
    process.exit(1);
  }

  return value;
}

async function run() {
  const args = process.argv.slice(2);
  const command = args[0];
  const commandArgs = args.slice(1);

  switch (command) {
    case "build": {
      const values = parseRequiredArgs(
        {
          args: commandArgs,
          options: {
            modsFile: { type: "string" },
            outputDirectory: { type: "string" },
            previousDatabaseFile: { type: "string" },
          },
          required: ["modsFile", "outputDirectory", "previousDatabaseFile"],
        },
      );

      const cloudflareApiToken = getRequiredEnv("CLOUDFLARE_API_TOKEN");
      getRequiredEnv("GH_TOKEN");

      await buildDatabase(
        path.resolve(values.modsFile),
        path.resolve(values.previousDatabaseFile),
        path.resolve(values.outputDirectory),
        cloudflareApiToken,
      );
      break;
    }
    case "notify": {
      const values = parseRequiredArgs(
        {
          args: commandArgs,
          options: {
            databaseDirectory: { type: "string" },
            previousDatabaseFile: { type: "string" },
            modsFile: { type: "string" },
            previousModsFile: { type: "string" },
          },
          required: [
            "databaseDirectory",
            "previousDatabaseFile",
            "modsFile",
            "previousModsFile",
          ],
        },
      );

      await notifyDatabase(
        path.resolve(values.databaseDirectory),
        path.resolve(values.previousDatabaseFile),
        path.resolve(values.modsFile),
        path.resolve(values.previousModsFile),
      );
      break;
    }
    default:
      console.error(
        `Unknown command "${command ?? ""}". ` +
          "Usage: node src/update-database/index.ts <build|notify> [options...]",
      );
      process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
