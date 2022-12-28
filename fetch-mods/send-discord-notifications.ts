import axios from "axios";
import { thumbnailUrlBase } from "./constants";
import { DiffItem } from "./get-diff";

function getNotificationTitle(diffItem: DiffItem) {
  const author = diffItem.nextMod.authorDisplay ?? diffItem.nextMod.author;
  switch (diffItem.diffType) {
    case "add":
      return `Added ${diffItem.nextMod.name} by ${author}`;
    case "update":
      return `Updated ${diffItem.nextMod.name} by ${author}`;
    case "update-prerelease":
      return `Updated prerelease of ${diffItem.nextMod.name} by ${author}`;
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
    case "update":
      return 15105570;
    case "update-prerelease":
      return 0;
  }
}

function getNotificationImageKey(diffItem: DiffItem) {
  return diffItem.diffType === "add" ? "image" : "thumbnail";
}

function getEmbed(diffItem: DiffItem) {
  return {
    title: getNotificationTitle(diffItem),
    description: `${getNotificationDescription(diffItem)}\n[source code](${
      diffItem.nextMod.repo
    })`,
    url: `http://outerwildsmods.com/mods/${diffItem.nextMod.slug}`,
    color: getNotificationColor(diffItem),
    [getNotificationImageKey(diffItem)]: {
      url: `${thumbnailUrlBase}/${diffItem.nextMod.thumbnail.openGraph}`,
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
  try {
    if (diff.length > 0) {
      const containsNewMod = diff.find(
        (diffItem) => diffItem.diffType === "add"
      );

      await axios.post(discordHookUrl, {
        content: `${pingRoleId(discordModUpdateRoleId)} ${
          containsNewMod ? pingRoleId(discordNewModRoleId) : ""
        }`,
        embeds: diff.map(getEmbed),
      });
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
