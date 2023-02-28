import { fetchMods } from "../fetch-mods.js";
import modsJson from "./mods.json" assert { type: "json" };
// import { discordHookUrl, ghToken, discordModHookUrls } from "./secrets.json.js";
// import { discordHookUrl } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff.js";
import { sendDiscordNotifications } from "../send-discord-notifications.js";
import { toJsonString } from "../to-json-string.js";
import { getViewCounts } from "../get-view-counts.js";
import { getInstallCounts } from "../get-install-counts.js";
import { generateModThumbnail } from "../generate-mod-thumbnail.js";

async function test() {
  fetchMods(JSON.stringify(modsJson), "output", []);
}

test();
