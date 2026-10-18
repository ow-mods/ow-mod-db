import { getModFileName, serializeModFile } from "../mod-list.ts";
import type { ModInfo } from "../mod-info.ts";
import type { ModIssueForm } from "./issue-form.ts";

type CreateModFileResult = {
  fileName: string;
  content: string;
};

export function createModFile(
  form: ModIssueForm,
  repo: string,
): CreateModFileResult {
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

  const mod: ModInfo = {
    name,
    uniqueName,
    repo,
    tags: [...tags],
  };

  if (parent !== undefined) {
    mod.parent = parent;
  }
  if (alpha.includes("Is alpha mod")) {
    mod.alpha = true;
  }
  if (authorDisplay !== undefined) {
    mod.authorDisplay = authorDisplay;
  }
  if (thumbnailUrl !== undefined) {
    mod.thumbnailUrl = thumbnailUrl;
  }
  if (dlc.includes("DLC Required") && !mod.tags.includes("requires-dlc")) {
    mod.tags.push("requires-dlc");
  }

  return {
    fileName: getModFileName(uniqueName),
    content: serializeModFile(mod),
  };
}
