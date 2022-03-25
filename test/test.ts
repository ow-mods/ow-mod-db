import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";
import gitHubToken from "./gh-token.json";

fetchMods(JSON.stringify(modsJson), gitHubToken);
