import AdmZip from "adm-zip";
import { RequestError } from "@octokit/request-error";
import semver from "semver";
import { getOctokit } from "../helpers/octokit.ts";

export type CheckResult = {
  url: string | null;
  warnings: string[];
  error: string | null;
};

type CheckModOptions = {
  repo: string;
  expectedUniqueName?: string;
  skipDuplicateCheck: boolean;
  mods: Map<string, string>;
};

type Manifest = {
  uniqueName: string;
  name: string;
  author: string;
  version: string;
  dependencies?: string[];
};

class CheckError extends Error {}

function fail(message: string): never {
  throw new CheckError(message);
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function fixVersion(version: string) {
  return version.trim().replace(/^v+/, "");
}

export async function checkMod(
  options: CheckModOptions,
): Promise<CheckResult> {
  const octokit = getOctokit();
  const warnings: string[] = [];

  try {
    if (!options.skipDuplicateCheck && options.expectedUniqueName) {
      const existingName = options.mods.get(options.expectedUniqueName);
      if (existingName) {
        fail(
          `This unique name appears to be in use by another mod (${existingName}), please choose a different one`,
        );
      }
    }

    const [owner, repoName] = options.repo.split("/");
    if (!owner || !repoName) {
      throw new Error(`Invalid repo: ${options.repo}`);
    }

    let description: string | null | undefined;
    try {
      const { data } = await octokit.rest.repos.get({ owner, repo: repoName });
      description = data.description;
    } catch (error) {
      if (error instanceof RequestError) {
        fail(
          `This mod's repo doesn't appear to exist, please double check the URL you specified (GitHub gave status ${error.status})`,
        );
      }
      throw error;
    }

    let release;
    try {
      const { data } = await octokit.rest.repos.getLatestRelease({
        owner,
        repo: repoName,
      });
      release = data;
    } catch {
      fail("This mod appears to be missing a release, did you forget to publish it?");
    }

    const expectedVersion = fixVersion(release.tag_name);
    if (!semver.valid(expectedVersion)) {
      warnings.push(
        `The git tag (${release.tag_name}) of this mod's release is not parsable semver, this can cause your mod to always be marked as out of date on the mod manager`,
      );
    }

    const asset = release.assets.find((asset) => asset.name.endsWith(".zip"));
    if (!asset) {
      fail(
        "This mod has a release, but it's missing the mod asset, make sure you've uploaded a ZIP file",
      );
    }
    const downloadUrl = asset.browser_download_url;

    if (!description) {
      warnings.push(
        "This mod's repo doesn't have a description, the description is used on the manager and website to describe your mod. You can add one by clicking the pencil icon on the right sidebar on your repo's main page",
      );
    }

    try {
      await octokit.rest.repos.getReadme({ owner, repo: repoName });
    } catch {
      warnings.push(
        "This mod's repo doesn't have a README, the README is used on the website to describe your mod. You can add one by creating a file called `README.md` at the root of your repo",
      );
    }

    let license: string | null = null;
    try {
      const { data } = await octokit.rest.licenses.getForRepo({
        owner,
        repo: repoName,
      });
      license = data.license?.spdx_id ?? null;
    } catch {
      // No license file.
    }

    if (!license || !VALID_SPDX_LICENSES.includes(license.trim())) {
      fail(
        `This mod is not using an open source license. Please license it. (See [Choose a license](https://choosealicense.com/) for details). Current License: ${license ?? "No License"}`,
      );
    }

    const manifest = await downloadAndParseManifest(downloadUrl);

    const actualVersion = manifest.version;
    if (actualVersion !== expectedVersion) {
      fail(
        `The version of this mod's manifest does not match the tag of the release, expected ${expectedVersion} (from the release tag), got ${actualVersion} (from the mod's manifest.json). This can cause your mod to always be marked as out of date on the mod manager.`,
      );
    }

    if (
      options.expectedUniqueName &&
      manifest.uniqueName !== options.expectedUniqueName
    ) {
      fail(
        `The unique name of this mod is not what was expected, expected ${options.expectedUniqueName} (from the unique name you gave), got ${manifest.uniqueName} (from the mod's manifest.json)`,
      );
    }

    for (const dependency of manifest.dependencies ?? []) {
      if (!options.mods.has(dependency)) {
        fail(`This mod depends on another mod that seemingly doesn't exist: ${dependency}`);
      }
    }

    return { url: downloadUrl, warnings, error: null };
  } catch (error) {
    if (error instanceof CheckError) {
      return { url: null, warnings, error: error.message };
    }
    throw error;
  }
}

async function downloadAndParseManifest(url: string): Promise<Manifest> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (error) {
    fail(`Failed to download the mod: ${getErrorMessage(error)}`);
  }

  if (!response.ok) {
    fail(`Failed to download the mod: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  try {
    return parseManifestFromZip(buffer);
  } catch (error) {
    fail(`Failed to extract the mod archive: ${getErrorMessage(error)}`);
  }
}

function parseManifestFromZip(zipBuffer: Buffer): Manifest {
  let zip: AdmZip;
  try {
    zip = new AdmZip(zipBuffer);
  } catch (error) {
    throw new Error(`Failed to read the zip archive: ${getErrorMessage(error)}`);
  }

  for (const entry of zip.getEntries()) {
    const name = entry.entryName;
    if (!isSafeEntryName(name)) continue;
    if (name.split("/").pop() !== "manifest.json") continue;

    let text: string;
    try {
      text = entry.getData().toString("utf8");
    } catch (error) {
      throw new Error(`Failed to read manifest.json in the zip archive: ${getErrorMessage(error)}`);
    }

    return parseManifest(text);
  }

  throw new Error("Manifest not found in zip archive");
}

function isSafeEntryName(name: string) {
  if (name.startsWith("/")) return false;
  return !name.split("/").includes("..");
}

function parseManifest(raw: string): Manifest {
  const text = raw.replace(/^\uFEFF/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON in manifest.json: ${getErrorMessage(error)}`);
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Invalid manifest.json: expected a JSON object");
  }

  const obj = parsed as Record<string, unknown>;

  for (const field of ["uniqueName", "name", "author", "version"]) {
    if (typeof obj[field] !== "string") {
      throw new Error(`Invalid manifest.json: missing or invalid field "${field}"`);
    }
  }

  for (const field of ["filename", "owmlVersion", "patcher", "donateLink"]) {
    if (obj[field] !== undefined && typeof obj[field] !== "string") {
      throw new Error(`Invalid manifest.json: field "${field}" must be a string`);
    }
  }

  for (const field of ["dependencies", "conflicts", "pathsToPreserve", "donateLinks"]) {
    if (
      obj[field] !== undefined &&
      (!Array.isArray(obj[field]) ||
        obj[field].some((value) => typeof value !== "string"))
    ) {
      throw new Error(`Invalid manifest.json: field "${field}" must be an array of strings`);
    }
  }

  const warning = obj.warning;
  if (
    warning !== undefined &&
    (typeof warning !== "object" ||
      warning === null ||
      typeof (warning as Record<string, unknown>).title !== "string" ||
      typeof (warning as Record<string, unknown>).body !== "string")
  ) {
    throw new Error(
      'Invalid manifest.json: field "warning" must be an object with "title" and "body" strings',
    );
  }

  return {
    uniqueName: obj.uniqueName as string,
    name: obj.name as string,
    author: obj.author as string,
    version: fixVersion(obj.version as string),
    dependencies: obj.dependencies as string[] | undefined,
  };
}

export function renderMarkdown(result: CheckResult) {
  let issues = "### Issues\n\n";

  if (result.error) {
    issues += `> [!CAUTION]\n> ${result.error}\n\n`;
  }
  for (const warning of result.warnings) {
    issues += `> [!WARNING]\n> ${warning}\n\n`;
  }

  if (issues === "### Issues\n\n") {
    issues = "";
  }

  let out = "### Results\n\n";

  if (!result.error) {
    out += "> ✔ Success! This mod passed all checks!\n\n";

    if (result.url) {
      out +=
        `You can test installing your mod by pasting the link below into your URL bar, ` +
        `the mod manager should open and install it.\n\n\`\`\`txt\nowmods://install-url/${result.url}\n\`\`\`\n\n`;
    }

    out += "Now that all checks have passed, please wait until a database admin approves your mod.\n\n";
  } else {
    out +=
      "> ❌ Failed, This mod doesn't seem to be valid, please fix the errors above and try again.\n\n";
    out +=
      "If you need help or believe this is a mistake, please [join the Discord](https://discord.gg/wusTQYbYTc).\n\n";
  }

  return `## Mod Checker Report\n\nThis is an automated system to check your mod for common issues, please see the results below.\n\n${issues}${out.trimEnd()}\n`;
}

// Copied from https://github.com/Bwc9876/mods-checker/blob/main/src/licenses.rs
const VALID_SPDX_LICENSES: readonly string[] = [
  "CDDL-1.1",
  "BSD-3-Clause-Open-MPI",
  "MIT-CMU",
  "BlueOak-1.0.0",
  "ICU",
  "OLFL-1.3",
  "EUPL-1.1",
  "Jam",
  "ZPL-2.1",
  "CERN-OHL-S-2.0",
  "CERN-OHL-W-2.0",
  "CERN-OHL-P-2.0",
  "MIT-0",
  "Unicode-DFS-2015",
  "Unlicense",
  "PHP-3.01",
  "CAL-1.0",
  "MulanPSL-2.0",
  "OLDAP-2.8",
  "BSD-1-Clause",
  "BSD-3-Clause-LBNL",
  "EPL-2.0",
  "LGPL-2.0-only",
  "UCL-1.0",
  "BSD-2-Clause-Patent",
  "LiLiQ-Rplus-1.1",
  "LiLiQ-R-1.1",
  "LiLiQ-P-1.1",
  "OSET-PL-2.1",
  "eCos-2.0",
  "0BSD",
  "UPL-1.0",
  "CECILL-2.1",
  "Artistic-1.0-Perl",
  "MPL-2.0",
  "EUPL-1.2",
  "BSD-3-Clause",
  "LPPL-1.3c",
  "PostgreSQL",
  "IPA",
  "OFL-1.1",
  "MirOS",
  "NPOSL-3.0",
  "NTP",
  "AGPL-3.0-only",
  "ISC",
  "RPL-1.5",
  "BSL-1.0",
  "Multics",
  "OSL-2.1",
  "SimPL-2.0",
  "LGPL-3.0-only",
  "GPL-3.0-only",
  "MS-RL",
  "MS-PL",
  "Artistic-2.0",
  "ECL-2.0",
  "EPL-1.0",
  "CPAL-1.0",
  "CPL-1.0",
  "OSL-1.0",
  "Zlib",
  "ZPL-2.0",
  "Xnet",
  "wxWindows",
  "W3C-20150513",
  "VSL-0.1",
  "NCSA",
  "Watcom-1.0",
  "SPL-1.0",
  "SISSL",
  "Sleepycat",
  "RSCPL",
  "RPL-1.1",
  "RPSL-1.0",
  "QPL-1.0",
  "PSF-2.0",
  "CNRI-Python",
  "PHP-3.0",
  "OSL-3.0",
  "OGTSL",
  "NOKIA",
  "NGPL",
  "Naumen",
  "NASA-1.3",
  "MPL-1.1",
  "MPL-1.0",
  "Motosoto",
  "MIT",
  "LPL-1.02",
  "LPL-1.0",
  "Intel",
  "IPL-1.0",
  "HPND",
  "LGPL-2.1",
  "GPL-2.0",
  "Frameworx-1.0",
  "Fair",
  "Entessa",
  "EFL-2.0",
  "EFL-1.0",
  "ECL-1.0",
  "EUDatagrid",
  "CUA-OPL-1.0",
  "CDDL-1.0",
  "CATOSL-1.1",
  "BSD-2-Clause",
  "AAL",
  "Artistic-1.0",
  "APSL-2.0",
  "Apache-2.0",
  "Apache-1.1",
  "APL-1.0",
  "AFL-3.0",
  "AGPL-3.0",
  "GPL-3.0",
];
