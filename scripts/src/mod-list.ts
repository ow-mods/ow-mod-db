import { promises as fsp } from "node:fs";
import path from "node:path";

import type { ModInfo } from "./mod-info.ts";

export const MODS_DIRECTORY_NAME = "mods";
export const MOD_SCHEMA_FILE_NAME = "mod.schema.json";
export const MOD_SCHEMA_REFERENCE = `./${MOD_SCHEMA_FILE_NAME}`;

const MOD_FILE_EXTENSION = ".json";

export type ModFile = {
  fileName: string;
  content: string;
  mod: ModInfo;
};

export function getModFileName(uniqueName: string) {
  return `${uniqueName}${MOD_FILE_EXTENSION}`;
}

function sortFields(mod: ModInfo) {
  const { $schema: _schema, ...fields } = mod;

  return Object.fromEntries(
    Object.entries(fields).sort(([fieldA], [fieldB]) =>
      fieldA.localeCompare(fieldB),
    ),
  );
}

export function serializeModFile(mod: ModInfo) {
  return `${JSON.stringify(
    {
      $schema: MOD_SCHEMA_REFERENCE,
      ...sortFields(mod),
    },
    null,
    2,
  )}\n`;
}

export async function readModFiles(directory: string): Promise<ModFile[]> {
  const entries = await fsp.readdir(directory, { withFileTypes: true });

  const fileNames = entries
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith(MOD_FILE_EXTENSION) &&
        entry.name !== MOD_SCHEMA_FILE_NAME,
    )
    .map((entry) => entry.name)
    .sort((fileNameA, fileNameB) =>
      fileNameA.localeCompare(fileNameB),
    );

  const modFiles = await Promise.all(
    fileNames.map(async (fileName): Promise<ModFile> => {
      const filePath = path.join(directory, fileName);
      const content = await fsp.readFile(filePath, "utf8");

      let mod: ModInfo;
      try {
        mod = JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to parse ${filePath}: ${error}`);
      }

      const expectedFileName = getModFileName(mod.uniqueName);
      if (fileName !== expectedFileName) {
        throw new Error(
          `${filePath} contains uniqueName "${mod.uniqueName}", so it should be named "${expectedFileName}".`,
        );
      }

      return { fileName, content, mod };
    }),
  );

  const modsByUniqueName = new Map<string, string>();
  for (const { fileName, mod } of modFiles) {
    const existingFileName = modsByUniqueName.get(mod.uniqueName);
    if (existingFileName) {
      throw new Error(
        `Duplicate mod uniqueName "${mod.uniqueName}" in "${existingFileName}" and "${fileName}".`,
      );
    }

    modsByUniqueName.set(mod.uniqueName, fileName);
  }

  return modFiles;
}

export async function readMods(directory: string): Promise<ModInfo[]> {
  return (await readModFiles(directory)).map(({ mod }) => mod);
}
