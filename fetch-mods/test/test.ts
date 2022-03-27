import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
import { discordHookUrl, ghToken } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";
import { sendDiscordNotifications } from "../send-discord-notifications";

async function test() {
  // const nextDatabase = await fetchMods(JSON.stringify(modsJson), ghToken);
  // console.log("nextDatabase", JSON.stringify(nextDatabase, null, 2));

  const diff = getDiff(previousDatabase, nextDatabase);

  sendDiscordNotifications(discordHookUrl, diff);
}

test();
