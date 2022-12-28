import { getOctokit } from "./get-octokit.js";

export async function getPreviousDatabase() {
  const octokit = getOctokit();

  const previousDatabaseResponse: any = (
    await octokit.rest.repos.getContent({
      // TODO get owner and repo from current action repo.
      owner: "ow-mods",
      repo: "ow-mod-db",
      path: "database.json",
      ref: "master",
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
