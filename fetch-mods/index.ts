import * as core from "@actions/core";
import { sendDiscordNotifications } from "./send-discord-notifications";
import { fetchMods } from "./fetch-mods";
import { getDiff } from "./get-diff";
import { getPreviousDatabase } from "./get-previous-database";
import { fetchModManager } from "./fetch-mod-manager";
import { toJsonString } from "./to-json-string";

enum Input {
  mods = "mods",
  discordHookUrl = "discord-hook-url",
  discordModUpdateRoleId = "discord-mod-update-role-id",
  discordNewModRoleId = "discord-new-mod-role-id",
  discordModHookUrls = "discord-mod-hook-urls",
}

enum Output {
  releases = "releases",
}

function getCleanedUpModList(modList: Mod[]) {
  return modList.map(
    ({ latestReleaseDescription, latestPrereleaseDescription, ...mod }) => mod
  );
}

async function run() {
  try {
    const modManager = await fetchModManager();

    const nextDatabase = await fetchMods(core.getInput(Input.mods));

    const cleanedUpModList = getCleanedUpModList(nextDatabase);

    const databaseJson = toJsonString({
      modManager,
      releases: cleanedUpModList.filter(({ alpha }) => !alpha),
      alphaReleases: cleanedUpModList.filter(({ alpha }) => alpha),
    });
    core.setOutput(Output.releases, databaseJson);

    const discordHookUrl = core.getInput(Input.discordHookUrl);

    if (discordHookUrl) {
      const previousDatabase = await getPreviousDatabase();
      const diff = getDiff(previousDatabase, nextDatabase);

      const discordModHookUrls: Record<string, string> = JSON.parse(
        core.getInput(Input.discordModHookUrls) || "{}"
      );

      sendDiscordNotifications(
        core.getInput(Input.discordHookUrl),
        core.getInput(Input.discordModUpdateRoleId),
        core.getInput(Input.discordNewModRoleId),
        diff,
        discordModHookUrls
      );
    }
  } catch (error) {
    core.setFailed(error as any);
    console.log("error", error as any);
  }
}

run();
