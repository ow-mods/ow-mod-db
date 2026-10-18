import { promises as fsp } from "node:fs";
import path from "node:path";

import { NOTIFICATIONS_FILE_NAME } from "../config.ts";
import type { BaseMod } from "../mod.ts";
import type { DiffItem, NotifiedMod, NotifiedMods } from "./get-diff.ts";

export function getNotificationStatePath(databaseDirectory: string) {
  return path.join(databaseDirectory, NOTIFICATIONS_FILE_NAME);
}

export async function readNotificationState(
  filePath: string,
): Promise<NotifiedMods> {
  let content: string;

  try {
    content = await fsp.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `No notification state found at ${filePath}. Create it on master before sending notifications.`,
      );
    }

    throw error;
  }

  const parsed: unknown = JSON.parse(content);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid notification state in ${filePath}`);
  }

  return parsed as NotifiedMods;
}

function getNotifiedMod(mod: BaseMod): NotifiedMod {
  return {
    version: mod.version,
    ...(mod.prerelease
      ? { prereleaseVersion: mod.prerelease.version }
      : {}),
  };
}

export function applyDiffToState(
  mods: NotifiedMods,
  diff: DiffItem[],
): NotifiedMods {
  const nextMods: NotifiedMods = { ...mods };

  for (const diffItem of diff) {
    const uniqueName = diffItem.nextMod.uniqueName;

    if (diffItem.diffType === "release") {
      nextMods[uniqueName] = getNotifiedMod(diffItem.nextMod);
    } else {
      nextMods[uniqueName] = {
        ...nextMods[uniqueName],
        prereleaseVersion: diffItem.nextMod.prerelease?.version,
      };
    }
  }

  return sortMods(nextMods);
}

export async function writeNotificationState(
  filePath: string,
  mods: NotifiedMods,
) {
  await fsp.writeFile(filePath, `${JSON.stringify(sortMods(mods), null, 2)}\n`);
}

function sortMods(mods: NotifiedMods): NotifiedMods {
  return Object.fromEntries(
    Object.entries(mods).sort(([uniqueNameA], [uniqueNameB]) =>
      uniqueNameA.localeCompare(uniqueNameB),
    ),
  );
}
