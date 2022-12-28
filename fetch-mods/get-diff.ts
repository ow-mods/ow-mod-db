import { happenedWithinDayCount } from "./happened-within-day-count.js";

export type DiffItem =
  | {
      nextMod: Mod;
      diffType: "add";
    }
  | {
      previousMod: Mod;
      nextMod: Mod;
      diffType: "update";
    }
  | {
      previousMod?: Mod;
      nextMod: Mod;
      diffType: "update-prerelease";
    };

export function getDiff(previousDatabase: Mod[], nextDatabase: Mod[]) {
  const diff: DiffItem[] = [];

  for (const nextDatabaseMod of nextDatabase) {
    const previousDatabaseMod = previousDatabase.find(
      (mod) => mod.uniqueName === nextDatabaseMod.uniqueName
    );

    if (happenedWithinDayCount(nextDatabaseMod.latestReleaseDate, 1)) {
      if (!previousDatabaseMod) {
        diff.push({
          diffType: "add",
          nextMod: nextDatabaseMod,
        });
        continue;
      }

      if (previousDatabaseMod.version !== nextDatabaseMod.version) {
        diff.push({
          diffType: "update",
          previousMod: previousDatabaseMod,
          nextMod: nextDatabaseMod,
        });
      }
    }

    if (
      nextDatabaseMod.prerelease &&
      previousDatabaseMod?.prerelease?.version !==
        nextDatabaseMod.prerelease.version
    ) {
      if (happenedWithinDayCount(nextDatabaseMod.prerelease.date, 1)) {
        diff.push({
          diffType: "update-prerelease",
          previousMod: previousDatabaseMod,
          nextMod: nextDatabaseMod,
        });
      }
    }
  }

  for (const diffItem of diff) {
    switch (diffItem.diffType) {
      case "add":
        console.log(
          `Mod ${diffItem.nextMod.name} by ${diffItem.nextMod.author} was added`
        );
        break;
      case "update":
        console.log(
          `Mod ${diffItem.nextMod.name} by ${diffItem.nextMod.author} was updated from ${diffItem.previousMod.version} to ${diffItem.nextMod.version}`
        );
      case "update-prerelease":
        console.log(
          `Prerelease of ${diffItem.nextMod.name} by ${diffItem.nextMod.author} was updated from ${diffItem.previousMod?.prerelease?.version} to ${diffItem.nextMod.prerelease?.version}`
        );
        break;
    }
  }

  return diff;
}
