import * as core from "@actions/core";

enum Input {
  form = "form",
  mods = "mods",
  gitHubToken = "github-token",
}

enum Output {
  mods = "mods",
  editedExistingMod = "edited-existing-mod",
}

// Mod info from mods.json.
type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  alpha?: boolean;
  required?: boolean;
  utility?: boolean;
  parent?: string;
};

// From .github/ISSUE_TEMPLATE/add-mod.yml.
type IssueForm = {
  name?: string;
  uniqueName?: string;
  repoUrl?: string;
  alpha?: string;
  utility?: string;
  parent?: string;
};

async function run() {
  const { name, repoUrl, uniqueName, parent, utility, alpha }: IssueForm = JSON.parse(
    core.getInput(Input.form)
  );

  if (!name || !repoUrl || !uniqueName) {
    throw new Error("Invalid form format");
  }

  const repo = repoUrl.match(/github\.com\/([^\/]+\/[^\/]+)\/?.*/)?.[1];

  if (!repo) {
    throw new Error("Invalid repo URL " + repoUrl);
  }

  const mods: ModInfo[] = JSON.parse(core.getInput(Input.mods));

  const newMod: ModInfo = {
    name,
    uniqueName,
    repo,
  };

  if (parent) {
    newMod.parent = parent;
  }

  if (utility) {
    newMod.utility = Boolean(utility);
  }

  if (alpha) {
    newMod.alpha = Boolean(alpha);
  }

  const existingMod = mods.find(
    (modFromList) => uniqueName === modFromList.uniqueName
  );

  if (existingMod) {
    existingMod.name = newMod.name;
    existingMod.repo = newMod.repo;
    existingMod.parent = newMod.parent;
    existingMod.utility = newMod.utility;
    existingMod.alpha = newMod.alpha;
  }

  const newMods: ModInfo[] = existingMod ? mods : [...mods, newMod];

  core.setOutput(Output.mods, JSON.stringify(newMods, null, 2));
  if (existingMod) {
    core.setOutput(Output.editedExistingMod, true);
  }
}

run();
