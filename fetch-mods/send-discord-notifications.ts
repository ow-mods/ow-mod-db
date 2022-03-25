import axios from "axios";
import { DiffItem } from "./get-diff";

function getNotificationText(diffItem: DiffItem) {
  switch (diffItem.diffType) {
    case "add":
      return `Mod ${diffItem.nextMod.name} by ${diffItem.nextMod.author} was added`;
    case "remove":
      return `Mod ${diffItem.previousMod.name} by ${diffItem.previousMod.author} was removed`;
    case "update":
      return `Mod ${diffItem.nextMod.name} by ${
        diffItem.nextMod.author
      } was updated from ${diffItem.previousMod!.version} to ${
        diffItem.nextMod.version
      }`;
  }
}

function getRelevantMod(diffItem: DiffItem) {
  return diffItem.diffType == "remove"
    ? diffItem.previousMod
    : diffItem.nextMod;
}

export async function sendDiscordNotifications(
  discordHookUrl: string,
  diff: DiffItem[]
) {
  for (const diffItem of diff) {
    axios.post(discordHookUrl, {
      embeds: [
        {
          title: getNotificationText(diffItem),
          url: getRelevantMod(diffItem).repo,
        },
      ],
    });
  }
}
