import secrets from "./secrets.json" with { type: "json" };
import { BaseMod } from "../mod.ts";
import { sendDiscordNotifications } from "../send-notifications/send-discord-notifications.ts";
import { promises as fsp } from "fs";
import type { DatabaseOutput } from "../mod.ts";
import type { DiffItem } from "../send-notifications/get-diff.ts";

async function test() {
	const now = new Date().toISOString();
	console.log("Now: " + now);

	const previousDatabaseJson = (
		await fsp.readFile("./test_database.json")
	).toString();

	const previousDatabaseOutput: DatabaseOutput =
		JSON.parse(previousDatabaseJson);

	const previousMods = [
		...previousDatabaseOutput.releases
	];

	const newModUniqueID = "Raicuparta.NomaiVR";

	const newMod = previousMods.find((mod) => mod.uniqueName == newModUniqueID);

	if (newMod === undefined) {
		throw new Error(newModUniqueID + " was not found in the database");
	}

	const diff: DiffItem[] = [];

	diff.push({
		diffType: "add",
		nextMod: newMod as BaseMod,
	});


	sendDiscordNotifications(secrets.discordHookUrl, "", "", diff, {});
}

test();
