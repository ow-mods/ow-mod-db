import { getOctokit } from "@actions/github";
import * as core from "@actions/core";
import unzipper from "unzipper";
import { request } from "https";

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

type ManifestWarning = {
  title?: string;
  body?: string;
};

type Manifest = {
  name: string;
  author: string;
  uniqueName: string;
  version: string;
  dependencies?: string[];
  warning?: ManifestWarning;
  patcher?: string;
  conflicts?: string[];
};

type ModInfo = {
  name: string;
  uniqueName: string;
  repo: string;
  required?: boolean;
  utility?: boolean;
  parent?: string;
};

type Release = {
  downloadUrl: string;
  downloadCount: number;
  version: string;
};

interface Mod extends Release {
  name: string;
  uniqueName: string;
  description: string;
  author: string;
  repo: string;
  required?: boolean;
  utility?: boolean;
  parent?: string;
  readme?: {
    downloadUrl?: string;
    htmlUrl?: string;
  };
  manifest?: Manifest;
  prerelease?: {
    version: string;
    downloadUrl: string;
    manifest?: Manifest;
  };
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

    const getManifest = async (
      zipUrl: string
    ): Promise<Manifest | undefined> => {
      try {
        const directory = await unzipper.Open.url(request as any, zipUrl);
        const file = directory.files.find((file) =>
          /(^|\/)manifest\.json/gm.test(file.path)
        );
        if (!file) {
          throw `Manifest file not found`;
        }
        const content = await file.buffer();
        return JSON.parse(content.toString()) as Manifest;
      } catch (error) {
        core.error(`Error getting manifest for ${zipUrl}: ${error}`);
      }
    };

    async function getCleanedUpReleases(
      releaseList: typeof managerLatestRelease[]
    ) {
      return Promise.all(
        releaseList
          .filter(({ assets }) => assets.length > 0)
          .map(async (release) => {
            const asset = release.assets[0];

            return {
              downloadUrl: asset.browser_download_url,
              downloadCount: asset.download_count,
              version: release.tag_name,
            };
          })
      );
    }

    const modReleases: (Mod | null)[] = await Promise.all(
      results.map(async ({ modInfo, releaseList, prereleaseList, readme }) => {
        try {
          const releases = await getCleanedUpReleases(releaseList);
          const prereleases = await getCleanedUpReleases(prereleaseList);
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
            repo,
            version: latestRelease.version,
            readme,
            manifest: await getManifest(latestRelease.downloadUrl),
            prerelease: latestPrerelease
              ? {
                  manifest: await getManifest(latestPrerelease.downloadUrl),
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
