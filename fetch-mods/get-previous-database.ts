import { getOctokit } from "@actions/github";

export async function getPreviousDatabase(gitHubToken: string) {
  const octokit = getOctokit(gitHubToken);

  const previousDatabaseResponse: any = (
    await octokit.rest.repos.getContent({
      owner: "Raicuparta",
      repo: "ow-mod-db",
      path: "database.json",
      ref: "master",
      mediaType: {
        format: "raw",
      },
    })
  ).data;

  const previousDatabase: Mod[] = JSON.parse(previousDatabaseResponse).releases;

  return previousDatabase;
}
