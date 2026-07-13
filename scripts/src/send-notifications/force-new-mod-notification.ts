import * as core from "@actions/core";
import { sendDiscordNotifications } from "./send-discord-notifications.ts";
import type { DiffItem } from "./get-diff.ts";
import { promises as fsp } from "fs";
import type { DatabaseOutput } from "../mod.ts";
import type { BaseMod } from "../mod.ts";

const Input = {
    currentDatabaseFile: "current-database",
    discordHookUrl: "discord-hook-url",
    discordNewModRoleId: "discord-new-mod-role-id",
    discordModUpdateRoleId: "discord-mod-update-role-id",
    modUniqueId: "mod-unique-id",
} as const;

async function run() {
    try {
        const previousDatabaseJson = (
            await fsp.readFile(core.getInput(Input.currentDatabaseFile))
        ).toString();

        const previousDatabaseOutput: DatabaseOutput =
            JSON.parse(previousDatabaseJson);
    
        const previousMods = [
            ...previousDatabaseOutput.releases,
            ...previousDatabaseOutput.alphaReleases,
        ];

        const newModUniqueID = core.getInput(Input.modUniqueId);

        const newMod = previousMods.find((mod) => mod.uniqueName == newModUniqueID);

        if (newMod === undefined) {
            throw new Error(newModUniqueID + " was not found in the database");
        }

        const discordHookUrl = core.getInput(Input.discordHookUrl);

        const diff: DiffItem[] = [];

        diff.push({
          diffType: "add",
          nextMod: newMod as BaseMod,
        });

        sendDiscordNotifications(
            discordHookUrl,
            core.getInput(Input.discordModUpdateRoleId),
            core.getInput(Input.discordNewModRoleId),
            diff,
            {}
        );
    } catch (error) {
        core.setFailed(`Error running workflow script: ${error}`);
        console.log(`Error running workflow script: ${error}`);
    }
}

run();