import path from "path";

import { parseRequiredArgs } from "../helpers/args.ts";
import { buildDatabase } from "./build-database.ts";
import {
  notifyDatabase,
  notifyMod,
} from "./send-discord-notifications.ts";

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
            modsDirectory: { type: "string" },
            outputDirectory: { type: "string" },
            previousDatabaseFile: { type: "string" },
          },
          required: [
            "modsDirectory",
            "outputDirectory",
            "previousDatabaseFile",
          ],
        },
      );

      const cloudflareApiToken = getRequiredEnv("CLOUDFLARE_API_TOKEN");
      getRequiredEnv("GH_TOKEN");

      await buildDatabase(
        path.resolve(values.modsDirectory),
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
          },
          required: ["databaseDirectory"],
        },
      );

      await notifyDatabase(path.resolve(values.databaseDirectory));
      break;
    }
    case "notify-mod": {
      const values = parseRequiredArgs(
        {
          args: commandArgs,
          options: {
            databaseFile: { type: "string" },
            modUniqueName: { type: "string" },
            previousVersion: { type: "string" },
          },
          required: ["databaseFile", "modUniqueName"],
        },
      );

      await notifyMod(
        path.resolve(values.databaseFile),
        values.modUniqueName,
        values.previousVersion || undefined,
      );
      break;
    }
    default:
      console.error(
        `Unknown command "${command ?? ""}". ` +
          "Usage: node src/update-database/index.ts <build|notify|notify-mod> [options...]",
      );
      process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
