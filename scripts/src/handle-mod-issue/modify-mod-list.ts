import type { ModInfo, ModList } from "../mod-info.ts";
import type { ModIssueForm } from "./issue-form.ts";

type ModifyModListResult = {
  newContent: string;
  changed: boolean;
};

export function modifyModList(
  currentContent: string,
  form: ModIssueForm,
  repo: string,
): ModifyModListResult {
  const { name, uniqueName, parent, alpha, dlc, authorDisplay, tags, thumbnailUrl } =
    form;

  if (!name || !uniqueName) {
    throw new Error("Invalid form format");
  }

  const modDb: ModList = JSON.parse(currentContent);
  const mods = modDb.mods;

  const newMod: ModInfo = {
    name,
    uniqueName,
    repo,
    tags: [],
  };

  if (parent) {
    newMod.parent = parent;
  }

  if (alpha.includes("Is alpha mod")) {
    newMod.alpha = true;
  }

  if (authorDisplay) {
    newMod.authorDisplay = authorDisplay;
  }

  if (tags.length) {
    newMod.tags = [...tags];
  }

  if (dlc.includes("DLC Required")) {
    newMod.tags.push("requires-dlc");
  }

  if (thumbnailUrl) {
    newMod.thumbnailUrl = thumbnailUrl;
  }

  const existingMod = mods.find(
    (modFromList) => uniqueName === modFromList.uniqueName,
  );

  if (existingMod) {
    existingMod.name = newMod.name;
    existingMod.repo = newMod.repo;
    existingMod.parent = newMod.parent;
    existingMod.alpha = newMod.alpha;
    existingMod.authorDisplay = newMod.authorDisplay;
    existingMod.tags = newMod.tags;
    existingMod.thumbnailUrl = newMod.thumbnailUrl;
    // Fields the form can't express (like `utility`) are left untouched, so
    // editing a mod never wipes data the form has no way of setting.
  }

  const newModDb: ModList = {
    $schema: "./mods.schema.json",
    mods: existingMod ? mods : [...mods, newMod],
  };

  const newContent = JSON.stringify(newModDb, null, 2);

  return {
    newContent,
    changed: newContent !== currentContent,
  };
}
