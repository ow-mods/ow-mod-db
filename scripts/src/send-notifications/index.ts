import { parseArgs } from "util";
import { promises as fsp } from "fs";

import { sendDiscordNotifications } from "./send-discord-notifications.ts";
import { getDiff } from "./get-diff.ts";
import type { DatabaseOutput } from "../mod.ts";

const { values: { previousDatabaseFile, nextDatabaseFile } } = parseArgs({
  options: {
    previousDatabaseFile: { type: "string" },
    nextDatabaseFile: { type: "string" },
  },
});

const discordHookUrl = process.env.DISCORD_HOOK_URL;
const discordModUpdateRoleId = process.env.DISCORD_MOD_UPDATE_ROLE_ID ?? "";
const discordNewModRoleId = process.env.DISCORD_NEW_MOD_ROLE_ID ?? "";
const discordModHookUrlsRaw = process.env.DISCORD_MOD_HOOK_URLS ?? "{}";

if (!previousDatabaseFile || !nextDatabaseFile) {
  console.error(
    "Usage: node src/send-notifications/index.ts" +
    " --previousDatabaseFile <path> --nextDatabaseFile <path>",
  );
  console.error("Env: DISCORD_HOOK_URL, DISCORD_MOD_UPDATE_ROLE_ID, DISCORD_NEW_MOD_ROLE_ID, DISCORD_MOD_HOOK_URLS");
  process.exit(1);
}

async function run() {
  const previousDatabaseJson = (
    await fsp.readFile(previousDatabaseFile!)
  ).toString();

  const previousDatabaseOutput: DatabaseOutput =
    JSON.parse(previousDatabaseJson);

  const previousMods = [
    ...previousDatabaseOutput.releases,
    ...previousDatabaseOutput.alphaReleases,
  ];

  const nextDatabaseJson = (
    await fsp.readFile(nextDatabaseFile!)
  ).toString();

  const nextDatabaseOutput: DatabaseOutput = JSON.parse(nextDatabaseJson);

  const nextMods = [
    ...nextDatabaseOutput.releases,
    ...nextDatabaseOutput.alphaReleases,
  ];

  try {
    if (discordHookUrl) {
      const diff = getDiff(previousMods, nextMods);

      const discordModHookUrls: Record<string, string> = JSON.parse(
        discordModHookUrlsRaw
      );

      sendDiscordNotifications(
        discordHookUrl,
        discordModUpdateRoleId,
        discordNewModRoleId,
        diff,
        discordModHookUrls
      );
    }
  } catch (error) {
    console.error(`Error running workflow script: ${error}`);
    process.exit(1);
  }
}

run();
