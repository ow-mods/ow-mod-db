import { getModFileName, serializeModFile, type ModFile } from "../mod-list.ts";
import type { ModInfo } from "../mod-info.ts";
import type { ModIssueForm } from "./issue-form.ts";

type ModifyModListResult = {
  fileName: string;
  newContent: string;
  changed: boolean;
};

export function modifyModList(
  modFiles: ModFile[],
  form: ModIssueForm,
  repo: string,
): ModifyModListResult {
  const {
    name,
    uniqueName,
    parent,
    alpha,
    dlc,
    authorDisplay,
    tags,
    thumbnailUrl,
  } = form;

  if (!name || !uniqueName) {
    throw new Error("Invalid form format");
  }

  const existingFile = modFiles.find(
    (modFile) => modFile.mod.uniqueName === uniqueName,
  );

  const newMod: ModInfo = existingFile
    ? { ...existingFile.mod }
    : {
        name,
        uniqueName,
        repo,
        tags: [],
      };

  newMod.name = name;
  newMod.repo = repo;
  newMod.tags = [...tags];

  if (parent !== undefined) {
    newMod.parent = parent;
  }
  if (alpha.includes("Is alpha mod")) {
    newMod.alpha = true;
  }
  if (authorDisplay !== undefined) {
    newMod.authorDisplay = authorDisplay;
  }
  if (thumbnailUrl !== undefined) {
    newMod.thumbnailUrl = thumbnailUrl;
  }
  if (dlc.includes("DLC Required") && !newMod.tags.includes("requires-dlc")) {
    newMod.tags.push("requires-dlc");
  }

  const fileName = existingFile?.fileName ?? getModFileName(uniqueName);
  const newContent = serializeModFile(newMod);

  return {
    fileName,
    newContent,
    changed: newContent !== existingFile?.content,
  };
}
