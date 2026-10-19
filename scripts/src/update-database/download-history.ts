import { promises as fsp } from "node:fs";
import path from "node:path";

import {
  DOWNLOAD_HISTORY_DIRECTORY,
  LEGACY_DOWNLOAD_HISTORY_URL,
  MOD_MANAGER_REPO_URL,
} from "../config.ts";
import type { BaseMod, OutputModManager } from "../mod.ts";

export type DownloadHistoryPoint = {
  unixTimestamp: number;
  downloadCount: number;
};

export type DownloadHistoryEntry = {
  repo: string;
  updates: DownloadHistoryPoint[];
};

type LegacyDownloadHistoryPoint = {
  UnixTimestamp: number;
  DownloadCount: number;
};

type LegacyDownloadHistoryEntry = {
  Repo: string;
  Updates: LegacyDownloadHistoryPoint[];
};

type DownloadHistoryTuple = [number, number];

type SerializedDownloadHistoryEntry = {
  repo?: string;
  updates: DownloadHistoryTuple[];
};

type StoredDownloadHistoryEntry =
  | DownloadHistoryTuple[]
  | SerializedDownloadHistoryEntry
  | DownloadHistoryEntry
  | LegacyDownloadHistoryEntry;

type DownloadHistoryFile = DownloadHistoryEntry;

type PrimedDownloadHistory = {
  entries: Map<string, DownloadHistoryFile>;
  removedEntries: DownloadHistoryEntry[];
};

const MOD_MANAGER_HISTORY_KEY = "_mod-manager";
const REMOVED_HISTORY_FILE_NAME = "_removed.json";

// Ported from the old download history extractor:
// https://github.com/ow-mods/ow-mod-download-history/blob/main/Offsets.cs
// Keys and values are normalized to lowercase when used.
const LEGACY_REPO_ALIASES: Record<string, string[]> = {
  "https://github.com/megapiggy/cheatsmod_nocommonresources": [
    "https://github.com/pacificengine/ow_cheatsmod",
  ],
  "https://github.com/ow-mods/ow-mod-manager": [
    "https://github.com/raicuparta/ow-mod-manager",
  ],
};

function normalizeLegacyEntry(
  entry: LegacyDownloadHistoryEntry,
): DownloadHistoryEntry {
  return {
    repo: entry.Repo,
    updates: entry.Updates.map((update) => ({
      unixTimestamp: update.UnixTimestamp,
      downloadCount: update.DownloadCount,
    })),
  };
}

function getStoredRepo(
  entry: { repo?: string },
  fallbackRepo: string,
) {
  return entry.repo ?? fallbackRepo;
}

function normalizeStoredEntry(
  entry: StoredDownloadHistoryEntry,
  fallbackRepo: string,
): DownloadHistoryEntry {
  if (Array.isArray(entry)) {
    return {
      repo: fallbackRepo,
      updates: entry.map(([unixTimestamp, downloadCount]) => ({
        unixTimestamp,
        downloadCount,
      })),
    };
  }

  if ("Repo" in entry) return normalizeLegacyEntry(entry);

  if (entry.updates.length === 0) {
    return { repo: getStoredRepo(entry, fallbackRepo), updates: [] };
  }

  const firstUpdate = entry.updates[0];
  if (Array.isArray(firstUpdate)) {
    return {
      repo: getStoredRepo(entry, fallbackRepo),
      updates: (entry.updates as DownloadHistoryTuple[]).map(
        ([unixTimestamp, downloadCount]) => ({ unixTimestamp, downloadCount }),
      ),
    };
  }

  return entry as DownloadHistoryEntry;
}

function serializeUpdates(entry: DownloadHistoryFile): DownloadHistoryTuple[] {
  return entry.updates.map((update) => [
    update.unixTimestamp,
    update.downloadCount,
  ]);
}

function serializeRemovedEntry(
  entry: DownloadHistoryFile,
): SerializedDownloadHistoryEntry {
  return {
    repo: entry.repo,
    updates: serializeUpdates(entry),
  };
}

function normalizeRepoUrl(repo: string) {
  return repo.trim().replace(/\/+$/, "").toLowerCase();
}

function getRepoKeys(repo: string, repoVariations: string[] = []) {
  const primaryRepo = normalizeRepoUrl(repo);
  const keys = [primaryRepo, ...repoVariations.map(normalizeRepoUrl)];

  for (const alias of LEGACY_REPO_ALIASES[primaryRepo] ?? []) {
    keys.push(normalizeRepoUrl(alias));
  }

  return [...new Set(keys)];
}

function getHistoryFilePath(historyDirectory: string, key: string) {
  return path.join(historyDirectory, `${key}.json`);
}

function mergeUpdates(
  entries: DownloadHistoryEntry[],
): DownloadHistoryPoint[] {
  const seenUpdates = new Set<string>();
  const updates: DownloadHistoryPoint[] = [];

  for (const entry of entries) {
    for (const update of entry.updates) {
      // Some mods have history under multiple repos. Keep points from all of
      // them, even if they share a timestamp, but drop exact duplicates.
      const updateKey = `${update.unixTimestamp}:${update.downloadCount}`;
      if (seenUpdates.has(updateKey)) continue;

      seenUpdates.add(updateKey);
      updates.push({ ...update });
    }
  }

  return updates.sort(
    (updateA, updateB) => updateB.unixTimestamp - updateA.unixTimestamp,
  );
}

function indexLegacyEntries(legacyEntries: DownloadHistoryEntry[]) {
  const entriesByRepo = new Map<string, DownloadHistoryFile>();

  for (const entry of legacyEntries) {
    const repoKey = normalizeRepoUrl(entry.repo);
    const existingEntry = entriesByRepo.get(repoKey);

    if (existingEntry) {
      existingEntry.updates = mergeUpdates([existingEntry, entry]);
    } else {
      entriesByRepo.set(repoKey, {
        repo: entry.repo,
        updates: mergeUpdates([entry]),
      });
    }
  }

  return entriesByRepo;
}

function buildPrimedDownloadHistory(
  legacyEntries: DownloadHistoryEntry[],
  mods: BaseMod[],
  modManager: OutputModManager,
): PrimedDownloadHistory {
  const legacyEntriesByRepo = indexLegacyEntries(legacyEntries);
  const claimedRepos = new Set<string>();
  const entries = new Map<string, DownloadHistoryFile>();

  function getHistoryForRepos(
    repo: string,
    repoVariations: string[] = [],
  ): DownloadHistoryFile {
    const repoKeys = getRepoKeys(repo, repoVariations);
    const matchingEntries: DownloadHistoryEntry[] = [];

    for (const repoKey of repoKeys) {
      const legacyEntry = legacyEntriesByRepo.get(repoKey);
      if (!legacyEntry) continue;

      claimedRepos.add(repoKey);
      matchingEntries.push(legacyEntry);
    }

    return {
      repo: repo,
      updates: mergeUpdates(matchingEntries),
    };
  }

  for (const mod of mods) {
    entries.set(
      mod.uniqueName,
      getHistoryForRepos(mod.repo, mod.repoVariations ?? []),
    );
  }

  entries.set(
    MOD_MANAGER_HISTORY_KEY,
    getHistoryForRepos(MOD_MANAGER_REPO_URL),
  );

  const removedEntries = [...legacyEntriesByRepo.entries()]
    .filter(([repoKey]) => !claimedRepos.has(repoKey))
    .map(([, entry]) => entry);

  return { entries, removedEntries };
}

async function fetchLegacyDownloadHistory() {
  console.log(`Priming download history from ${LEGACY_DOWNLOAD_HISTORY_URL}`);

  const response = await fetch(LEGACY_DOWNLOAD_HISTORY_URL);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch legacy download history: ${response.status} ${response.statusText}`,
    );
  }

  const legacyEntries: unknown = await response.json();

  if (!Array.isArray(legacyEntries)) {
    throw new Error("Legacy download history is not an array");
  }

  return (legacyEntries as LegacyDownloadHistoryEntry[]).map(
    normalizeLegacyEntry,
  );
}

function appendUpdate(
  entry: DownloadHistoryFile,
  downloadCount: number,
  unixTimestamp: number,
) {
  let changed = false;

  const latestUpdate = entry.updates[0];

  if (!latestUpdate) {
    entry.updates.unshift({
      unixTimestamp: unixTimestamp,
      downloadCount: downloadCount,
    });
    return true;
  }

  // History was collected more recently than this run (clock skew), so don't
  // insert an older point into the list.
  if (unixTimestamp < latestUpdate.unixTimestamp) {
    return changed;
  }

  if (unixTimestamp === latestUpdate.unixTimestamp) {
    if (latestUpdate.downloadCount !== downloadCount) {
      latestUpdate.downloadCount = downloadCount;
      changed = true;
    }

    return changed;
  }

  // Only write a point when the count actually changed. This keeps the history
  // file (and the git commit) small, especially since the database is rebuilt
  // every few minutes.
  if (latestUpdate.downloadCount === downloadCount) {
    return changed;
  }

  entry.updates.unshift({
    unixTimestamp: unixTimestamp,
    downloadCount: downloadCount,
  });

  return true;
}

function serializeHistoryFile(entry: DownloadHistoryFile) {
  return `${JSON.stringify(serializeUpdates(entry))}\n`;
}

async function pathExists(filePath: string) {
  try {
    await fsp.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readHistoryFile(filePath: string, fallbackRepo: string) {
  let content: string;

  try {
    content = await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }

  try {
    return normalizeStoredEntry(
      JSON.parse(content) as StoredDownloadHistoryEntry,
      fallbackRepo,
    );
  } catch (error) {
    throw new Error(`Failed to parse download history file ${filePath}: ${error}`);
  }
}

async function readCurrentDownloadHistories(
  historyDirectory: string,
  mods: BaseMod[],
  modManager: OutputModManager,
) {
  const entries = new Map<string, DownloadHistoryFile>();

  await Promise.all(
    mods.map(async (mod) => {
      const entry = await readHistoryFile(
        getHistoryFilePath(historyDirectory, mod.uniqueName),
        mod.repo,
      );

      entries.set(mod.uniqueName, entry ?? { repo: mod.repo, updates: [] });
    }),
  );

  const managerEntry = await readHistoryFile(
    getHistoryFilePath(historyDirectory, MOD_MANAGER_HISTORY_KEY),
    MOD_MANAGER_REPO_URL,
  );

  entries.set(
    MOD_MANAGER_HISTORY_KEY,
    managerEntry ?? { repo: MOD_MANAGER_REPO_URL, updates: [] },
  );

  return entries;
}

async function writeHistoryFiles(
  historyDirectory: string,
  entries: Map<string, DownloadHistoryFile>,
  keys: Iterable<string>,
) {
  await Promise.all(
    [...keys].map(async (key) => {
      const entry = entries.get(key);
      if (!entry) return;

      await fsp.writeFile(
        getHistoryFilePath(historyDirectory, key),
        serializeHistoryFile(entry),
      );
    }),
  );
}

async function writeRemovedHistory(
  historyDirectory: string,
  removedEntries: DownloadHistoryEntry[],
) {
  if (removedEntries.length === 0) return;

  removedEntries.sort((entryA, entryB) =>
    entryA.repo.localeCompare(entryB.repo),
  );

  await fsp.writeFile(
    path.join(historyDirectory, REMOVED_HISTORY_FILE_NAME),
    `${JSON.stringify(
      removedEntries.map(serializeRemovedEntry),
    )}\n`,
  );
}

function appendCurrentUpdates(
  entries: Map<string, DownloadHistoryFile>,
  mods: BaseMod[],
  modManager: OutputModManager,
  unixTimestamp: number,
) {
  const changedKeys = new Set<string>();

  for (const mod of mods) {
    const entry = entries.get(mod.uniqueName);
    if (!entry) continue;

    if (
      appendUpdate(
        entry,
        mod.downloadCount,
        unixTimestamp,
      )
    ) {
      changedKeys.add(mod.uniqueName);
    }
  }

  const managerEntry = entries.get(MOD_MANAGER_HISTORY_KEY);
  if (
    managerEntry &&
    appendUpdate(
      managerEntry,
      modManager.downloadCount,
      unixTimestamp,
    )
  ) {
    changedKeys.add(MOD_MANAGER_HISTORY_KEY);
  }

  return changedKeys;
}

async function primeDownloadHistory(
  historyDirectory: string,
  legacyEntries: DownloadHistoryEntry[],
  mods: BaseMod[],
  modManager: OutputModManager,
  unixTimestamp: number,
) {
  const { entries, removedEntries } = buildPrimedDownloadHistory(
    legacyEntries,
    mods,
    modManager,
  );

  appendCurrentUpdates(entries, mods, modManager, unixTimestamp);

  // Prime into a temporary directory so a failed run doesn't leave a partially
  // primed history that will be treated as complete next time.
  const temporaryDirectory = `${historyDirectory}.tmp`;
  await fsp.rm(temporaryDirectory, { recursive: true, force: true });
  await fsp.mkdir(temporaryDirectory, { recursive: true });

  try {
    await writeHistoryFiles(temporaryDirectory, entries, entries.keys());
    await writeRemovedHistory(temporaryDirectory, removedEntries);
    await fsp.rename(temporaryDirectory, historyDirectory);
  } catch (error) {
    await fsp.rm(temporaryDirectory, { recursive: true, force: true });
    throw error;
  }

  console.log(
    `Primed download history for ${mods.length} mods` +
      (removedEntries.length > 0
        ? ` and ${removedEntries.length} removed repos`
        : ""),
  );
}

export async function updateDownloadHistory(
  outputDirectory: string,
  mods: BaseMod[],
  modManager: OutputModManager,
  now = new Date(),
) {
  const historyDirectory = path.join(
    outputDirectory,
    DOWNLOAD_HISTORY_DIRECTORY,
  );
  const unixTimestamp = Math.floor(now.valueOf() / 1000);

  if (!(await pathExists(historyDirectory))) {
    const legacyEntries = await fetchLegacyDownloadHistory();
    await primeDownloadHistory(
      historyDirectory,
      legacyEntries,
      mods,
      modManager,
      unixTimestamp,
    );
    return;
  }

  const entries = await readCurrentDownloadHistories(
    historyDirectory,
    mods,
    modManager,
  );
  const changedKeys = appendCurrentUpdates(
    entries,
    mods,
    modManager,
    unixTimestamp,
  );

  await writeHistoryFiles(historyDirectory, entries, changedKeys);

  if (changedKeys.size > 0) {
    console.log(
      `Updated download history for ${changedKeys.size} mod${
        changedKeys.size === 1 ? "" : "s"
      }`,
    );
  }
}
