import { getOctokit } from "./get-octokit.js";

const managerRepo = {
  owner: "ow-mods",
  repo: "ow-mod-manager",
};

export async function fetchModManager() {
  const octokit = getOctokit();

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

  const assets = managerLatestRelease.assets;
  const zipAssets = assets.filter((asset) => asset.name.endsWith(".zip"));
  const legacyZipAsset = zipAssets.find((asset) =>
    asset.name.includes("LEGACY")
  );
  const mainZipAsset = zipAssets.find(
    (asset) => !asset.name.includes("LEGACY")
  );
  const exeAsset = assets.find((asset) => asset.name.endsWith(".exe"));

  return {
    version: managerLatestRelease.tag_name,
    downloadUrl: (legacyZipAsset ?? mainZipAsset)?.browser_download_url,
    zipDownloadUrl: (mainZipAsset ?? legacyZipAsset)?.browser_download_url,
    installerDownloadUrl: exeAsset?.browser_download_url,
    downloadCount: managerDownloadCount,
  };
}

function filterTruthy<TItem>(item: TItem | null): item is TItem {
  return Boolean(item);
}
