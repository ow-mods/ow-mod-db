import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
import gitHubToken from "./gh-token.json";
import nextDatabase from "./next-database.json";
import previousDatabase from "./previous-database.json";
import { getDiff } from "../get-diff";

// fetchMods(JSON.stringify(modsJson), gitHubToken);

getDiff(previousDatabase.releases, nextDatabase.releases);
