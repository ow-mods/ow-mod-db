import { getOctokit } from "./get-octokit";
import { filterFulfilledPromiseSettleResults } from "./promises";

const REPO_URL_BASE = "https://github.com";

const downloadCountOffsets : {[key: string]: number} = {
  // Jammer deleted the repositories
  "Jammer.OuterWildsGalaxy": 3766,
  "Jammer.jammerlore": 373
}

export async function fetchMods(modsJson: string) {
  const modDb: ModDB = JSON.parse(modsJson);
  const modInfos = modDb.mods;
  const octokit = getOctokit();

  type OctokitRelease = Awaited<
    ReturnType<typeof octokit.rest.repos.listReleases>
  >["data"][number];
  type ReleaseList = OctokitRelease[];

  const promiseResults = await Promise.allSettled(
    modInfos.map(async (modInfo) => {
      try {
        const [owner, repo] = modInfo.repo.split("/");

        const getReadme = async () => {
          try {
            const readme = (
              await octokit.rest.repos.getReadme({
                owner,
                repo,
              })
            ).data;
            return {
              htmlUrl: readme.html_url || undefined,
              downloadUrl: readme.download_url || undefined,
            };
          } catch {
            console.log("no readme found");
          }
        };

        const readme = await getReadme();

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

        const latestReleaseFromList = releaseList[0];
        // console.log("latestReleaseFromList", latestReleaseFromList);

        let latestReleaseFromApi: OctokitRelease | null = null;

        try {
          latestReleaseFromApi = (
            await octokit.rest.repos.getLatestRelease({
              owner,
              repo,
            })
          ).data;

          // console.log("latestReleaseFromApi", latestReleaseFromApi);
        } catch (error) {
          console.log(`Failed to get latest release from API: ${error}`);
        }

        // There are two ways to get the latest release:
        // - picking the last item in the full release list;
        // - using the result of the latest release api endpoint.
        // Some times, they disagree. So I'll pick the youngest one as the latest release.
        let useReleaseFromList = false;
        if (!latestReleaseFromApi && latestReleaseFromList) {
          useReleaseFromList = true;
        } else if (latestReleaseFromApi && !latestReleaseFromList) {
          useReleaseFromList = false;
        } else if (
          latestReleaseFromList &&
          latestReleaseFromApi &&
          new Date(latestReleaseFromList.created_at) >
            new Date(latestReleaseFromApi.created_at)
        ) {
          useReleaseFromList = true;
        }

        const latestRelease = useReleaseFromList
          ? latestReleaseFromList
          : latestReleaseFromApi;

        if (!latestRelease) {
          throw new Error(
            "Failed to find latest release from either release list or latest release endpoint"
          );
        }

        return {
          releaseList,
          prereleaseList,
          modInfo,
          readme,
          latestRelease,
        };
      } catch (error) {
        console.log("Error reading mod info", error);
        return null;
      }
    })
  );

  const results = promiseResults
    .filter(filterFulfilledPromiseSettleResults)
    .map((result) => result.value);

  function getCleanedUpRelease(release: OctokitRelease) {
    const asset = release.assets[0];

    return {
      downloadUrl: asset.browser_download_url,
      downloadCount: asset.download_count,
      version: release.tag_name,
      date: asset.created_at,
      description: release.body,
    };
  }

  function getCleanedUpReleaseList(releaseList: ReleaseList) {
    return releaseList
      .filter(({ assets }) => assets.length > 0)
      .map(getCleanedUpRelease);
  }

  const modReleaseResults = await Promise.allSettled<Mod>(
    results.map(
      async ({
        modInfo,
        latestRelease,
        releaseList,
        prereleaseList,
        readme,
      }) => {
        try {
          const releases = getCleanedUpReleaseList(releaseList);
          const prereleases = getCleanedUpReleaseList(prereleaseList);
          const cleanLatestRelease = getCleanedUpRelease(latestRelease);
          const repo = `${REPO_URL_BASE}/${modInfo.repo}`;

          // console.log("releases", toJsonString(releases));
          // console.log("prereleases", toJsonString(prereleases));
          // console.log("cleanLatestRelease", toJsonString(cleanLatestRelease));

          let totalDownloadCount = [...releases, ...prereleases].reduce(
            (accumulator, release) => {
              return accumulator + release.downloadCount;
            },
            0
          );

          if (modInfo.uniqueName in downloadCountOffsets){
            totalDownloadCount += downloadCountOffsets[modInfo.uniqueName];
          }

          const splitRepo = modInfo.repo.split("/");
          const githubRepository = (
            await octokit.rest.repos.get({
              owner: splitRepo[0],
              repo: splitRepo[1],
            })
          ).data;

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
            repo,
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
          };

          return mod;
        } catch (error) {
          const errorMessage = `Error fetching mod ${modInfo.uniqueName} : ${error}`;
          console.error(errorMessage);
          throw new Error(errorMessage);
        }
      }
    )
  );

  const modReleases = modReleaseResults
    .filter(filterFulfilledPromiseSettleResults)
    .map((result) => result.value);

  return modReleases.filter(filterTruthy);
}

function filterTruthy<TItem>(item: TItem | null): item is TItem {
  return Boolean(item);
}
