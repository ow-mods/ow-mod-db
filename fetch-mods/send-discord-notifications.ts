import axios from "axios";
import { DiffItem } from "./get-diff";

function getNotificationTitle(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return `Added ${diffItem.nextMod.name} by ${diffItem.nextMod.author}`;
    case "remove":
      return `Removed ${diffItem.previousMod.name} by ${diffItem.previousMod.author}`;
    case "update":
      return `Updated ${diffItem.nextMod.name} by ${diffItem.nextMod.author}`;
    case "update-prerelease":
      return `Updated prerelease of ${diffItem.nextMod.name} by ${diffItem.nextMod.author}`;
  }
}

function getNotificationDescription(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return `${
        diffItem.nextMod.parent
          ? `Addon for \`${diffItem.nextMod.parent}\`. `
          : ""
      }${diffItem.nextMod.description}`;
    case "remove":
      return "";
    case "update": {
      const nextReleaseDescription = diffItem.nextMod.latestReleaseDescription;

      return `${diffItem.previousMod!.version} → **${
        diffItem.nextMod.version
      }**.${nextReleaseDescription ? "\n >>> " : ""}${nextReleaseDescription}`;
    }
    case "update-prerelease": {
      const prereleaseDescription =
        diffItem.nextMod.latestPrereleaseDescription;

      return `Prerelease **${diffItem.nextMod.prerelease?.version}**.${
        prereleaseDescription ? "\n >>> " : ""
      }${prereleaseDescription}`;
    }
  }
}

function getNotificationColor(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return 3066993;
    case "remove":
      return 10038562;
    case "update":
      return 15105570;
    case "update-prerelease":
      return 0;
  }
}
function getRelevantMod(diffItem: DiffItem) {
  return diffItem.diffType == "remove"
    ? diffItem.previousMod
    : diffItem.nextMod;
}

function getEmbed(diffItem: DiffItem) {
  return {
    title: getNotificationTitle(diffItem),
    description: getNotificationDescription(diffItem),
    url: getRelevantMod(diffItem).repo,
    color: getNotificationColor(diffItem),
  };
}

export async function sendDiscordNotifications(
  discordHookUrl: string,
  diff: DiffItem[],
  discordModHookUrls: Record<string, string>
) {
  try {
    axios.post(discordHookUrl, {
      embeds: diff.map(getEmbed),
    });
  } catch (error) {
    console.error(
      `Failed to send Discord notification for ${diff.length} diffs: ${error}`
    );
  }

  for (const diffItem of diff) {
    try {
      const discordModHookUrl =
        discordModHookUrls[getRelevantMod(diffItem).uniqueName];
      if (discordModHookUrl) {
        axios.post(discordModHookUrl, {
          embeds: [getEmbed(diffItem)],
        });
      }
    } catch (error) {
      console.error(
        `Failed to send Discord notification for specific mod channel: ${error}`
      );
    }
  }
}
