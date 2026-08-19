import { createHash } from "crypto";
import { promises as fsp } from "fs";
import path from "path";

import AdmZip from "adm-zip";

import { getOctokit } from "../helpers/octokit.ts";
import { DATABASE_REPOSITORY, WEBSITE_REPOSITORY } from "../config.ts";

export async function deployDatabase(databaseDirectory: string) {
  // Git blob objects are addressed by the sha1 of "blob <size>\0<content>".
  // Computing this locally lets us avoid uploading (and creating blobs for) files
  // that are unchanged since the last commit on master.
  function getGitBlobSha(content: Buffer): string {
    const header = `blob ${content.length}\0`;
    return createHash("sha1").update(header).update(content).digest("hex");
  }

  async function getLocalFiles(directory: string) {
    const files: { path: string; content: Buffer }[] = [];

    const walk = async (currentDirectory: string, relativePath: string) => {
      const entries = await fsp.readdir(currentDirectory, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const entryPath = path.join(currentDirectory, entry.name);
        const entryRelativePath = path
          .join(relativePath, entry.name)
          .replace(/\\/g, "/");

        if (entry.isDirectory()) {
          await walk(entryPath, entryRelativePath);
        } else {
          files.push({
            path: entryRelativePath,
            content: await fsp.readFile(entryPath),
          });
        }
      }
    };

    await walk(directory, "");
    return files;
  }

  async function getMasterState() {
    const octokit = getOctokit();

    const { data: ref } = await octokit.rest.git.getRef({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      ref: "heads/master",
    });
    const masterCommitSha = ref.object.sha;

    const { data: commit } = await octokit.rest.git.getCommit({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      commit_sha: masterCommitSha,
    });

    const { data: tree } = await octokit.rest.git.getTree({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      tree_sha: commit.tree.sha,
      recursive: "1",
    });

    return {
      masterCommitSha,
      masterTreeSha: commit.tree.sha,
      tree,
    };
  }

  async function commitDatabaseFiles(databaseDirectory: string) {
    const octokit = getOctokit();

    const [localFiles, { masterCommitSha, masterTreeSha, tree }] =
      await Promise.all([getLocalFiles(databaseDirectory), getMasterState()]);

    const masterFileShas = new Map<string, string>();

    for (const entry of tree.tree) {
      if (entry.type === "blob" && entry.path && entry.sha) {
        masterFileShas.set(entry.path, entry.sha);
      }
    }

    const changedFiles = localFiles.filter((file) => {
      return masterFileShas.get(file.path) !== getGitBlobSha(file.content);
    });

    if (changedFiles.length === 0) {
      console.log("No changes to commit to the database repository");
      return;
    }

    const treeItems = await Promise.all(
      changedFiles.map(async ({ path: filePath, content }) => {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner: DATABASE_REPOSITORY.owner,
          repo: DATABASE_REPOSITORY.repo,
          content: content.toString("base64"),
          encoding: "base64",
        });

        return {
          path: filePath,
          mode: "100644" as const,
          type: "blob" as const,
          sha: blob.sha,
        };
      }),
    );

    const { data: newTree } = await octokit.rest.git.createTree({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      base_tree: masterTreeSha,
      tree: treeItems,
    });

    if (newTree.sha === masterTreeSha) {
      console.log("No changes to commit to the database repository");
      return;
    }

    const COMMIT_MESSAGE = "Update mod database";
    const COMMITTER = {
      name: "Outer Wilds Mod Database",
      email: "database@outerwildsmods.com",
    } as const;

    const { data: newCommit } = await octokit.rest.git.createCommit({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      message: COMMIT_MESSAGE,
      tree: newTree.sha,
      parents: [masterCommitSha],
      author: COMMITTER,
      committer: COMMITTER,
    });

    await octokit.rest.git.updateRef({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      ref: "heads/master",
      sha: newCommit.sha,
    });

    console.log(
      `Committed ${changedFiles.length} file(s) to ${DATABASE_REPOSITORY.owner}/${DATABASE_REPOSITORY.repo} master (${newCommit.sha})`,
    );
  }

  async function getActionsOidcToken(): Promise<string> {
    const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;

    if (!requestUrl || !requestToken) {
      throw new Error(
        "Missing ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN environment variables " +
          "(requires the id-token: write permission in the workflow).",
      );
    }

    const url = requestUrl.includes("audience=")
      ? requestUrl.replace(/audience=[^&]*/, `audience=github-pages`)
      : `${requestUrl}&audience=github-pages`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${requestToken}` },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to get OIDC token: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { value?: string };

    if (!data.value) {
      throw new Error("OIDC token response did not include a value");
    }

    return data.value;
  }

  async function deployToPages(databaseDirectory: string) {
    const octokit = getOctokit();

    const zip = new AdmZip();
    zip.addLocalFolder(databaseDirectory);
    const zipBase64 = zip.toBuffer().toString("base64");

    const oidcToken = await getActionsOidcToken();

    const { data: artifact } = await octokit.request(
      "POST /repos/{owner}/{repo}/actions/artifacts",
      {
        owner: DATABASE_REPOSITORY.owner,
        repo: DATABASE_REPOSITORY.repo,
        name: "github-pages",
        archive_format: "zip",
        artifact_zip: zipBase64,
      },
    );

    const artifactId = (artifact as { id: number }).id;
    console.log(`Uploaded pages artifact #${artifactId}`);

    const { data: deployment } = await octokit.rest.repos.createPagesDeployment(
      {
        owner: DATABASE_REPOSITORY.owner,
        repo: DATABASE_REPOSITORY.repo,
        artifact_url: `/repos/${DATABASE_REPOSITORY.owner}/${DATABASE_REPOSITORY.repo}/actions/artifacts/${artifactId}/zip`,
        pages_build_version: `${DATABASE_REPOSITORY.repo}.${Date.now()}`,
        oidc_token: oidcToken,
      },
    );

    console.log(
      `Created pages deployment, status URL: ${deployment.status_url}`,
    );

    const DEPLOYED_STATUS = "succeed";
    const FAILURE_STATUSES = new Set([
      "deployment_cancelled",
      "deployment_failed",
      "deployment_content_failed",
      "deployment_attempt_error",
      "deployment_lost",
    ]);
    const POLL_INTERVAL_MS = 3000;
    const TIMEOUT_MS = 5 * 60 * 1000;

    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT_MS) {
      const { data } = await octokit.rest.repos.getPagesDeployment({
        owner: DATABASE_REPOSITORY.owner,
        repo: DATABASE_REPOSITORY.repo,
        pages_deployment_id: deployment.id,
      });
      const status = data.status;

      console.log(`Pages deployment status: ${status}`);

      if (status === DEPLOYED_STATUS) {
        break;
      }

      if (status && FAILURE_STATUSES.has(status)) {
        throw new Error(`Pages deployment failed with status: ${status}`);
      }

      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (Date.now() - startTime >= TIMEOUT_MS) {
      throw new Error("Timed out waiting for pages deployment");
    }

    console.log(`Pages deployed: ${deployment.page_url}`);
  }

  await commitDatabaseFiles(databaseDirectory);

  await deployToPages(databaseDirectory);

  await getOctokit().rest.repos.createDispatchEvent({
    owner: WEBSITE_REPOSITORY.owner,
    repo: WEBSITE_REPOSITORY.repo,
    event_type: "build",
  });

  console.log(
    `Dispatched build event to ${WEBSITE_REPOSITORY.owner}/${WEBSITE_REPOSITORY.repo}`,
  );
}

