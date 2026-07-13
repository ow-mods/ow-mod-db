import { parseArgs } from "util";
import { sendDiscordNotifications } from "./send-discord-notifications.ts";
import type { DiffItem } from "./get-diff.ts";
import { promises as fsp } from "fs";
import type { DatabaseOutput } from "../mod.ts";
import type { BaseMod } from "../mod.ts";

const { values: { currentDatabaseFile, modUniqueId } } = parseArgs({
  options: {
    currentDatabaseFile: { type: "string" },
    modUniqueId: { type: "string" },
  },
});

const discordHookUrl = process.env.DISCORD_HOOK_URL ?? "";
const discordNewModRoleId = process.env.DISCORD_NEW_MOD_ROLE_ID ?? "";
const discordModUpdateRoleId = process.env.DISCORD_MOD_UPDATE_ROLE_ID ?? "";

if (!currentDatabaseFile || !modUniqueId) {
  console.error(
    "Usage: node src/send-notifications/force-new-mod-notification.ts" +
    " --currentDatabaseFile <path> --modUniqueId <id>",
  );
  console.error("Env: DISCORD_HOOK_URL, DISCORD_NEW_MOD_ROLE_ID, DISCORD_MOD_UPDATE_ROLE_ID");
  process.exit(1);
}

async function run() {
    try {
        const previousDatabaseJson = (
            await fsp.readFile(currentDatabaseFile!)
        ).toString();

        const previousDatabaseOutput: DatabaseOutput =
            JSON.parse(previousDatabaseJson);
    
        const previousMods = [
            ...previousDatabaseOutput.releases,
            ...previousDatabaseOutput.alphaReleases,
        ];

        const newMod = previousMods.find((mod) => mod.uniqueName == modUniqueId!);

        if (newMod === undefined) {
            throw new Error(modUniqueId! + " was not found in the database");
        }

        const diff: DiffItem[] = [];

        diff.push({
          diffType: "add",
          nextMod: newMod as BaseMod,
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