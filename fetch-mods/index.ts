import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import axios from 'axios';
import { release } from 'os';

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

      const releaseList = (await octokit.paginate(octokit.repos.listReleases, {
        owner,
        repo,
        per_page: 100,
      })).filter(release => !release.prerelease);;

      if (releaseList.length === 0) {
        continue;
      }

      const manifest: Manifest = (await axios(
        `${RAW_URL_BASE}/${owner}/${repo}/master/${mod.manifest}`
      )).data;

      results.push({
        releaseList,
        manifest,
        repo: `${REPO_URL_BASE}/${mod.repo}`,
        required: mod.required,
      });
    }

    const modReleases: Mod[] = results.map(({ repo, releaseList, manifest, required }) => {
      const releases: Release[] = releaseList
        .filter(({ assets }) => assets.length > 0)
        .map(release => {
          const asset = release.assets[0];

          return {
            downloadUrl: asset.browser_download_url,
            downloadCount: asset.download_count,
            version: release.tag_name,
          };
        });

      const totalDownloadCount = releases.reduce((accumulator, release) => {
        return accumulator + release.downloadCount;
      }, 0);

      const latestRelease = releases[0];

      const modInfo: Mod = {
        downloadUrl: latestRelease.downloadUrl,
        downloadCount: totalDownloadCount,
        repo,
        manifest,
        required,
        version: latestRelease.version,
      };

      return modInfo;
    });

    const assets = managerRelease.assets;
    const zipAssets = assets.filter(asset => asset.content_type.includes('zip'));
    const legacyZipAsset = zipAssets.find(asset => asset.name.includes('LEGACY'));
    const mainZipAsset = zipAssets.find(asset => !asset.name.includes('LEGACY'));
    const exeAsset = assets.find(asset => asset.content_type.includes('msdownload'));

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
