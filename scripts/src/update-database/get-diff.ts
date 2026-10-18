import type { BaseMod } from "../mod.ts";

export type NotifiedMod = {
  version: string;
  prereleaseVersion?: string;
};

export type NotifiedMods = Record<string, NotifiedMod>;

export type DiffItem =
  | {
      diffType: "release";
      nextMod: BaseMod;
      previousVersion?: string;
    }
  | {
      diffType: "prerelease";
      nextMod: BaseMod;
      previousPrereleaseVersion?: string;
    };

export function getDiff(
  notifiedMods: NotifiedMods,
  nextDatabase: BaseMod[],
): DiffItem[] {
  const diff: DiffItem[] = [];

  for (const nextMod of nextDatabase) {
    const notifiedMod = notifiedMods[nextMod.uniqueName];

    if (!notifiedMod) {
      diff.push({
        diffType: "release",
        nextMod,
      });
      continue;
    }

    if (notifiedMod.version !== nextMod.version) {
      diff.push({
        diffType: "release",
        nextMod,
        previousVersion: notifiedMod.version,
      });
    }

    if (
      nextMod.prerelease &&
      notifiedMod.prereleaseVersion !== nextMod.prerelease.version
    ) {
      diff.push({
        diffType: "prerelease",
        nextMod,
        previousPrereleaseVersion: notifiedMod.prereleaseVersion,
      });
    }
  }

  for (const diffItem of diff) {
    const { nextMod } = diffItem;

    if (diffItem.diffType === "prerelease") {
      console.log(
        `Prerelease of ${nextMod.name} by ${nextMod.author} was updated from ${diffItem.previousPrereleaseVersion ?? "none"} to ${nextMod.prerelease?.version}`,
      );
    } else if (diffItem.previousVersion) {
      console.log(
        `Mod ${nextMod.name} by ${nextMod.author} was updated from ${diffItem.previousVersion} to ${nextMod.version}`,
      );
    } else {
      console.log(`Mod ${nextMod.name} by ${nextMod.author} was added`);
    }
  }

  return diff;
}
