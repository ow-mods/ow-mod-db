import { promises as fsp } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { DATABASE_FILE_NAME, THUMBNAIL_URL_BASE } from "../config.ts";
import { getDiff, type DiffItem, type NotifiedMods } from "./get-diff.ts";
import {
  applyDiffToState,
  createNotificationState,
  getNotificationStatePath,
  readNotificationState,
  writeNotificationState,
} from "./notification-state.ts";
import type { BaseMod, DatabaseOutput, OutputMod } from "../mod.ts";

const MAX_EMBEDS_PER_MESSAGE = 10;
const MAX_SEND_ATTEMPTS = 3;
const MAX_DESCRIPTION_LENGTH = 4000;
const TRUNCATED_DISCLAIMER =
  "**...**\n\n**Check the mod repo for the complete changelog.**";

const NOTIFICATION_CONFIG = {
  new: {
    color: 3066993,
    imageKey: "image",
    urlParams: "?linked-from-notification=true",
  },
  update: {
    color: 15105570,
    imageKey: "thumbnail",
    urlParams: "",
  },
  prerelease: {
    color: 0,
    imageKey: "thumbnail",
    urlParams: "?prerelease=true",
  },
} as const;

export async function notifyDatabase(databaseDirectory: string) {
  const nextDatabaseFile = path.join(databaseDirectory, DATABASE_FILE_NAME);
  const notificationsFile = getNotificationStatePath(databaseDirectory);

  const [nextMods, state] = await Promise.all([
    readDatabaseMods(nextDatabaseFile),
    readNotificationState(notificationsFile),
  ]);

  if (!state) {
    await primeNotificationState(notificationsFile, nextMods);
    return;
  }

  const diff = getDiff(state, nextMods);

  if (diff.length === 0) {
    console.log("No notifications to send");
    return;
  }

  await sendAndAdvanceState(notificationsFile, state, diff);
}

export async function notifyMod(
  databaseFile: string,
  modUniqueName: string,
  previousVersion?: string,
) {
  const mods = await readDatabaseMods(databaseFile);
  const mod = mods.find(
    (candidate) => candidate.uniqueName === modUniqueName,
  );

  if (!mod) {
    throw new Error(`Mod "${modUniqueName}" was not found in ${databaseFile}`);
  }

  const notificationsFile = getNotificationStatePath(
    path.dirname(databaseFile),
  );
  const state = await readNotificationState(notificationsFile);

  if (!state) {
    await primeNotificationState(notificationsFile, mods);
    return;
  }

  const diff: DiffItem[] = [
    {
      diffType: "release",
      nextMod: mod,
      previousVersion,
    },
  ];

  await sendAndAdvanceState(notificationsFile, state, diff);
}

async function primeNotificationState(
  notificationsFile: string,
  mods: BaseMod[],
) {
  await writeNotificationState(
    notificationsFile,
    createNotificationState(mods),
  );
  console.log(
    `Notification state not found. Initialized ${notificationsFile} with ${mods.length} mods; skipping notifications for this run.`,
  );
}

async function sendAndAdvanceState(
  notificationsFile: string,
  state: NotifiedMods,
  diff: DiffItem[],
) {
  await sendDiffNotifications(diff);
  await writeNotificationState(
    notificationsFile,
    applyDiffToState(state, diff),
  );
  console.log(`Notification state written to ${notificationsFile}`);
}

async function sendDiffNotifications(diff: DiffItem[]) {
  const discordHookUrl = process.env.DISCORD_HOOK_URL;

  if (!discordHookUrl) {
    throw new Error("DISCORD_HOOK_URL is not set");
  }

  const updateRoleId = process.env.DISCORD_MOD_UPDATE_ROLE_ID ?? "";
  const newModRoleId = process.env.DISCORD_NEW_MOD_ROLE_ID ?? "";

  console.log(`Sending notifications for ${diff.length} items...`);

  for (
    let index = 0;
    index < diff.length;
    index += MAX_EMBEDS_PER_MESSAGE
  ) {
    const chunk = diff.slice(index, index + MAX_EMBEDS_PER_MESSAGE);
    const containsNewMod = chunk.some(
      (diffItem) =>
        diffItem.diffType === "release" && !diffItem.previousVersion,
    );

    const roleIds = containsNewMod
      ? [updateRoleId, newModRoleId]
      : [updateRoleId];
    const content = roleIds
      .filter(Boolean)
      .map((roleId) => `<@&${roleId}>`)
      .join(" ");

    await postDiscordMessage(discordHookUrl, {
      content,
      embeds: chunk.map(getEmbed),
    });

    console.log(
      `Sent notifications for ${index + chunk.length}/${diff.length} items.`,
    );
  }

  console.log("Done");
}

async function postDiscordMessage(webhookUrl: string, payload: unknown) {
  const url = new URL(webhookUrl);
  url.searchParams.set("wait", "true");

  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= MAX_SEND_ATTEMPTS; attempt++) {
    let response: Response;

    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });
    } catch (error) {
      if (attempt === MAX_SEND_ATTEMPTS) {
        throw error;
      }

      const delayMs = getBackoffDelayMs(attempt);
      console.warn(
        `Discord request failed: ${error}. Retrying in ${delayMs}ms...`,
      );
      await sleep(delayMs);
      continue;
    }

    if (response.ok) {
      return;
    }

    const responseText = await response.text().catch(() => "");
    const error = new Error(
      `Discord API post response not ok. ${response.status}: ${
        response.statusText
      }${responseText ? ` - ${responseText}` : ""}`,
    );

    const isRetryable = response.status === 429 || response.status >= 500;

    if (!isRetryable || attempt === MAX_SEND_ATTEMPTS) {
      throw error;
    }

    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const delayMs =
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : getBackoffDelayMs(attempt);

    console.warn(`${error.message}. Retrying in ${delayMs}ms...`);
    await sleep(delayMs);
  }
}

function getBackoffDelayMs(attempt: number) {
  return 1000 * 2 ** (attempt - 1);
}

function getNotificationTitle(diffItem: DiffItem) {
  const { nextMod } = diffItem;

  if (diffItem.diffType === "prerelease") {
    return `Prerelease **${nextMod.prerelease?.version}**`;
  }

  if (!diffItem.previousVersion) {
    return `New ${
      nextMod.parent ? `addon for \`${nextMod.parent}\`` : "mod"
    }`;
  }

  return `Update ${diffItem.previousVersion} → **${nextMod.version}**`;
}

function getNotificationDescription(diffItem: DiffItem) {
  const { diffType, nextMod } = diffItem;

  const description =
    diffType === "prerelease"
      ? nextMod.latestPrereleaseDescription || nextMod.description
      : diffItem.previousVersion
        ? nextMod.latestReleaseDescription || nextMod.description
        : nextMod.description;

  return (
    truncateDescription(description) ||
    `Mod tagged as ${
      nextMod.tags.length > 0 ? nextMod.tags.join(",") : "ABSOLUTELY NOTHING"
    }`
  );
}

function truncateDescription(description: string) {
  if (description.length <= MAX_DESCRIPTION_LENGTH) {
    return description;
  }

  let truncated = description.slice(
    0,
    MAX_DESCRIPTION_LENGTH - TRUNCATED_DISCLAIMER.length,
  );

  // Don't slice in the middle of a word.
  const lastSpaceIndex = truncated.lastIndexOf(" ");
  if (lastSpaceIndex > 0) {
    truncated = truncated.slice(0, lastSpaceIndex);
  }

  // Don't leave an unclosed markdown link.
  const openBracketIndex = truncated.lastIndexOf("[");
  const closeBracketIndex = truncated.lastIndexOf("]");
  if (
    openBracketIndex !== -1 &&
    closeBracketIndex < openBracketIndex
  ) {
    truncated = truncated.slice(0, openBracketIndex);
  }

  return `${truncated}${TRUNCATED_DISCLAIMER}`;
}

function getEmbed(diffItem: DiffItem) {
  const { nextMod } = diffItem;
  const config = NOTIFICATION_CONFIG[getNotificationType(diffItem)];
  const description = getNotificationDescription(diffItem);

  return {
    type: "rich",
    title: nextMod.name,
    description: `${getNotificationTitle(diffItem)}\n>>> ${description}`,
    fields: [
      {
        name: "\u200B",
        value: `<:github:1085179483784499260> [Source Code](${nextMod.repo})`,
      },
    ],
    author: {
      name: nextMod.authorDisplay ?? nextMod.author,
      icon_url: `https://github.com/${nextMod.author}.png`,
    },
    url: `https://outerwildsmods.com/mods/${nextMod.slug}${config.urlParams}`,
    color: config.color,
    [config.imageKey]: {
      url: `${THUMBNAIL_URL_BASE}/${
        nextMod.thumbnail.openGraph ?? nextMod.thumbnail.main
      }`,
    },
  };
}

function getNotificationType(diffItem: DiffItem) {
  if (diffItem.diffType === "prerelease") {
    return "prerelease";
  }

  return diffItem.previousVersion ? "update" : "new";
}

async function readDatabaseMods(filePath: string): Promise<OutputMod[]> {
  const json = await fsp.readFile(filePath, "utf8");
  const databaseOutput: DatabaseOutput = JSON.parse(json);

  return [...databaseOutput.releases, ...databaseOutput.alphaReleases];
}
