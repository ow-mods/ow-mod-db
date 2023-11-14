import * as core from "@actions/core";
import fs, { promises as fsp, writeFile } from "fs";
import path from "path";

import { fetchMods } from "./fetch-mods.js";
import { fetchModManager, type ModManagerOutput } from "./fetch-mod-manager.js";
import { toJsonString } from "../helpers/to-json-string.js";
import { getViewCounts } from "./analytics/get-view-counts.js";
import { getInstallCounts } from "./analytics/get-install-counts.js";
import { getSettledResult } from "../helpers/promises.js";
import { apiCallCount, rateLimitReached } from "./octokit.js";
import { DATABASE_FILE_NAME } from "../constants.js";
import type { OutputMod } from "../mod.js";

enum Input {
  outDirectory = "out-directory",
  modsFile = "mods",
  previousDatabaseFile = "previous-database",
  googleServiceAccount = "google-service-account",
}

enum Output {
  releases = "releases",
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

async function getAsyncStuff(previousDatabase: OutputMod[]) {
  const googleServiceAccount = core.getInput(Input.googleServiceAccount);

  const mods = (await fsp.readFile(core.getInput(Input.modsFile))).toString();

  const promises = [
    measureTime(fetchModManager(), "fetchModManager"),
    measureTime(
      fetchMods(mods, core.getInput(Input.outDirectory), previousDatabase),
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

type DatabaseOutput = {
  modManager: ModManagerOutput;
  releases: OutputMod[];
  alphaReleases: OutputMod[];
};

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

  try {
    const {
      modManager,
      nextDatabase,
      viewCounts,
      weeklyViewCounts,
      installCounts,
      weeklyInstallCounts,
    } = await getAsyncStuff(previousMods);

    if (!modManager) {
      throw new Error("Failed to update database: mod manager output is null.");
    }

    const modListWithAnalytics = nextDatabase.map((mod) => ({
      ...mod,
      viewCount: viewCounts[mod.slug] ?? 0,
      weeklyViewCount: weeklyViewCounts[mod.slug] ?? 0,
      installCount: installCounts[mod.uniqueName] ?? 0,
      weeklyInstallCount: weeklyInstallCounts[mod.uniqueName] ?? 0,
    }));

    const databaseOutput: DatabaseOutput = {
      modManager,
      releases: modListWithAnalytics.filter(({ alpha }) => !alpha),
      alphaReleases: modListWithAnalytics.filter(({ alpha }) => alpha),
    };

    const databaseJson = toJsonString(databaseOutput);

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
  } catch (error) {
    core.setFailed(`Error running workflow script: ${error}`);
    console.log(`Error running workflow script: ${error}`);
  }
}

run();
