import type { InternalMod, OutputMod } from "../mod.js";

export type DiffItem =
  | {
      nextMod: InternalMod;
      diffType: "add";
    }
  | {
      previousMod: OutputMod;
      nextMod: InternalMod;
      diffType: "update";
    }
  | {
      previousMod?: OutputMod;
      nextMod: InternalMod;
      diffType: "update-prerelease";
    };

export function getDiff(
  previousDatabase: OutputMod[],
  nextDatabase: InternalMod[]
) {
  const diff: DiffItem[] = [];

  for (const nextDatabaseMod of nextDatabase) {
    const previousDatabaseMod = previousDatabase.find(
      (mod) => mod.uniqueName === nextDatabaseMod.uniqueName
    );

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

    if (
      nextDatabaseMod.prerelease &&
      previousDatabaseMod?.prerelease?.version !==
        nextDatabaseMod.prerelease.version
    ) {
      diff.push({
        diffType: "update-prerelease",
        previousMod: previousDatabaseMod,
        nextMod: nextDatabaseMod,
      });
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
        break;
      case "update-prerelease":
        console.log(
          `Prerelease of ${diffItem.nextMod.name} by ${diffItem.nextMod.author} was updated from ${diffItem.previousMod?.prerelease?.version} to ${diffItem.nextMod.prerelease?.version}`
        );
        break;
    }
  }

  return diff;
}
