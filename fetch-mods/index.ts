import * as core from "@actions/core";
import { fetchMods } from "./fetch-mods";

enum Input {
  mods = "mods",
  gitHubToken = "github-token",
}

enum Output {
  releases = "releases",
}

async function run() {
  try {
    const databaseJson = await fetchMods(
      core.getInput(Input.mods),
      core.getInput(Input.gitHubToken)
    );

    core.setOutput(Output.releases, databaseJson);
  } catch (error) {
    core.setFailed(error as any);
    console.log("error", error as any);
  }
}

run();
