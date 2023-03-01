import { generateModThumbnail } from "./generate-mod-thumbnail.js";
import {
  getOctokit,
  getCleanedUpRelease,
  getCleanedUpReleaseList,
  getRepoUpdatedAt,
} from "./octokit.js";
import { filterFulfilledPromiseSettleResults } from "./promises.js";
import { RequestError } from "@octokit/request-error";
import { RestEndpointMethodTypes } from "@octokit/action";
import { getDateAgeInDays } from "./happened-within-day-count.js";

const REPO_URL_BASE = "https://github.com";

const downloadCountOffsets: { [key: string]: number } = {
  // Jammer deleted the repositories
  "Jammer.OuterWildsGalaxy": 3766,
  "Jammer.jammerlore": 373,
};

export async function fetchMods(
  modsJson: string,
  outputDirectory: string,
  previousDatabase: Mod[]
): Promise<Mod[]> {
  const modDb: ModDB = JSON.parse(modsJson);
  const modInfos = modDb.mods;
  const octokit = getOctokit();

  const promiseResults = await Promise.allSettled(
    modInfos.map(async (modInfo) => {
      const previousMod = previousDatabase.find(
        (mod) => mod.uniqueName === modInfo.uniqueName
      );

      try {
        const [owner, repo] = modInfo.repo.split("/");

        const githubRepository = (
          await octokit.rest.repos.get({
            owner,
            repo,
          })
        ).data;

        const repoUpdatedAt = getRepoUpdatedAt(githubRepository);

        const requiresUpdate =
          !previousMod ||
          new Date(repoUpdatedAt) > new Date(previousMod.repoUpdatedAt) ||
          getDateAgeInDays(previousMod.databaseEntryUpdatedAt) > 0.5;

        const getReadme = async () => {
          try {
            const response = await octokit.rest.repos.getReadme({
              owner,
              repo,
            });

            if (response.status != 200) {
              return undefined;
            }

            const readme = response.data;

            return {
              htmlUrl: readme.html_url || undefined,
              downloadUrl: readme.download_url || undefined,
            };
          } catch (error) {
            if (error instanceof RequestError && error.status == 404) {
              // 404s are expected, ignore.
              return undefined;
            }
            console.log(
              `Failed to get readme for mod ${modInfo.uniqueName}: ${error}"`
            );
            return undefined;
          }
        };

        const readme = requiresUpdate ? await getReadme() : previousMod.readme;

        const slug = modInfo.name.replace(/\W/g, "").toLowerCase();

        const thumbnailInfo =
          readme && readme.downloadUrl
            ? await generateModThumbnail(
                slug,
                readme.downloadUrl,
                outputDirectory
              )
            : {};

        if (!requiresUpdate) {
          return {
            ...previousMod,
            thumbnail: thumbnailInfo ?? {},
          };
        }

        const fullReleaseList = (
          await octokit.paginate(octokit.rest.repos.listReleases, {
            owner,
            repo,
            per_page: 100,
          })
        )
          .sort((releaseA, releaseB) =>
            new Date(releaseA.created_at) < new Date(releaseB.created_at)
              ? 1
              : -1
          )
          .filter((release) => !release.draft);

        const prereleaseList = fullReleaseList.filter(
          (release) => release.prerelease
        );

        const releaseList = fullReleaseList.filter(
          (release) =>
            !release.prerelease &&
            release.assets[0] &&
            release.assets[0].browser_download_url.endsWith("zip")
        );

        const latestRelease = releaseList[0];

        if (!latestRelease) {
          throw new Error(
            "Failed to find latest release from either release list or latest release endpoint"
          );
        }

        const releases = getCleanedUpReleaseList(releaseList);
        const prereleases = getCleanedUpReleaseList(prereleaseList);
        const cleanLatestRelease = getCleanedUpRelease(latestRelease);

        let totalDownloadCount = [...releases, ...prereleases].reduce(
          (accumulator, release) => {
            return accumulator + release.downloadCount;
          },
          0
        );

        if (modInfo.uniqueName in downloadCountOffsets) {
          totalDownloadCount += downloadCountOffsets[modInfo.uniqueName];
        }

        const firstRelease =
          releases[releases.length - 1] ?? cleanLatestRelease;
        const latestPrerelease = prereleases[0];

        const mod: Mod = {
          name: modInfo.name,
          uniqueName: modInfo.uniqueName,
          description: githubRepository.description || "",
          author: githubRepository.owner.login,
          alpha: modInfo.alpha,
          required: modInfo.required,
          utility: modInfo.utility,
          parent: modInfo.parent,
          downloadUrl: cleanLatestRelease.downloadUrl,
          downloadCount: totalDownloadCount,
          latestReleaseDate: cleanLatestRelease.date,
          firstReleaseDate: firstRelease.date,
          repo: `${REPO_URL_BASE}/${modInfo.repo}`,
          version: cleanLatestRelease.version,
          readme,
          authorDisplay: modInfo.authorDisplay,
          latestReleaseDescription: cleanLatestRelease.description || "",
          latestPrereleaseDescription: latestPrerelease?.description || "",
          prerelease: latestPrerelease
            ? {
                version: latestPrerelease.version,
                downloadUrl: latestPrerelease.downloadUrl,
                date: latestPrerelease.date,
              }
            : undefined,
          tags: modInfo.tags,
          slug,
          thumbnail: thumbnailInfo ?? {},
          repoUpdatedAt,
          databaseEntryUpdatedAt: new Date().toISOString(),
        };

        return mod;
      } catch (error) {
        console.log(`Error updating mod ${modInfo.uniqueName}:`, error);
        return null;
      }
    })
  );

  const results = promiseResults
    .filter(filterFulfilledPromiseSettleResults)
    .map((result) => result.value);

  return results.filter(filterTruthy);
}

function filterTruthy<TItem>(item: TItem | null): item is TItem {
  return Boolean(item);
}
