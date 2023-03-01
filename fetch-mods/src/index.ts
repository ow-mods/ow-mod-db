import * as core from "@actions/core";
import fs, { promises as fsp, writeFile } from "fs";
import path from "path";

import { sendDiscordNotifications } from "./send-discord-notifications.js";
import { fetchMods } from "./fetch-mods.js";
import { getDiff } from "./get-diff.js";
import { getPreviousDatabase } from "./get-previous-database.js";
import { fetchModManager } from "./fetch-mod-manager.js";
import { toJsonString } from "./helpers/to-json-string.js";
import { getViewCounts } from "./analytics/get-view-counts.js";
import { getInstallCounts } from "./analytics/get-install-counts.js";
import { getSettledResult } from "./helpers/promises.js";
import { apiCallCount, rateLimitReached } from "./helpers/octokit.js";
import { DATABASE_FILE_NAME } from "./constants.js";

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

async function getAsyncStuff(previousDatabase: Mod[]) {
  const googleServiceAccount = core.getInput(Input.googleServiceAccount);

  const promises = [
    measureTime(fetchModManager(), "fetchModManager"),
    measureTime(
      fetchMods(
        core.getInput(Input.mods),
        core.getInput(Input.outDirectory),
        previousDatabase
      ),
      "fetchMods"
    ),
    measureTime(getViewCounts(30, googleServiceAccount), "getViewCounts30"),
    measureTime(getViewCounts(8, googleServiceAccount), "getViewCounts8"),
    measureTime(
      getInstallCounts(30, googleServiceAccount),
      "getInstallCounts30"
    ),
    measureTime(getInstallCounts(8, googleServiceAccount), "getInstallCounts8"),
  ] as const;

  const [
    modManager,
    nextDatabase,
    viewCounts,
    weeklyViewCounts,
    installCounts,
    weeklyInstallCounts,
  ] = await Promise.allSettled(promises);

  return {
    modManager: getSettledResult(modManager),
    nextDatabase: getSettledResult(nextDatabase) ?? [],
    viewCounts: getSettledResult(viewCounts) ?? {},
    weeklyViewCounts: getSettledResult(weeklyViewCounts) ?? {},
    installCounts: getSettledResult(installCounts) ?? {},
    weeklyInstallCounts: getSettledResult(weeklyInstallCounts) ?? {},
  };
}

async function run() {
  const previousDatabase = await measureTime(
    getPreviousDatabase(),
    "getPreviousDatabase"
  );

  try {
    const {
      modManager,
      nextDatabase,
      viewCounts,
      weeklyViewCounts,
      installCounts,
      weeklyInstallCounts,
    } = await getAsyncStuff(previousDatabase);

    const cleanedUpModList = getCleanedUpModList(nextDatabase);

    const modListWithAnalytics = cleanedUpModList.map((mod) => ({
      ...mod,
      viewCount: viewCounts[mod.slug] ?? 0,
      weeklyViewCount: weeklyViewCounts[mod.slug] ?? 0,
      installCount: installCounts[mod.uniqueName] ?? 0,
      weeklyInstallCount: weeklyInstallCounts[mod.uniqueName] ?? 0,
    }));

    const databaseJson = toJsonString({
      modManager,
      releases: modListWithAnalytics.filter(({ alpha }) => !alpha),
      alphaReleases: modListWithAnalytics.filter(({ alpha }) => alpha),
    });

    if (apiCallCount > 0) {
      console.log(`Called the GitHub API ${apiCallCount} times.`);
    }

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
      path.join(outputDirectoryPath, DATABASE_FILE_NAME),
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
