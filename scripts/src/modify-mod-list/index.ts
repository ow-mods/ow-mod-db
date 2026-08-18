import { parseArgs } from "util";
import { readFileSync, writeFileSync } from "fs";
import type { ModInfo, ModList } from "../mod-info.ts";

const { values: { outFile } } = parseArgs({
  options: {
    outFile: { type: "string" },
  },
});

const formRaw = process.env.FORM;

// From .github/ISSUE_TEMPLATE/add-mod.yml.
type IssueForm = {
  name?: string;
  uniqueName?: string;
  repoUrl?: string;
  thumbnailUrl?: string;
  alpha?: string;
  dlc?: string;
  utility?: string;
  parent?: string;
  authorDisplay?: string;
  tags?: string;
};

function run() {
  if (!outFile || !formRaw) {
    console.error("Usage: node src/modify-mod-list/index.ts --outFile <path>");
    console.error("Env: FORM (JSON from the mod issue form)");
    process.exit(1);
  }

  const {
    name,
    repoUrl,
    uniqueName,
    parent,
    utility,
    alpha,
    dlc,
    authorDisplay,
    tags,
    thumbnailUrl,
  }: IssueForm = JSON.parse(formRaw);

  if (!name || !repoUrl || !uniqueName) {
    throw new Error("Invalid form format");
  }

  let repo = repoUrl.match(/github\.com\/([^/]+\/[^/]+)\/?.*/)?.[1];

  if (!repo) {
    throw new Error("Invalid repo URL " + repoUrl);
  }

  if (repo.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  const modDb: ModList = JSON.parse(readFileSync(outFile, "utf8"));
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

  if (utility && utility !== "None") {
    newMod.utility = Boolean(utility);
  }

  if (alpha && alpha !== "None") {
    newMod.alpha = Boolean(alpha);
  }

  if (authorDisplay) {
    newMod.authorDisplay = authorDisplay;
  }

  if (tags) {
    newMod.tags = tags.split(", ");
  }

  if (dlc === "DLC Required") {
    newMod.tags.push("requires-dlc");
  }

  if (thumbnailUrl) {
    newMod.thumbnailUrl = thumbnailUrl;
  }

  const existingMod = mods.find(
    (modFromList: ModInfo) => uniqueName === modFromList.uniqueName,
  );

  if (existingMod) {
    existingMod.name = newMod.name;
    existingMod.repo = newMod.repo;
    existingMod.parent = newMod.parent;
    existingMod.utility = newMod.utility;
    existingMod.alpha = newMod.alpha;
    existingMod.authorDisplay = newMod.authorDisplay;
    existingMod.tags = newMod.tags;
    existingMod.thumbnailUrl = newMod.thumbnailUrl;
  }

  const newModDb: ModList = {
    $schema: "./mods.schema.json",
    mods: existingMod ? mods : [...mods, newMod],
  };

  const jsonString = JSON.stringify(newModDb, null, 2);

  console.log(jsonString);

  // Write synchronously and fail loudly: if the write fails and the step still
  // exits 0, create-pull-request would create a PR from an unchanged mods.json.
  try {
    writeFileSync(outFile, jsonString);
  } catch (error) {
    console.error("Couldn't write to mods file: ", error);
    process.exit(1);
  }
}

run();
