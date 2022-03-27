import { getOctokit } from "@actions/github";

const REPO_URL_BASE = "https://github.com";

const managerRepo = {
  owner: "Raicuparta",
  repo: "ow-mod-manager",
};

export async function fetchMods(modsJson: string, gitHubToken: string) {
  const modInfos: ModInfo[] = JSON.parse(modsJson);
  const octokit = getOctokit(gitHubToken);

  type ReleaseList = Awaited<
    ReturnType<typeof octokit.rest.repos.listReleases>
  >["data"];

  const results = [];
  for (let modInfo of modInfos) {
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

      const fullReleaseList = await octokit.paginate(
        octokit.rest.repos.listReleases,
        {
          owner,
          repo,
          per_page: 100,
        }
      );
      const prereleaseList = fullReleaseList.filter(
        (release) => release.prerelease
      );
      const releaseList = fullReleaseList.filter(
        (release) => !release.prerelease
      );

      results.push({
        releaseList,
        prereleaseList,
        modInfo,
        readme,
      });
    } catch (error) {
      console.log("Error reading mod info", error);
    }
  }

  function getCleanedUpReleases(releaseList: ReleaseList) {
    return releaseList
      .filter(({ assets }) => assets.length > 0)
      .map((release) => {
        const asset = release.assets[0];

        return {
          downloadUrl: asset.browser_download_url,
          downloadCount: asset.download_count,
          version: release.tag_name,
          date: asset.created_at,
          description: release.body,
        };
      });
  }

  const modReleases: (Mod | null)[] = await Promise.all(
    results.map(async ({ modInfo, releaseList, prereleaseList, readme }) => {
      try {
        const releases = getCleanedUpReleases(releaseList);
        const prereleases = getCleanedUpReleases(prereleaseList);
        const repo = `${REPO_URL_BASE}/${modInfo.repo}`;

        const totalDownloadCount = [...releases, ...prereleases].reduce(
          (accumulator, release) => {
            return accumulator + release.downloadCount;
          },
          0
        );

        const splitRepo = modInfo.repo.split("/");
        const githubRepository = (
          await octokit.rest.repos.get({
            owner: splitRepo[0],
            repo: splitRepo[1],
          })
        ).data;

        const latestRelease = releases[0];
        const firstRelease = releases[releases.length - 1];
        const latestPrerelease = prereleases[0];

        const mod: Mod = {
          name: modInfo.name,
          uniqueName: modInfo.uniqueName,
          description: githubRepository.description || "",
          author: githubRepository.owner.login,
          required: modInfo.required,
          utility: modInfo.utility,
          parent: modInfo.parent,
          downloadUrl: latestRelease.downloadUrl,
          downloadCount: totalDownloadCount,
          latestReleaseDate: latestRelease.date,
          firstReleaseDate: firstRelease.date,
          repo,
          version: latestRelease.version,
          readme,
          latestReleaseDescription: latestRelease.description || "",
          prerelease: latestPrerelease
            ? {
                version: latestPrerelease.version,
                downloadUrl: latestPrerelease.downloadUrl,
              }
            : undefined,
        };

        return mod;
      } catch (error) {
        console.error(`Error fetching mod ${modInfo.uniqueName} : ${error}`);
        return null;
      }
    })
  );

  return modReleases.filter(filterTruthy);
}

function filterTruthy<TItem>(item: TItem | null): item is TItem {
  return Boolean(item);
}
