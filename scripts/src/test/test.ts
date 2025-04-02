import { fetchMods } from "../update-database/fetch-mods.js";
import modsJson from "./mods.json" with { type: "json" };
import secrets from "./secrets.json" with { type: "json" };
import { BaseMod } from "../mod.js";
import { getDiff } from "../send-notifications/get-diff.js";
import { sendDiscordNotifications } from "../send-notifications/send-discord-notifications.js";

async function test() {
  const now = new Date().toISOString();
  console.log("Now: " + now);

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
    latestReleaseDescription:
      "For installation instructions [see the README](https://github.com/Ixrec/OuterWildsArchipelagoRandomizer#installation).\r\n\r\n- **Logsanity**: Added a `logsanity` option (`false` by default) that adds **176 more locations** for all the (non-DLC, non-rumor, non-missable) ship log facts in the game. (Thanks @hopop201 for help checking these location names for spoilers)\r\n- Various bugfixes, tweaks and internal code cleanups. The ones noticeable to players are:\r\n  - Previously, receiving a non-unique filler item (marshmallow, oxygen refill, fuel refill) after switching profiles would have no effect. This should be fixed now.\r\n  - Reaching Feldspar via Signalscope is now in logic. Previously there was a bug causing only the Scout method to be in logic.\r\n  - When you connect to a multiworld made with a different .apworld version from the mod version, the warning message now appears in the in-game console without having to pause first, so it should be harder to miss\r\n  - When the mod tries to check a location but the AP server times out, it now prints a warning to the in-game console (not just the OWML logs), so it's easier to tell there's a connection issue beyond the mod's control\r\n- Additional tweaks since the Release Candidate:\r\n  - The logsanity location \"ET Ship Log: Sunless City 3 - Signal\" now correctly requires Ghost Matter Wavelength\r\n  - Made mid-game communication with the AP server non-blocking. That means the game will no longer freeze for up to 2 seconds whenever it tries to tell the AP server you checked a location (this is usually only noticeable if the server is down).\r\n  - Rewrote README instructions for installing old or prerelease versions of the mod now that I've become aware of and tested more Outer Wilds Mod Manager features.",
  };

  const otherMod: BaseMod = {
    name: "Among Us - The Musical",
    uniqueName: "Raicuparta.Joe",
    slug: "amongusthemusical",
    description: "The best mod ever made",
    author: "Paicuparta",
    authorDisplay: "Paicuparta",
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
      main: "newhorizons.webp",
    },
    latestReleaseDescription:
      "For installation instructions [see the README](https://github.com/Ixrec/OuterWildsArchipelagoRandomizer#installation).\r\n\r\n- **Logsanity**: Added a `logsanity` option (`false` by default) that adds **176 more locations** for all the (non-DLC, non-rumor, non-missable) ship log facts in the game. (Thanks @hopop201 for help checking these location names for spoilers)\r\n- Various bugfixes, tweaks and internal code cleanups. The ones noticeable to players are:\r\n  - Previously, receiving a non-unique filler item (marshmallow, oxygen refill, fuel refill) after switching profiles would have no effect. This should be fixed now.\r\n  - Reaching Feldspar via Signalscope is now in logic. Previously there was a bug causing only the Scout method to be in logic.\r\n  - When you connect to a multiworld made with a different .apworld version from the mod version, the warning message now appears in the in-game console without having to pause first, so it should be harder to miss\r\n  - When the mod tries to check a location but the AP server times out, it now prints a warning to the in-game console (not just the OWML logs), so it's easier to tell there's a connection issue beyond the mod's control\r\n- Additional tweaks since the Release Candidate:\r\n  - The logsanity location \"ET Ship Log: Sunless City 3 - Signal\" now correctly requires Ghost Matter Wavelength\r\n  - Made mid-game communication with the AP server non-blocking. That means the game will no longer freeze for up to 2 seconds whenever it tries to tell the AP server you checked a location (this is usually only noticeable if the server is down).\r\n  - Rewrote README instructions for installing old or prerelease versions of the mod now that I've become aware of and tested more Outer Wilds Mod Manager features.",
  };

  const mod2 = { ...mod, version: "0.0.2", latestReleaseDate: now };
  const otherMod2 = { ...otherMod, version: "0.0.2", latestReleaseDate: now };

  const diff = getDiff([mod, otherMod], [mod2, otherMod2]);

  sendDiscordNotifications(secrets.discordHookUrl, "", "", diff, {});

  // fetchMods(JSON.stringify(modsJson), "output", []);
}

test();
