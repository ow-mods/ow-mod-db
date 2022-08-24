# Outer Wilds Mod Database

Uses the mod list in [`mods.json` of the `source`](https://github.com/Raicuparta/ow-mod-db/blob/source/mods.json) branch, fetches the required data for each mod. That data is then added to [`database.json` in the `master` branch](https://github.com/Raicuparta/ow-mod-db/blob/master/database.json). The process happens automatically every once in a while.

## [Click here to add your mod to the database](https://github.com/Raicuparta/ow-mod-db/issues/new?assignees=Raicuparta&labels=add-mod&template=add-mod.yml&title=%5BYour+mod+name+here%5D)

Or, if you want, you can [edit the mod list yourself and open a PR](https://github.com/Raicuparta/outer-wilds-mod-db/edit/source/mods.json)

## How it works

GitHub Actions are used to periodically update the database. Check the [Update Releases workflow](https://github.com/Raicuparta/ow-mod-db/blob/source/.github/workflows/update-releases.yml) and the [TypeScript code](https://github.com/Raicuparta/ow-mod-db/tree/source/fetch-mods) that fetches the data about each mod and generates the database.

## Repository secrets

If you fork this repository, you'll need to add a few secrets for everything to work.

### `GH_TOKEN`

GitHub token with repo permissions. Format:

```
ghp_XXX
```

### `DISCORD_HOOK_URL`

Discord web hook URL where all the notifications are sent. Format:

```
https://discord.com/api/webhooks/XXX/YYY
```

### `DISCORD_MOD_HOOK_URLS`

JSON object where keys are the uniqueName of a mod, and the values are the Discord hook urls of the channel where update notifications should be sent to. Format:

```
{
  "uniqueNameA": "https://discord.com/api/webhooks/XXX/YYY",
  "uniqueNameB": "https://discord.com/api/webhooks/WWW/ZZZ"
}
```

### DISCORD_MOD_UPDATE_ROLE_ID

ID for the Discord role to ping when there's a mod update.

### DISCORD_NEW_MOD_ROLE_ID

ID for the Discord role to ping when there's a new mod added to the database.
