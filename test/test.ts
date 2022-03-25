import { fetchMods } from "../fetch-mods";
import modsJson from "./mods.json";

fetchMods(JSON.stringify(modsJson), "ghp_XXX");
