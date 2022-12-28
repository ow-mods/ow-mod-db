import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
// import { discordHookUrl, ghToken, discordModHookUrls } from "./secrets.json";
import { discordHookUrl } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";
import { sendDiscordNotifications } from "../send-discord-notifications";
import { toJsonString } from "../to-json-string";
import { getViewCounts } from "../get-view-counts";
import { getInstallCounts } from "../get-install-counts";

async function test() {
  sendDiscordNotifications(
    discordHookUrl,
    "",
    "",
    [
      {
        diffType: "update",
        nextMod: {
          name: "name",
          uniqueName: "uniqueName",
          slug: "slug",
          description: "description",
          author: "author",
          repo: "repo",
          latestReleaseDate: "latestReleaseDate",
          firstReleaseDate: "firstReleaseDate",
          latestReleaseDescription: "latestReleaseDescription",
          latestPrereleaseDescription: "latestPrereleaseDescription",
          tags: [],
          thumbnail: {
            main: "nomaivr.webp",
            openGraph: "nomaivr-static.webp",
          },
          downloadUrl: "downloadUrl",
          downloadCount: 10,
          version: "2.0.0",
        },
        previousMod: {
          name: "name",
          uniqueName: "uniqueName",
          slug: "slug",
          description: "description",
          author: "author",
          repo: "repo",
          latestReleaseDate: "latestReleaseDate",
          firstReleaseDate: "firstReleaseDate",
          latestReleaseDescription: "latestReleaseDescription",
          latestPrereleaseDescription: "latestPrereleaseDescription",
          tags: [],
          thumbnail: {
            main: "nomaivr.webp",
            openGraph: "nomaivr-static.webp",
          },
          downloadUrl: "downloadUrl",
          downloadCount: 10,
          version: "1.0.0",
        },
      },
    ],
    {}
  );
}

test();
