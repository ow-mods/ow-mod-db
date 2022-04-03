import * as core from "@actions/core";
import { sendDiscordNotifications } from "./send-discord-notifications";
import { fetchMods } from "./fetch-mods";
import { getDiff } from "./get-diff";
import { getPreviousDatabase } from "./get-previous-database";
import { fetchModManager } from "./fetch-mod-manager";
import { toJsonString } from "./to-json-string";

enum Input {
  mods = "mods",
  gitHubToken = "github-token",
  discordHookUrl = "discord-hook-url",
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
    const gitHubToken = core.getInput(Input.gitHubToken);

    const modManager = await fetchModManager(gitHubToken);

    const nextDatabase = await fetchMods(
      core.getInput(Input.mods),
      gitHubToken
    );

    const databaseJson = toJsonString({
      modManager,
      releases: getCleanedUpModList(nextDatabase),
    });
    core.setOutput(Output.releases, databaseJson);

    const discordHookUrl = core.getInput(Input.discordHookUrl);

    if (discordHookUrl) {
      const previousDatabase = await getPreviousDatabase(gitHubToken);
      const diff = getDiff(previousDatabase, nextDatabase);

      const discordModHookUrls: Record<string, string> = JSON.parse(
        core.getInput(Input.discordModHookUrls) || "{}"
      );

      sendDiscordNotifications(
        core.getInput(Input.discordHookUrl),
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
