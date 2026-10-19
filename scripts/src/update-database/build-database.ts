import { promises as fsp } from "fs";
import path from "path";

import { fetchMods } from "./fetch-mods.ts";
import { updateDownloadHistory } from "./download-history.ts";
import { fetchModManager } from "./fetch-mod-manager.ts";
import { getInstallCounts } from "./get-install-counts.ts";
import { rateLimitReached } from "../helpers/octokit.ts";
import { DATABASE_FILE_NAME } from "../config.ts";
import { readMods } from "../mod-list.ts";
import type { DatabaseOutput } from "../mod.ts";

function getSettledResult<TResult>(
  results: PromiseSettledResult<TResult>,
): TResult | undefined {
  if (results.status == "rejected") return undefined;

  return results.value;
}

export async function buildDatabase(
  modsDirectory: string,
  previousDatabaseFile: string,
  outputDirectory: string,
  cloudflareApiToken: string,
) {
  const previousDatabaseJson = (await fsp.readFile(previousDatabaseFile)).toString();

  const previousDatabaseOutput: DatabaseOutput =
    JSON.parse(previousDatabaseJson);

  const previousMods = [
    ...previousDatabaseOutput.releases,
    ...previousDatabaseOutput.alphaReleases,
  ];

  const mods = await readMods(modsDirectory);

  const [
    modManagerResult,
    nextDatabase,
    installCountsResult,
    weeklyInstallCountsResult,
  ] = await Promise.allSettled([
    fetchModManager(),
    fetchMods(mods, outputDirectory, previousMods),
    getInstallCounts(30, cloudflareApiToken),
    getInstallCounts(8, cloudflareApiToken),
  ] as const);

  if (nextDatabase.status === "rejected") {
    throw new Error(`Failed to update database: ${nextDatabase.reason}`);
  }

  const modManager = getSettledResult(modManagerResult);
  const installCounts = getSettledResult(installCountsResult) ?? {};
  const weeklyInstallCounts = getSettledResult(weeklyInstallCountsResult) ?? {};

  if (!modManager) {
    throw new Error("Failed to update database: mod manager output is null.");
  }

  const modListWithAnalytics = nextDatabase.value.map((mod) => ({
    ...mod,
    installCount: installCounts[mod.uniqueName] ?? 0,
    weeklyInstallCount: weeklyInstallCounts[mod.uniqueName] ?? 0,
  }));

  const databaseOutput: DatabaseOutput = {
    modManager,
    releases: modListWithAnalytics.filter(({ alpha }) => !alpha),
    alphaReleases: modListWithAnalytics.filter(({ alpha }) => alpha),
  };

  if (rateLimitReached) {
    throw new Error("GitHub API rate limit reached");
  }

  await fsp.mkdir(outputDirectory, { recursive: true });
  await fsp.writeFile(
    path.join(outputDirectory, DATABASE_FILE_NAME),
    JSON.stringify(databaseOutput, null, 2),
  );

  console.log(
    `Database built at ${path.join(outputDirectory, DATABASE_FILE_NAME)}`,
  );

  try {
    await updateDownloadHistory(
      outputDirectory,
      modListWithAnalytics,
      modManager,
    );
  } catch (error) {
    console.error(`Failed to update download history: ${error}`);
  }
}
