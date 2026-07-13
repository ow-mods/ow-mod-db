import { parseArgs } from "util";
import fs, { promises as fsp, writeFile } from "fs";
import path from "path";

import { fetchMods } from "./fetch-mods.ts";
import { fetchModManager, type ModManagerOutput } from "./fetch-mod-manager.ts";
import { toJsonString } from "../helpers/to-json-string.ts";
import { getInstallCounts } from "./get-install-counts.ts";
import { getSettledResult } from "../helpers/promises.ts";
import { apiCallCount, rateLimitReached } from "./octokit.ts";
import { DATABASE_FILE_NAME } from "../constants.ts";
import type { OutputMod } from "../mod.ts";

const { values: { outDirectory, modsFile, previousDatabaseFile } } = parseArgs({
  options: {
    outDirectory: { type: "string" },
    modsFile: { type: "string" },
    previousDatabaseFile: { type: "string" },
  },
});

const cloudflareApiToken = process.env.CLOUDFLARE_API_TOKEN ?? "";

if (!outDirectory || !modsFile || !previousDatabaseFile) {
  console.error(
    "Usage: node src/update-database/index.ts" +
    " --outDirectory <path> --modsFile <path> --previousDatabaseFile <path>",
  );
  console.error("Env: CLOUDFLARE_API_TOKEN");
  process.exit(1);
}

const measureTime = <T>(promise: Promise<T>, name: string) => {
  const initialTime = performance.now();

  promise.finally(() => {
    console.log(
      `Method "${name}" took ${performance.now() - initialTime} ms to finish.`,
    );
  });

  return promise;
};

async function getAsyncStuff(previousDatabase: OutputMod[]) {
  const mods = (await fsp.readFile(modsFile!)).toString();

  const promises = [
    measureTime(fetchModManager(), "fetchModManager"),
    measureTime(
      fetchMods(mods, outDirectory!, previousDatabase),
      "fetchMods",
    ),
    measureTime(getInstallCounts(30, cloudflareApiToken), "getInstallCounts30"),
    measureTime(getInstallCounts(8, cloudflareApiToken), "getInstallCounts8"),
  ] as const;

  const [modManager, nextDatabase, installCounts, weeklyInstallCounts] =
    await Promise.allSettled(promises);

  if (nextDatabase.status === "rejected") {
    throw new Error(`Failed to update database: ${nextDatabase.reason}`);
  }

  return {
    modManager: getSettledResult(modManager),
    nextDatabase: nextDatabase.value,
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
    await fsp.readFile(previousDatabaseFile!)
  ).toString();

  const previousDatabaseOutput: DatabaseOutput =
    JSON.parse(previousDatabaseJson);

  const previousMods = [
    ...previousDatabaseOutput.releases,
    ...previousDatabaseOutput.alphaReleases,
  ];

  try {
    const { modManager, nextDatabase, installCounts, weeklyInstallCounts } =
      await getAsyncStuff(previousMods);

    if (!modManager) {
      throw new Error("Failed to update database: mod manager output is null.");
    }

    const modListWithAnalytics = nextDatabase.map((mod) => ({
      ...mod,
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
      console.error("Rate limit reached");
      process.exit(1);
    }

    const outputDirectoryPath = outDirectory!;

    if (!fs.existsSync(outputDirectoryPath)) {
      await fsp.mkdir(outputDirectoryPath, { recursive: true });
    }

    writeFile(
      path.join(outputDirectoryPath, DATABASE_FILE_NAME),
      databaseJson,
      (error) => {
        if (error) console.log("Error Saving To File:", error);
      },
    );
  } catch (error) {
    console.error(`Error running workflow script: ${error}`);
    process.exit(1);
  }
}

run();
