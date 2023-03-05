import { fetchMods } from "../update-database/fetch-mods.js";
import modsJson from "./mods.json" assert { type: "json" };

async function test() {
  fetchMods(JSON.stringify(modsJson), "output", []);
}

test();
