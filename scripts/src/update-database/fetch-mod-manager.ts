import { RELEASE_EXTENSION } from "../constants.js";
import { getAllReleases, getOctokit } from "./octokit.js";

const MANAGER_REPO_AUTHOR = "ow-mods";
const MANAGER_REPO_NAME = "ow-mod-manager";
const LEGACY_RELEASE_TAG = "LEGACY";
const EXE_EXTENSION = "exe";

export type ModManagerOutput = {
  version: string;
  downloadUrl: string;
  zipDownloadUrl: string;
  installerDownloadUrl: string;
  downloadCount: number;
};

export async function fetchModManager(): Promise<ModManagerOutput> {
  const octokit = getOctokit();

  const managerReleases = await getAllReleases(
    octokit,
    MANAGER_REPO_AUTHOR,
    MANAGER_REPO_NAME
  );
  const managerLatestRelease = managerReleases[0];
  const managerDownloadCount = managerReleases.reduce(
    (managerDownloadAccumulator, { assets }) => {
      const assetsDownloadCount = assets
        .filter(
          ({ name }) =>
            (name.endsWith(RELEASE_EXTENSION) &&
              !name.includes(LEGACY_RELEASE_TAG)) ||
            name.endsWith(EXE_EXTENSION)
        )
        .reduce((assetsDownloadAccumulator, { download_count }) => {
          return assetsDownloadAccumulator + download_count;
        }, 0);

      return managerDownloadAccumulator + assetsDownloadCount;
    },
    0
  );

  const assets = managerLatestRelease.assets;
  const zipAssets = assets.filter((asset) =>
    asset.name.endsWith(`.${RELEASE_EXTENSION}`)
  );
  const legacyZipAsset = zipAssets.find((asset) =>
    asset.name.includes(LEGACY_RELEASE_TAG)
  );
  const mainZipAsset = zipAssets.find(
    (asset) => !asset.name.includes(LEGACY_RELEASE_TAG)
  );
  const exeAsset = assets.find((asset) =>
    asset.name.endsWith(`.${EXE_EXTENSION}`)
  );

  return {
    version: managerLatestRelease.tag_name,
    downloadUrl: (legacyZipAsset ?? mainZipAsset)?.browser_download_url ?? "",
    zipDownloadUrl:
      (mainZipAsset ?? legacyZipAsset)?.browser_download_url ?? "",
    installerDownloadUrl: exeAsset?.browser_download_url ?? "",
    downloadCount: managerDownloadCount,
  };
}
