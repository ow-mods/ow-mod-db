import { parseArgs } from "util";
import { sendDiscordNotifications } from "./send-discord-notifications.ts";
import type { DiffItem } from "./get-diff.ts";
import { promises as fsp } from "fs";
import type { DatabaseOutput } from "../mod.ts";
import type { BaseMod } from "../mod.ts";

const { values: { currentDatabaseFile, modUniqueId, modPreviousVersion } } = parseArgs({
  options: {
    currentDatabaseFile: { type: "string" },
    modUniqueId: { type: "string" },
    modPreviousVersion: { type: "string" },
  },
});

const discordHookUrl = process.env.DISCORD_HOOK_URL ?? "";
const discordNewModRoleId = process.env.DISCORD_NEW_MOD_ROLE_ID ?? "";
const discordModUpdateRoleId = process.env.DISCORD_MOD_UPDATE_ROLE_ID ?? "";

if (!currentDatabaseFile || !modUniqueId) {
  console.error(
    "Usage: node src/send-notifications/force-update-mod-notification.ts" +
    " --currentDatabaseFile <path> --modUniqueId <id> --modPreviousVersion <str>",
  );
  console.error("Env: DISCORD_HOOK_URL, DISCORD_NEW_MOD_ROLE_ID, DISCORD_MOD_UPDATE_ROLE_ID");
  process.exit(1);
}

async function run() {
    try {
        const currentDatabaseJson = (
            await fsp.readFile(currentDatabaseFile!)
        ).toString();

        const currentDatabaseOutput: DatabaseOutput =
            JSON.parse(previousDatabaseJson);

        const currentMods = [
            ...currentDatabaseOutput.releases,
            ...currentDatabaseOutput.alphaReleases,
        ];

        const currentMod = currentMods.find((mod) => mod.uniqueName == modUniqueId!);

        if (currentMod === undefined) {
            throw new Error(modUniqueId! + " was not found in the database");
        }

        const previousMod = { ...currentMod }
        previousMod.version = modPreviousVersion

        const diff: DiffItem[] = [];

        diff.push({
          diffType: "update",
          nextMod: currentMod as BaseMod,
          previousMod: previousMod as BaseMod
        });

        sendDiscordNotifications(
            discordHookUrl,
            discordModUpdateRoleId,
            discordNewModRoleId,
            diff,
            {}
        );
    } catch (error) {
        console.error(`Error running workflow script: ${error}`);
        process.exit(1);
    }
}

run();