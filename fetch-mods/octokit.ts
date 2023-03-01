import { Octokit, RestEndpointMethodTypes } from "@octokit/action";
import { retry } from "@octokit/plugin-retry";
import { throttling } from "@octokit/plugin-throttling";
import fetch from "node-fetch";

export let rateLimitReached = false;
export let apiCallCount = 0;

function createOctokit() {
  const OctokitWithPlugins = Octokit.plugin(retry, throttling);
  return new OctokitWithPlugins({
    // It's useful to log the API call count,
    // but replacing the fetch function seems to some times cause the "premature close" error.
    // request: {
    //   fetch: (...parameters: [any]) => {
    //     apiCallCount++;
    //     return fetch(...parameters);
    //   },
    // },
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

export type CreatedOctokit = ReturnType<typeof createOctokit>;
let octokit: CreatedOctokit;

export function getOctokit() {
  if (!octokit) {
    octokit = createOctokit();
  }
  return octokit;
}

type OctokitRepo = RestEndpointMethodTypes["repos"]["get"]["response"]["data"];
type OctokitRelease =
  RestEndpointMethodTypes["repos"]["listReleases"]["response"]["data"][number];

export function getCleanedUpRelease(release: OctokitRelease) {
  const asset = release.assets[0];

  return {
    downloadUrl: asset.browser_download_url,
    downloadCount: asset.download_count,
    version: release.tag_name,
    date: asset.created_at,
    description: release.body,
  };
}

export function getCleanedUpReleaseList(releaseList: OctokitRelease[]) {
  return releaseList
    .filter(({ assets }) => assets.length > 0)
    .map(getCleanedUpRelease);
}

export function getRepoUpdatedAt(repository: OctokitRepo) {
  return new Date(repository.updated_at) > new Date(repository.pushed_at)
    ? repository.updated_at
    : repository.pushed_at;
}
