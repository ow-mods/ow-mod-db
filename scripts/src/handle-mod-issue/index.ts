import { readFileSync } from "node:fs";
import { parseRequiredArgs } from "../helpers/args.ts";
import { getOctokit } from "../helpers/octokit.ts";
import {
  ADD_MOD_LABEL,
  DATABASE_REPOSITORY,
} from "../config.ts";
import type { ModList } from "../mod-info.ts";
import {
  checkMod,
  getErrorMessage,
  renderMarkdown,
  type CheckResult,
} from "./checker.ts";
import { parseModIssueForm, type ParsedIssue } from "./issue-form.ts";
import { modifyModList } from "./modify-mod-list.ts";

const REPORT_COMMENT_MARKER = "<!-- mod-check-report -->";

const RETRY_HINT =
  "You can retry this check anytime by commenting `checker, retry`.";

const values = parseRequiredArgs(
  {
    options: {
      modsFile: { type: "string" },
      issueTemplateFile: { type: "string" },
      issueNumber: { type: "string" },
      commentAuthor: { type: "string" },
    },
    required: ["modsFile", "issueTemplateFile", "issueNumber", "commentAuthor"],
  },
);

const { modsFile, issueTemplateFile, issueNumber, commentAuthor } = values;

function extractModRepo(repoUrl: string): string | undefined {
  let repo = repoUrl.match(/github\.com\/([^/]+\/[^/]+)\/?.*/)?.[1];

  if (repo?.endsWith(".git")) {
    repo = repo.slice(0, -4);
  }

  return repo;
}

function buildPendingComment() {
  return `${REPORT_COMMENT_MARKER}\n:hourglass: **Checking mod...**\n\n${RETRY_HINT}`;
}

function buildResultsComment(resultsContent: string) {
  return `${REPORT_COMMENT_MARKER}\n${resultsContent}\n\n${RETRY_HINT}`;
}

function buildFailureComment(message: string) {
  return `${REPORT_COMMENT_MARKER}\n:warning: **Couldn't process this mod request:** ${message}\n\n${RETRY_HINT}`;
}

async function findReportComment(issueNumber: number) {
  const octokit = getOctokit();
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: DATABASE_REPOSITORY.owner,
    repo: DATABASE_REPOSITORY.repo,
    issue_number: issueNumber,
    per_page: 100,
  });

  const reportComment = comments.find(
    (comment) =>
      comment.user?.login === commentAuthor &&
      comment.body?.includes(REPORT_COMMENT_MARKER),
  );

  return reportComment ? Number(reportComment.id) : undefined;
}

async function updateOrCreateReportComment(
  issueNumber: number,
  body: string,
  commentId?: number,
) {
  const octokit = getOctokit();
  const existingId = commentId ?? (await findReportComment(issueNumber));

  if (existingId) {
    try {
      await octokit.rest.issues.updateComment({
        owner: DATABASE_REPOSITORY.owner,
        repo: DATABASE_REPOSITORY.repo,
        comment_id: existingId,
        body,
      });
      return existingId;
    } catch (error) {
      console.warn(
        "Failed to update report comment, creating a new one: ",
        error,
      );
    }
  }

  const { data } = await octokit.rest.issues.createComment({
    owner: DATABASE_REPOSITORY.owner,
    repo: DATABASE_REPOSITORY.repo,
    issue_number: issueNumber,
    body,
  });

  return Number(data.id);
}

async function run() {
  const issueNumberValue = Number(issueNumber);
  if (!Number.isInteger(issueNumberValue) || issueNumberValue <= 0) {
    throw new Error(`Invalid issue number: ${issueNumber}`);
  }

  const octokit = getOctokit();

  const { data: issue } = await octokit.rest.issues.get({
    owner: DATABASE_REPOSITORY.owner,
    repo: DATABASE_REPOSITORY.repo,
    issue_number: issueNumberValue,
  });

  const applicable =
    issue.state !== "closed" &&
    issue.labels?.some(
      (label) => typeof label !== "string" && label.name === ADD_MOD_LABEL,
    ) &&
    !issue.pull_request;

  if (!applicable) {
    console.log("Issue is not applicable for a mod check, skipping");
    return;
  }

  const postComment = (body: string, commentId?: number) =>
    updateOrCreateReportComment(issueNumberValue, body, commentId);

  const template = readFileSync(issueTemplateFile, "utf8");

  let form: ParsedIssue;

  try {
    form = parseModIssueForm(issue.body ?? "", template);
  } catch (error) {
    console.error("Failed to parse the issue form: ", error);
    await postComment(
      buildFailureComment("the issue form could not be parsed."),
    );
    return;
  }

  if (!form.name || !form.uniqueName || !form.repoUrl) {
    await postComment(
      buildFailureComment(
        "the issue form is missing required fields. Mod name, Mod uniqueName and GitHub repository URL are all required, please edit the issue to fill them in.",
      ),
    );
    return;
  }

  const modRepo = extractModRepo(form.repoUrl);

  if (!modRepo) {
    await postComment(
      buildFailureComment(
        `"${form.repoUrl}" is not a valid GitHub repository URL.`,
      ),
    );
    return;
  }

  const reportCommentId = await postComment(buildPendingComment());

  const modsContent = readFileSync(modsFile, "utf8");
  const mods = new Map(
    (JSON.parse(modsContent) as ModList).mods.map((mod) => [
      mod.uniqueName,
      mod.name,
    ]),
  );

  let result: CheckResult;
  try {
    result = await checkMod({
      repo: modRepo,
      expectedUniqueName: form.uniqueName,
      skipDuplicateCheck: form.isEdit.includes("Editing existing mod"),
      mods,
    });
  } catch (error) {
    result = {
      url: null,
      warnings: [],
      error: `The mod check crashed: ${getErrorMessage(error)}`,
    };
  }

  await postComment(
    buildResultsComment(renderMarkdown(result)),
    reportCommentId,
  );

  if (result.error) {
    console.log(`Mod check failed: ${result.error}`);
    return;
  }

  const { newContent, changed } = modifyModList(modsContent, form, modRepo);

  if (changed) {
    const title = `Add/Edit mod: ${form.uniqueName}`;

    const pr = await octokit.createPullRequest({
      owner: DATABASE_REPOSITORY.owner,
      repo: DATABASE_REPOSITORY.repo,
      title,
      body: `Created from #${issueNumberValue}\n${form.repoUrl}`,
      head: `add-mod-issue-${issueNumberValue}`,
      update: true,
      createWhenEmpty: false,
      labels: [ADD_MOD_LABEL],
      changes: [
        {
          files: {
            "mods.json": newContent,
          },
          commit: title,
          committer: {
            name: "Outer Wilds Mods",
            email: "workflows@outerwildsmods.com",
          },
        },
      ],
    });

    console.log(
      pr
        ? `Created/updated pull request #${String(pr.data.number)}`
        : "No changes to mods.json, no pull request created",
    );
  } else {
    console.log("No changes to mods.json, no pull request created");
  }

  await octokit.rest.issues.update({
    owner: DATABASE_REPOSITORY.owner,
    repo: DATABASE_REPOSITORY.repo,
    issue_number: issueNumberValue,
    state: "closed",
  });

  console.log(`Closed issue #${issueNumberValue}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
