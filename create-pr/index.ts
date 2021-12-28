import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

enum Input {
  form = "form",
  mods = "mods",
  gitHubToken = "github-token",
}

enum Output {
  mods = "mods",
}

type IssueForm = {
  name?: string;
  uniqueName?: string;
  repo?: string;
  utility?: string;
  parent?: string;
};

async function run() {
  const { name, repo, uniqueName, parent, utility }: IssueForm = JSON.parse(
    core.getInput(Input.form)
  );

  if (!name || !repo || !uniqueName) {
    throw new Error("Invalid form format");
  }

  const mods: ModInfo[] = JSON.parse(core.getInput(Input.mods));
  const newMod: ModInfo = {
    name,
    repo,
    uniqueName,
  };

  if (parent) {
    newMod.parent = parent;
  }

  if (utility) {
    newMod.utility = Boolean(utility);
  }

  const newMods: ModInfo[] = [...mods, newMod];

  core.setOutput(Output.mods, JSON.stringify(newMods, null, 2));
}

run();
