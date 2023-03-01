import {
  DATABASE_FILE_NAME,
  DATABASE_REPO,
  DATABASE_REPO_BRANCH,
} from "./constants.js";
import { getOctokit } from "./helpers/octokit.js";

export async function getPreviousDatabase() {
  const octokit = getOctokit();

  const previousDatabaseResponse: any = (
    await octokit.rest.repos.getContent({
      ...DATABASE_REPO,
      path: DATABASE_FILE_NAME,
      ref: DATABASE_REPO_BRANCH,
      mediaType: {
        format: "raw",
      },
    })
  ).data;

  const responseJson = JSON.parse(previousDatabaseResponse);
  const previousDatabase: Mod[] = [
    ...responseJson.releases,
    ...responseJson.alphaReleases,
  ];

  return previousDatabase;
}
