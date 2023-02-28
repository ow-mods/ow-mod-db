import { Octokit } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import fetch from "node-fetch";

export let rateLimitReached = false;
export let apiCallCount = 0;

function createOctokit() {
  const OctokitWithPlugins = Octokit.plugin(retry, throttling);
  return new OctokitWithPlugins({
    request: {
      fetch: (...parameters: [any]) => {
        apiCallCount++;
        return fetch(...parameters);
      },
    },
    retry: {
      // Make it retry for everything, even 404s,
      // since the GH API some times randomly returns 404 in the latest release.
      doNotRetry: [],
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: any) => {
        console.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );

        if (options.request.retryCount <= 2) {
          return true;
        }

        rateLimitReached = true;
        return false;
      },
      onSecondaryRateLimit: (retryAfter: number, options: any) => {
        console.warn(
          `Abuse detected for request ${options.method} ${options.url}`
        );

        if (options.request.retryCount <= 2) {
          return true;
        }

        rateLimitReached = true;
        return false;
      },
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
