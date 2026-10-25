import { promises as fsp } from "node:fs";
import path from "node:path";

import { Ajv } from "ajv";

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

async function createModValidator(directory: string) {
  const schemaPath = path.join(directory, MOD_SCHEMA_FILE_NAME);

  let schema: object;
  try {
    schema = JSON.parse(await fsp.readFile(schemaPath, "utf8"));
  } catch (error) {
    throw new Error(`Failed to read mod schema ${schemaPath}: ${error}`);
  }

  const ajv = new Ajv({ allErrors: true });
  return { validate: ajv.compile(schema) };
}

export async function readModFiles(directory: string): Promise<ModFile[]> {
  const { validate } = await createModValidator(directory);
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

      if (!validate(mod)) {
        const errors = (validate.errors ?? [])
          .map(({ instancePath, message, params }) => {
            const property = params.additionalProperty
              ? ` "${params.additionalProperty}"`
              : "";

            return `${instancePath || "/"}${property} ${message}`;
          })
          .join("\n");

        throw new Error(
          `${filePath} does not match ${MOD_SCHEMA_FILE_NAME}:\n${errors}`,
        );
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

  for (const { fileName, mod } of modFiles) {
    for (const recommendedMod of mod.recommendedMods ?? []) {
      if (!modsByUniqueName.has(recommendedMod)) {
        throw new Error(
          `${fileName} recommends a mod that doesn't exist in the database: "${recommendedMod}".`,
        );
      }
    }
  }

  return modFiles;
}

export async function readMods(directory: string): Promise<ModInfo[]> {
  return (await readModFiles(directory)).map(({ mod }) => mod);
}
