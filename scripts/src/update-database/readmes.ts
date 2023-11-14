import { RequestError } from "@octokit/request-error";
import { CreatedOctokit } from "./octokit.js";
import fetch from "node-fetch";
import { ModInfo } from "../mod-info.js";

export async function getReadmeUrls(
  octokit: CreatedOctokit,
  owner: string,
  repo: string,
  modInfo: ModInfo
) {
  try {
    const response = await octokit.rest.repos.getReadme({
      owner,
      repo,
    });

    if (response.status != 200) {
      return undefined;
    }

    const readme = response.data;

    return {
      htmlUrl: readme.html_url || undefined,
      downloadUrl: readme.download_url || undefined,
    };
  } catch (error) {
    if (error instanceof RequestError && error.status == 404) {
      // 404s are expected, ignore.
      return undefined;
    }
    console.log(
      `Failed to get readme for mod ${modInfo.uniqueName}: ${error}"`
    );
    return undefined;
  }
}

export async function getReadmeMarkdown(url: string): Promise<string | null> {
  const response = await fetch(url);
  return response.status === 200 ? response.text() : null;
}
