import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";

function createOctokit() {
  const OctokitWithPlugins = Octokit.plugin(retry);
  return new OctokitWithPlugins();
}

let octokit: ReturnType<typeof createOctokit> | undefined;

export function getOctokit() {
  if (!octokit) {
    octokit = createOctokit();
  }
  return octokit;
}
