import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
// import { discordHookUrl, ghToken, discordModHookUrls } from "./secrets.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";
import { sendDiscordNotifications } from "../send-discord-notifications";
import { toJsonString } from "../to-json-string";

async function test() {
  // const nextDatabase = await fetchMods(toJsonString(modsJson), ghToken);
  // console.log("nextDatabase", toJsonString(nextDatabase, null, 2));

  const diff = getDiff(previousDatabase, nextDatabase);

  console.log("dif", toJsonString(diff));

  // sendDiscordNotifications(discordHookUrl, diff, discordModHookUrls);
}

test();
