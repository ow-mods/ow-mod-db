import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import axios from 'axios';

const RAW_URL_BASE = 'https://raw.githubusercontent.com';
const REPO_URL_BASE = 'https://github.com';
const JSON_INDENT = 2;

const managerRepo = {
  owner: 'Raicuparta',
  repo:'ow-mod-manager',
};

enum Input {
  mods = 'mods',
  gitHubToken = 'github-token',
}

enum Output {
  releases = 'releases',
}

async function run() {
  try {
    const mods: ModInfo[] = JSON.parse(core.getInput(Input.mods));
    const gitHubToken = core.getInput(Input.gitHubToken);
    const octokit = getOctokit(gitHubToken);

    const managerRelease = (await octokit.repos.getLatestRelease(managerRepo)).data;

    const results = [];
    for (let mod of mods) {
      const [owner, repo] = mod.repo.split('/');

      const fullReleaseList = (await octokit.paginate(octokit.repos.listReleases, {
        owner,
        repo,
        per_page: 100,
      }));
      const prereleaseList = fullReleaseList.filter(release => release.prerelease);
      const releaseList = fullReleaseList.filter(release => !release.prerelease);

      if (releaseList.length === 0) {
        continue;
      }

      const manifest: Manifest = (await axios(
        `${RAW_URL_BASE}/${owner}/${repo}/master/${mod.manifest}`
      )).data;

      results.push({
        releaseList,
        prereleaseList,
        manifest,
        repo: `${REPO_URL_BASE}/${mod.repo}`,
        required: mod.required,
      });
    }

    function getCleanedUpReleases(releaseList: typeof managerRelease[]): Release[] {
      return releaseList
        .filter(({ assets }) => assets.length > 0)
        .map(release => {
          const asset = release.assets[0];
    
          return {
            downloadUrl: asset.browser_download_url,
            downloadCount: asset.download_count,
            version: release.tag_name,
          };
        });
    }

    const modReleases: Mod[] = results.map(({
      repo,
      releaseList,
      manifest,
      required,
      prereleaseList,
    }) => {
      const releases = getCleanedUpReleases(releaseList);
      const prereleases = getCleanedUpReleases(prereleaseList);

      const totalDownloadCount = releases.reduce((accumulator, release) => {
        return accumulator + release.downloadCount;
      }, 0);

      const latestRelease = releases[0];
      const latestPrerelease = prereleases[0];

      const modInfo: Mod = {
        downloadUrl: latestRelease.downloadUrl,
        downloadCount: totalDownloadCount,
        repo,
        manifest,
        required,
        version: latestRelease.version,
        prerelease: (latestPrerelease ? {
          version: latestPrerelease.version,
          downloadUrl: latestPrerelease.downloadUrl,
        } : undefined),
      };

      return modInfo;
    });

    const assets = managerRelease.assets;
    const zipAssets = assets.filter(asset => asset.name.endsWith('.zip'));
    const legacyZipAsset = zipAssets.find(asset => asset.name.includes('LEGACY'));
    const mainZipAsset = zipAssets.find(asset => !asset.name.includes('LEGACY'));
    const exeAsset = assets.find(asset => asset.name.endsWith('.exe'));

    const modDatabase = {
      modManager: {
        version: managerRelease.tag_name,
        downloadUrl: (legacyZipAsset ?? mainZipAsset)?.browser_download_url,
        zipDownloadUrl: (mainZipAsset ?? legacyZipAsset)?.browser_download_url,
        installerDownloadUrl: exeAsset?.browser_download_url,
      },
      releases: modReleases,
    };

    const databaseJson = JSON.stringify(modDatabase, null, JSON_INDENT);

    core.setOutput(Output.releases, databaseJson);

  } catch (error) {
    core.setFailed(error.message);
    console.log('error', error);
  }
}

run();
