import fetch from "node-fetch";
import { THUMBNAIL_URL_BASE } from "../constants.js";
import { DiffItem } from "./get-diff.js";

function getNotificationTitle(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return `New ${
        diffItem.nextMod.parent
          ? `addon for \`${diffItem.nextMod.parent}\``
          : "mod"
      }`;
    case "update": {
      return `Update ${diffItem.previousMod.version} → **${diffItem.nextMod.version}**`;
    }
    case "update-prerelease": {
      return `Prerelease **${diffItem.nextMod.prerelease?.version}**`;
    }
  }
}

function getNotificationDescription({ diffType, nextMod }: DiffItem) {
  let description: string | undefined = "";
  switch (diffType) {
    case "add":
      description = nextMod.description;
      break;
    case "update": {
      description = nextMod.latestReleaseDescription || nextMod.description;
      break;
    }
    case "update-prerelease": {
      description = nextMod.latestPrereleaseDescription || nextMod.description;
      break;
    }
  }

  const maxLength = 4000; // Max length of a Discord embed description is 4096, have to leave room for the title though.
  const truncatedDisclaimer =
    "**...**\n\n**Check the mod repo for the complete changelog.**";
  const endPosition = maxLength - 1 - truncatedDisclaimer.length;

  if (description && description.length > maxLength) {
    description = description.slice(0, endPosition);
    // Don't slice in the middle of a word
    let lastIndex = description.lastIndexOf(" ");
    if (description[lastIndex - 1].match(/^[.,:!?]/)) {
      lastIndex--;
    }
    description = description.slice(0, lastIndex);
    // Try to respect markdown links in the form [text text text](website.something.whatever)
    // Because we only slice at spaces we just have to check if we're inside square brackets
    const openSquareBracket = description.lastIndexOf("[");
    const closeSquareBracket = description.lastIndexOf("]");
    if (
      openSquareBracket != -1 &&
      (closeSquareBracket == -1 || closeSquareBracket < openSquareBracket)
    ) {
      description = description.slice(0, openSquareBracket);
    }
    description += truncatedDisclaimer;
  }

  return (
    description ||
    `Mod tagged as ${
      nextMod.tags.length > 0 ? nextMod.tags.join(",") : "ABSOLUTELY NOTHING"
    }`
  );
}

function getNotificationColor(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return 3066993;
    case "update":
      return 15105570;
    case "update-prerelease":
      return 0;
  }
}

function getNotificationImageKey(diffItem: DiffItem) {
  return diffItem.diffType === "add" ? "image" : "thumbnail";
}

function getUrlParams(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return "?linked-from-notification=true";
    case "update-prerelease":
      return "?prerelease=true";
    default:
      return "";
  }
}

function getEmbed(diffItem: DiffItem) {
  const description = getNotificationDescription(diffItem);

  return {
    type: "rich",
    title: diffItem.nextMod.name,
    description: `${getNotificationTitle(diffItem)}\n>>> ${description}`,
    fields: [
      {
        name: "\u200B",
        value: `<:github:1085179483784499260> [Source Code](${diffItem.nextMod.repo})`,
      },
    ],
    author: {
      name: diffItem.nextMod.authorDisplay ?? diffItem.nextMod.author,
      icon_url: `https://github.com/${diffItem.nextMod.author}.png`,
    },
    url: `https://outerwildsmods.com/mods/${
      diffItem.nextMod.slug
    }${getUrlParams(diffItem)}`,
    color: getNotificationColor(diffItem),
    [getNotificationImageKey(diffItem)]: {
      url: `${THUMBNAIL_URL_BASE}/${
        diffItem.nextMod.thumbnail.openGraph ?? diffItem.nextMod.thumbnail.main
      }`,
    },
  };
}

function pingRoleId(id: string) {
  return `<@&${id}>`;
}

export async function sendDiscordNotifications(
  discordHookUrl: string,
  discordModUpdateRoleId: string,
  discordNewModRoleId: string,
  diff: DiffItem[],
  discordModHookUrls: Record<string, string>
) {
  console.log(`Sending notifications for ${diff.length} items...`);

  try {
    if (diff.length > 0) {
      const containsNewMod = diff.find(
        (diffItem) => diffItem.diffType === "add"
      );

      const response = await fetch(discordHookUrl, {
        method: "post",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: `${pingRoleId(discordModUpdateRoleId)} ${
            containsNewMod ? pingRoleId(discordNewModRoleId) : ""
          }`,
          embeds: diff.map(getEmbed),
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Discord API post response not ok. ${response.status}: ${response.statusText}`
        );
      }
    }
  } catch (error) {
    console.error(
      `Failed to send Discord notification for ${diff.length} diffs: ${error}`
    );
  }

  for (const diffItem of diff) {
    try {
      const discordModHookUrl = discordModHookUrls[diffItem.nextMod.uniqueName];
      if (discordModHookUrl) {
        fetch(discordModHookUrl, {
          method: "post",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            embeds: [getEmbed(diffItem)],
          }),
        });
      }
    } catch (error) {
      console.error(
        `Failed to send Discord notification for specific mod channel: ${error}`
      );
    }
  }
}
