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
  repo?: string;
  uniqueName?: string;
};

async function run() {
  const form: IssueForm = JSON.parse(core.getInput(Input.form));

  if (!form.name || !form.repo || !form.uniqueName) {
    throw new Error("Invalid form format");
  }

  const mods: ModInfo[] = JSON.parse(core.getInput(Input.mods));

  const newMods: ModInfo[] = [
    ...mods,
    {
      name: form.name,
      repo: form.repo,
      uniqueName: form.uniqueName,
    },
  ];

  core.setOutput(Output.mods, JSON.stringify(newMods, null, 2));
}

run();
