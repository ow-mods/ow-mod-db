import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";

function createOctokit() {
  const OctokitWithPlugins = Octokit.plugin(retry);
  return new OctokitWithPlugins({
    retry: {
      // Make it retry for everything, even 404s,
      // since the GH API some times randomly returns 404 in the latest release.
      doNotRetry: [],
    },
  });
}

let octokit: ReturnType<typeof createOctokit> | undefined;

export function getOctokit() {
  if (!octokit) {
    octokit = createOctokit();
  }
  return octokit;
}
