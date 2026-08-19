import { parseIssue, type Checkboxes } from "@github/issue-parser";

// From .github/ISSUE_TEMPLATE/add-mod.yml.
export type ModIssueForm = {
  name?: string;
  uniqueName?: string;
  repoUrl?: string;
  thumbnailUrl?: string;
  alpha: string[];
  dlc: string[];
  parent?: string;
  authorDisplay?: string;
  tags: string[];
};

export type ParsedIssue = ModIssueForm & {
  // discordId not used anywhere in the codebase right now (unless this comment is outdated), but
  // used to identify the modder and give them their purple role.
  discordId?: string;
  isEdit: string[];
};

function getString(value: string | string[] | Checkboxes | undefined) {
  if (typeof value !== "string") return undefined;
  return value === "_No response_" ? undefined : value;
}

function getStringArray(value: string | string[] | Checkboxes | undefined) {
  return Array.isArray(value) ? value : [];
}

export function parseModIssueForm(
  issueBody: string,
  template: string,
): ParsedIssue {
  const parsed = parseIssue(issueBody, template);

  return {
    discordId: getString(parsed.discordId),
    uniqueName: getString(parsed.uniqueName),
    name: getString(parsed.name),
    repoUrl: getString(parsed.repoUrl),
    thumbnailUrl: getString(parsed.thumbnailUrl),
    tags: getStringArray(parsed.tags),
    authorDisplay: getString(parsed.authorDisplay),
    parent: getString(parsed.parent),
    isEdit: getStringArray(parsed.isEdit),
    dlc: getStringArray(parsed.dlc),
    alpha: getStringArray(parsed.alpha),
  };
}
