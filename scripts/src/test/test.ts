import { fetchMods } from "../update-database/fetch-mods.js";
import modsJson from "./mods.json" assert { type: "json" };
import secrets from "./secrets.json" assert { type: "json" };
import { BaseMod } from "../mod.js";
import { getDiff } from "../send-notifications/get-diff.js";
import { sendDiscordNotifications } from "../send-notifications/send-discord-notifications.js";

async function test() {
  const mod: BaseMod = {
    name: "NomaiVR",
    uniqueName: "Raicuparta.NomaiVR",
    slug: "nomaivr",
    description:
      "Outer Wilds VR Mod with 6DOF tracking and full motion control support",
    author: "Raicuparta",
    authorDisplay: "Raicuparta & Artum",
    repo: "https://github.com/Raicuparta/nomai-vr",
    latestReleaseDate: "latestReleaseDate",
    firstReleaseDate: "firstReleaseDate",
    repoUpdatedAt: "repoUpdatedAt",
    databaseEntryUpdatedAt: "databaseEntryUpdatedAt",
    downloadUrl: "downloadUrl",
    downloadCount: 0,
    version: "0.0.1",
    tags: [],
    thumbnail: {
      main: "nomaivr-static.webp",
    },
    latestReleaseDescription: `- Stereoscopic view in post credits sequence
    - Input prompts are now unaffected by the texture resolution setting
    - Additional settings for flashlight gesture, look arrow and markers opacity
    - Disable walking when holding a tool or when concealing the lantern`,
  };

  const diff = getDiff(
    [mod],
    [
      { ...mod, version: "0.0.2" },
      {
        ...mod,
        description: "",
        parent: "daddy",
        tags: ["funny"],
        prerelease: {
          version: "0.0.3",
          downloadUrl: "https://haha",
          date: "",
        },
      },
      {
        ...mod,
        parent: "daddy",
        uniqueName: "Raicuparta.NomaiVR2",
        slug: "nomaivr2",
      },
    ]
  );
  sendDiscordNotifications(secrets.discordHookUrl, "", "", diff, {});

  // fetchMods(JSON.stringify(modsJson), "output", []);
}

test();
