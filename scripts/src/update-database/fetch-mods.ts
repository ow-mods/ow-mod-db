import { generateModThumbnail } from "./generate-mod-thumbnail.js";
import {
  getOctokit,
  getCleanedUpRelease,
  getCleanedUpReleaseList,
  getRepoUpdatedAt,
  getAllReleases,
} from "./octokit.js";
import { filterFulfilledPromiseSettleResults } from "../helpers/promises.js";
import { getDateAgeInHours } from "../helpers/dates.js";
import { getReadmeUrls } from "./readmes.js";
import { RELEASE_EXTENSION } from "../constants.js";
import { BaseMod, OutputMod } from "../mod.js";
import type { ModList } from "../mod-info.js";

const REPO_URL_BASE = "https://github.com";
const FULL_UPDATE_RATE_HOURS = 12;

export async function fetchMods(
  modsJson: string,
  outputDirectory: string,
  previousDatabase: OutputMod[]
): Promise<BaseMod[]> {
  const modDb: ModList = JSON.parse(modsJson);
  const modInfos = modDb.mods;
  const octokit = getOctokit();

  return (
    await Promise.allSettled(
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
            getDateAgeInHours(previousMod.databaseEntryUpdatedAt) >
              FULL_UPDATE_RATE_HOURS;

          const readme = requiresUpdate
            ? await getReadmeUrls(octokit, owner, repo, modInfo)
            : previousMod.readme;

          const slug = modInfo.name.replace(/\W/g, "").toLowerCase();

          const thumbnailInfo = previousMod?.thumbnail ?? {};

          const newThumbnail = await generateModThumbnail(
            slug,
            modInfo.thumbnailUrl,
            readme?.downloadUrl,
            outputDirectory
          );

          if (newThumbnail.main) {
            thumbnailInfo.main = newThumbnail.main;
          }
          if (newThumbnail.openGraph) {
            thumbnailInfo.openGraph = newThumbnail.openGraph;
          }

          const repoURL = `${REPO_URL_BASE}/${modInfo.repo}`;
          const repoVariations = modInfo.repoVariations
            ? modInfo.repoVariations.map(
                (value: string) => `${REPO_URL_BASE}/${value}`
              )
            : [];

          if (!requiresUpdate) {
            return {
              ...previousMod,
              alpha: modInfo.alpha,
              required: modInfo.required,
              utility: modInfo.utility,
              parent: modInfo.parent,
              repo: repoURL,
              authorDisplay: modInfo.authorDisplay,
              tags: modInfo.tags,
              thumbnail: thumbnailInfo,
              repoVariations,
            };
          }

          const fullReleaseList = (await getAllReleases(octokit, owner, repo))
            .sort(
              (releaseA, releaseB) =>
                new Date(releaseB.created_at).valueOf() -
                new Date(releaseA.created_at).valueOf()
            )
            .filter((release) => !release.draft);

          const prereleaseList = fullReleaseList.filter(
            (release) => release.prerelease
          );

          const releaseList = fullReleaseList.filter(
            (release) =>
              !release.prerelease &&
              release.assets[0] &&
              release.assets[0].browser_download_url.endsWith(RELEASE_EXTENSION)
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

          if (modInfo.downloadCountOffset) {
            totalDownloadCount += modInfo.downloadCountOffset;
          }

          const firstReleaseDate =
            modInfo.firstReleaseDateOverride ??
            (releases[releases.length - 1] ?? cleanLatestRelease).date;
          const latestPrerelease = prereleases[0];

          const mod: BaseMod = {
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
            firstReleaseDate,
            repo: repoURL,
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
            repoVariations,
          };

          return mod;
        } catch (error) {
          console.log(`Error updating mod ${modInfo.uniqueName}:`, error);
          return null;
        }
      })
    )
  )
    .filter(filterFulfilledPromiseSettleResults)
    .map((result) => result.value);
}
