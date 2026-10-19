import type { BaseMod } from "../mod.ts";

export type NotifiedMod = {
  version: string;
  latestReleaseDate: string;
  prerelease?: {
    version: string;
    date: string;
  };
};

export type NotifiedMods = Record<string, NotifiedMod>;

export type DiffType = "new" | "update";
export type ReleaseType = "release" | "prerelease";

export type DiffItem = {
  diffType: DiffType;
  releaseType: ReleaseType;
  nextMod: BaseMod;
  previousVersion?: string;
};

function isOlderDate(nextDate: string, previousDate: string) {
  const nextTime = Date.parse(nextDate);
  const previousTime = Date.parse(previousDate);

  return (
    Number.isFinite(nextTime) &&
    Number.isFinite(previousTime) &&
    nextTime < previousTime
  );
}

type UpdateTrack = {
  releaseType: ReleaseType;
  version: string | undefined;
  date: string | undefined;
  previousVersion: string | undefined;
  previousDate: string | undefined;
};

function getUpdateDiff(
  nextMod: BaseMod,
  {
    releaseType,
    version,
    date,
    previousVersion,
    previousDate,
  }: UpdateTrack,
): DiffItem | undefined {
  if (!version || version === previousVersion) {
    return undefined;
  }

  if (date && previousDate && isOlderDate(date, previousDate)) {
    console.warn(
      `Skipping ${releaseType} notification for ${nextMod.name}: ${version} (${date}) is older than ${previousVersion ?? "unknown"} (${previousDate})`,
    );
    return undefined;
  }

  return {
    diffType: "update",
    releaseType,
    nextMod,
    previousVersion,
  };
}

export function getDiff(
  notifiedMods: NotifiedMods,
  nextDatabase: BaseMod[],
): DiffItem[] {
  const diff: DiffItem[] = [];

  for (const nextMod of nextDatabase) {
    const notifiedMod = notifiedMods[nextMod.uniqueName];

    if (!notifiedMod) {
      diff.push({
        diffType: "new",
        releaseType: "release",
        nextMod,
      });
      continue;
    }

    const releaseDiff = getUpdateDiff(nextMod, {
      releaseType: "release",
      version: nextMod.version,
      date: nextMod.latestReleaseDate,
      previousVersion: notifiedMod.version,
      previousDate: notifiedMod.latestReleaseDate,
    });
    if (releaseDiff) {
      diff.push(releaseDiff);
    }

    const prereleaseDiff = getUpdateDiff(nextMod, {
      releaseType: "prerelease",
      version: nextMod.prerelease?.version,
      date: nextMod.prerelease?.date,
      previousVersion: notifiedMod.prerelease?.version,
      previousDate: notifiedMod.prerelease?.date,
    });
    if (prereleaseDiff) {
      diff.push(prereleaseDiff);
    }
  }

  for (const diffItem of diff) {
    const { diffType, nextMod, previousVersion, releaseType } = diffItem;
    const nextVersion =
      releaseType === "prerelease"
        ? nextMod.prerelease?.version
        : nextMod.version;
    const subject =
      releaseType === "prerelease"
        ? `Prerelease of ${nextMod.name}`
        : `Mod ${nextMod.name}`;

    if (diffType === "new") {
      console.log(`Mod ${nextMod.name} by ${nextMod.author} was added`);
    } else {
      console.log(
        `${subject} by ${nextMod.author} was updated from ${previousVersion ?? "none"} to ${nextVersion}`,
      );
    }
  }

  return diff;
}
