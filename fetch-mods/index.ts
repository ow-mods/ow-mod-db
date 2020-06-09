import * as core from '@actions/core';
import { GitHub } from '@actions/github';
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
    const octokit = new GitHub(gitHubToken);

    const managerRelease = (await octokit.repos.getLatestRelease(managerRepo)).data;

    const results = [];
    for (let mod of mods) {
      const [owner, repo] = mod.repo.split('/');

      const releaseList = (await octokit.paginate("GET /repos/:owner/:repo/issues?per_page=100", {
        owner,
        repo,
      })).filter(release => !release.prerelease);

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
            downloadCount: asset.download_count
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
      };

      return modInfo;
    });

    const modDatabase = {
      modManager: {
        version: managerRelease.tag_name,
        downloadUrl: managerRelease.assets[0].browser_download_url,
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
