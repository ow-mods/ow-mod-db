import path from "path";

import { parseRequiredArgs } from "../helpers/args.ts";
import { buildDatabase } from "./build-database.ts";
import {
  notifyDatabase,
  readDatabaseMods,
  sendDiffNotifications,
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
            previousDatabaseFile: { type: "string" },
          },
          required: ["databaseDirectory", "previousDatabaseFile"],
        },
      );

      await notifyDatabase(
        path.resolve(values.databaseDirectory),
        path.resolve(values.previousDatabaseFile),
      );
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
          required: ["databaseFile", "modUniqueName", "previousVersion"],
        },
      );

      const mods = await readDatabaseMods(path.resolve(values.databaseFile));
      const mod = mods.find(
        (candidate) => candidate.uniqueName === values.modUniqueName,
      );

      if (!mod) {
        console.error(
          `Mod "${values.modUniqueName}" was not found in ${values.databaseFile}`,
        );
        process.exit(1);
      }

      await sendDiffNotifications([
        {
          diffType: "update",
          nextMod: mod,
          previousMod: { ...mod, version: values.previousVersion },
        },
      ]);
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
