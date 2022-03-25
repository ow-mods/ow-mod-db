import * as core from "@actions/core";
import { sendDiscordNotifications } from "./send-discord-notifications";
import { fetchMods } from "./fetch-mods";
import { getDiff } from "./get-diff";
import { getPreviousDatabase } from "./get-previous-database";

const JSON_INDENT = 2;

enum Input {
  mods = "mods",
  gitHubToken = "github-token",
  discordHookUrl = "discord-hook-url",
}

enum Output {
  releases = "releases",
}

async function run() {
  try {
    const gitHubToken = core.getInput(Input.gitHubToken);

    const nextDatabase = await fetchMods(
      core.getInput(Input.mods),
      gitHubToken
    );

    const databaseJson = JSON.stringify(nextDatabase, null, JSON_INDENT);
    core.setOutput(Output.releases, databaseJson);

    const previousDatabase = await getPreviousDatabase(gitHubToken);
    const diff = getDiff(previousDatabase, nextDatabase.releases);
    sendDiscordNotifications(core.getInput(Input.discordHookUrl), diff);
  } catch (error) {
    core.setFailed(error as any);
    console.log("error", error as any);
  }
}

run();
