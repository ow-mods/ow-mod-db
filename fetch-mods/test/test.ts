import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
import { discordHookUrl, ghToken } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";
import { sendDiscordNotifications } from "../send-discord-notifications";

// fetchMods(JSON.stringify(modsJson), ghToken);

const diff = getDiff(previousDatabase.releases, nextDatabase.releases);

sendDiscordNotifications(discordHookUrl, diff);
