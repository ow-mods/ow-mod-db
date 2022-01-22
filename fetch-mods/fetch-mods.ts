import { getOctokit } from "@actions/github";
import { fetchManifest, Manifest } from "./fetch-manifest";

const REPO_URL_BASE = "https://github.com";
const JSON_INDENT = 2;

const managerRepo = {
  owner: "Raicuparta",
  repo: "ow-mod-manager",
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
  manifest: Manifest;
  prerelease?: {
    version: string;
    downloadUrl: string;
    manifest: Manifest;
  };
}

export async function fetchMods(modsJson: string, gitHubToken: string) {
  const modInfos: ModInfo[] = JSON.parse(modsJson);
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

  const modReleases: Mod[] = [];

  for (const { modInfo, releaseList, prereleaseList, readme } of results) {
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

      const getPrerelease = async () => {
        try {
          return latestPrerelease
            ? {
                manifest: await fetchManifest(latestPrerelease.downloadUrl),
                version: latestPrerelease.version,
                downloadUrl: latestPrerelease.downloadUrl,
              }
            : undefined;
        } catch (error) {
          console.error(
            `Error getting prerelease: ${latestPrerelease.downloadUrl}`
          );
        }
      };

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
        manifest: await fetchManifest(latestRelease.downloadUrl),
        prerelease: await getPrerelease(),
      };

      modReleases.push(mod);
    } catch (error) {
      console.error(`Error fetching mod ${modInfo.uniqueName} : ${error}`);
    }
  }

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
    releases: modReleases,
  };

  return JSON.stringify(modDatabase, null, JSON_INDENT);
}
