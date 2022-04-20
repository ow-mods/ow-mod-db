import { getOctokit } from "./get-octokit";

export async function getPreviousDatabase() {
  const octokit = getOctokit();

  const previousDatabaseResponse: any = (
    await octokit.rest.repos.getContent({
      // TODO get owner and repo from current action repo.
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
