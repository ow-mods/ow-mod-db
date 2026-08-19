import { Octokit, type OctokitOptions } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";
import { restEndpointMethods } from "@octokit/plugin-rest-endpoint-methods";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import { createPullRequest } from "octokit-plugin-create-pull-request";
import fetch from "node-fetch";

// It's useful to log the API call count,
// but replacing the fetch function seems to some times cause the "premature close" error.
// So it's disabled by default.
const LOG_API_CALL_COUNTS = false;

export let rateLimitReached = false;
export let apiCallCount = 0;

function createOctokit(token: string, baseUrl: string) {
  const OctokitWithPlugins = Octokit.plugin(
    retry,
    throttling,
    paginateRest,
    restEndpointMethods,
    createPullRequest,
  );
  return new OctokitWithPlugins({
    auth: token,
    baseUrl,
    request: LOG_API_CALL_COUNTS
      ? {
          fetch: (...parameters: Parameters<typeof fetch>) => {
            apiCallCount++;
            return fetch(...parameters);
          },
        }
      : undefined,
    retry: {
      // Make it retry for everything, even 404s,
      // since the GH API some times randomly returns 404 in the latest release.
      doNotRetry: [],
    },
    throttle: {
      onRateLimit: (retryAfter: number, options: OctokitOptions) => {
        console.warn(
          `Request quota exhausted for request ${options.method} ${options.url}`
        );

        if (options.request && options.request.retryCount <= 2) {
          return true;
        }

        rateLimitReached = true;
        return false;
      },
      onSecondaryRateLimit: (retryAfter: number, options: OctokitOptions) => {
        console.warn(
          `Abuse detected for request ${options.method} ${options.url}`
        );

        if (options.request && options.request.retryCount <= 2) {
          return true;
        }

        rateLimitReached = true;
        return false;
      },
    },
  });
}

export type CreatedOctokit = ReturnType<typeof createOctokit>;
let createdOctokit: CreatedOctokit;

const GITHUB_API_URL = "https://api.github.com";

export function getOctokit() {
  const token = process.env.GH_TOKEN;
  if (!token) {
    throw new Error("Missing GitHub token. Set the GH_TOKEN environment variable.");
  }
  if (!createdOctokit) {
    createdOctokit = createOctokit(token, GITHUB_API_URL);
  }
  return createdOctokit;
}

export async function getAllReleases(
  octokit: CreatedOctokit,
  owner: string,
  repo: string
) {
  return octokit.paginate(octokit.rest.repos.listReleases, {
    owner,
    repo,
    per_page: 100,
  });
}
