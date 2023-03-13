import * as core from "@actions/core";
import { promises as fsp } from "fs";

import { sendDiscordNotifications } from "./send-discord-notifications.js";
import { getDiff } from "./get-diff.js";
import type { DatabaseOutput } from "../mod.js";

enum Input {
  previousDatabaseFile = "previous-database",
  nextDatabaseFile = "next-database",
  discordHookUrl = "discord-hook-url",
  discordModUpdateRoleId = "discord-mod-update-role-id",
  discordNewModRoleId = "discord-new-mod-role-id",
  discordModHookUrls = "discord-mod-hook-urls",
}

async function run() {
  const previousDatabaseJson = (
    await fsp.readFile(core.getInput(Input.previousDatabaseFile))
  ).toString();

  const previousDatabaseOutput: DatabaseOutput =
    JSON.parse(previousDatabaseJson);

  const previousMods = [
    ...previousDatabaseOutput.releases,
    ...previousDatabaseOutput.alphaReleases,
  ];

  const nextDatabaseJson = (
    await fsp.readFile(core.getInput(Input.nextDatabaseFile))
  ).toString();

  const nextDatabaseOutput: DatabaseOutput = JSON.parse(nextDatabaseJson);

  const nextMods = [
    ...nextDatabaseOutput.releases,
    ...nextDatabaseOutput.alphaReleases,
  ];

  try {
    const discordHookUrl = core.getInput(Input.discordHookUrl);

    if (discordHookUrl) {
      const diff = getDiff(previousMods, nextMods);

      const discordModHookUrls: Record<string, string> = JSON.parse(
        core.getInput(Input.discordModHookUrls) || "{}"
      );

      sendDiscordNotifications(
        discordHookUrl,
        core.getInput(Input.discordModUpdateRoleId),
        core.getInput(Input.discordNewModRoleId),
        diff,
        discordModHookUrls
      );
    }
  } catch (error) {
    core.setFailed(`Error running workflow script: ${error}`);
    console.log(`Error running workflow script: ${error}`);
  }
}

run();
