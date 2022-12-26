import * as core from "@actions/core";
import fs, { promises as fsp, writeFile } from "fs";
import path from "path";

import { sendDiscordNotifications } from "./send-discord-notifications";
import { fetchMods } from "./fetch-mods";
import { getDiff } from "./get-diff";
import { getPreviousDatabase } from "./get-previous-database";
import { fetchModManager } from "./fetch-mod-manager";
import { toJsonString } from "./to-json-string";
import { getViewCounts } from "./get-view-counts";
import { getInstallCounts } from "./get-install-counts";
import { getSettledResult } from "./promises";
import { rateLimitReached } from "./get-octokit";

enum Input {
  outDirectory = "out-directory",
  mods = "mods",
  discordHookUrl = "discord-hook-url",
  discordModUpdateRoleId = "discord-mod-update-role-id",
  discordNewModRoleId = "discord-new-mod-role-id",
  discordModHookUrls = "discord-mod-hook-urls",
  googleServiceAccount = "google-service-account",
}

enum Output {
  releases = "releases",
}

function getCleanedUpModList(modList: Mod[]) {
  return modList.map(
    ({ latestReleaseDescription, latestPrereleaseDescription, ...mod }) => mod
  );
}

const measureTime = <T>(promise: Promise<T>, name: string) => {
  const initialTime = performance.now();

  promise.finally(() => {
    console.log(
      `Method "${name}" took ${performance.now() - initialTime} ms to finish.`
    );
  });

  return promise;
};

async function getAsyncStuff() {
  const promises = [
    measureTime(fetchModManager(), "fetchModManager"),
    measureTime(
      fetchMods(core.getInput(Input.mods), core.getInput(Input.outDirectory)),
      "fetchMods"
    ),
    measureTime(
      getViewCounts(core.getInput(Input.googleServiceAccount)),
      "getViewCounts"
    ),
    measureTime(
      getInstallCounts(core.getInput(Input.googleServiceAccount)),
      "getInstallCounts"
    ),
    measureTime(getPreviousDatabase(), "getPreviousDatabase"),
  ] as const;

  const [
    modManager,
    nextDatabase,
    viewCounts,
    installCounts,
    previousDatabase,
  ] = await Promise.allSettled(promises);

  return {
    modManager: getSettledResult(modManager),
    nextDatabase: getSettledResult(nextDatabase) ?? [],
    viewCounts: getSettledResult(viewCounts) ?? {},
    installCounts: getSettledResult(installCounts) ?? {},
    previousDatabase: getSettledResult(previousDatabase) ?? [],
  };
}

async function run() {
  try {
    const {
      modManager,
      nextDatabase,
      viewCounts,
      installCounts,
      previousDatabase,
    } = await getAsyncStuff();

    const cleanedUpModList = getCleanedUpModList(nextDatabase);

    const modListWithAnalytics = cleanedUpModList.map((mod) => ({
      ...mod,
      viewCount: viewCounts[mod.slug] ?? 0,
      installCount: installCounts[mod.uniqueName] ?? 0,
    }));

    const databaseJson = toJsonString({
      modManager,
      releases: modListWithAnalytics.filter(({ alpha }) => !alpha),
      alphaReleases: modListWithAnalytics.filter(({ alpha }) => alpha),
    });

    if (rateLimitReached) {
      core.setFailed("Rate limit reached");
      return;
    } else {
      core.setOutput(Output.releases, databaseJson);
    }

    const outputDirectoryPath = core.getInput(Input.outDirectory);

    if (!fs.existsSync(outputDirectoryPath)) {
      await fsp.mkdir(outputDirectoryPath, { recursive: true });
    }

    writeFile(
      path.join(outputDirectoryPath, "database.json"),
      databaseJson,
      (error) => {
        if (error) console.log("Error Saving To File:", error);
      }
    );

    const discordHookUrl = core.getInput(Input.discordHookUrl);

    if (discordHookUrl) {
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
