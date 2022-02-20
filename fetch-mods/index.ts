import { getOctokit } from "@actions/github";
import * as core from "@actions/core";

const REPO_URL_BASE = "https://github.com";
const JSON_INDENT = 2;

const managerRepo = {
  owner: "Raicuparta",
  repo: "ow-mod-manager",
};

enum Input {
  mods = "mods",
  gitHubToken = "github-token",
}

enum Output {
  releases = "releases",
}

async function run() {
  try {
    const modInfos: ModInfo[] = JSON.parse(core.getInput(Input.mods));
    const gitHubToken = core.getInput(Input.gitHubToken);
    const octokit = getOctokit(gitHubToken);

    const managerReleases = await octokit.paginate(
      octokit.rest.repos.listReleases,
      {
        ...managerRepo,
        per_page: 100,
      }
    );
    const managerLatestRelease = managerReleases[0];
    const managerDownloadCount = managerReleases.reduce(
      (managerDownloadAccumulator, { assets }) => {
        const assetsDownloadCount = assets
          .filter(
            ({ name }) =>
              (name.endsWith("zip") && !name.includes("LEGACY")) ||
              name.endsWith("exe")
          )
          .reduce((assetsDownloadAccumulator, { download_count }) => {
            return assetsDownloadAccumulator + download_count;
          }, 0);

        return managerDownloadAccumulator + assetsDownloadCount;
      },
      0
    );

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

    function getCleanedUpReleases(releaseList: typeof managerLatestRelease[]) {
      return releaseList
        .filter(({ assets }) => assets.length > 0)
        .map((release) => {
          const asset = release.assets[0];

          return {
            downloadUrl: asset.browser_download_url,
            downloadCount: asset.download_count,
            version: release.tag_name,
            date: asset.created_at,
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
            latestReleaseDate: latestPrerelease.date,
            firstReleaseDate: firstRelease.date,
            repo,
            version: latestRelease.version,
            readme,
            prerelease: latestPrerelease
              ? {
                  version: latestPrerelease.version,
                  downloadUrl: latestPrerelease.downloadUrl,
                }
              : undefined,
          };

          return mod;
        } catch (error) {
          core.error(`Error fetching mod ${modInfo.uniqueName} : ${error}`);
          return null;
        }
      })
    );

    const assets = managerLatestRelease.assets;
    const zipAssets = assets.filter((asset) => asset.name.endsWith(".zip"));
    const legacyZipAsset = zipAssets.find((asset) =>
      asset.name.includes("LEGACY")
    );
    const mainZipAsset = zipAssets.find(
      (asset) => !asset.name.includes("LEGACY")
    );
    const exeAsset = assets.find((asset) => asset.name.endsWith(".exe"));

    const modDatabase = {
      modManager: {
        version: managerLatestRelease.tag_name,
        downloadUrl: (legacyZipAsset ?? mainZipAsset)?.browser_download_url,
        zipDownloadUrl: (mainZipAsset ?? legacyZipAsset)?.browser_download_url,
        installerDownloadUrl: exeAsset?.browser_download_url,
        downloadCount: managerDownloadCount,
      },
      releases: modReleases.filter(Boolean),
    };

    const databaseJson = JSON.stringify(modDatabase, null, JSON_INDENT);

    core.setOutput(Output.releases, databaseJson);
  } catch (error) {
    core.setFailed(error as any);
    console.log("error", error as any);
  }
}

run();
