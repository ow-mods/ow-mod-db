# Outer Wilds Mod Database

Uses the mod list in the [`mods` folder of the `source`](https://github.com/ow-mods/ow-mod-db/tree/source/mods) branch, fetches the required data for each mod. Each mod lives in its own JSON file, named after its `uniqueName`, and follows the [`mod.schema.json`](https://github.com/ow-mods/ow-mod-db/blob/source/mods/mod.schema.json) schema. That data is then added to [`database.json` in the `master` branch](https://ow-mods.github.io/ow-mod-db/database.json). The process happens automatically every once in a while.

The database is deployed to GitHub Pages, since GitHub aggressively caches direct access to the raw file in the repo. So if you want to read from the database, you should use this URL: https://ow-mods.github.io/ow-mod-db/database.json

## Adding a mod

[**Click here to add your mod to the database**](https://github.com/ow-mods/ow-mod-db/issues/new?labels=add-mod&template=add-mod.yml&title=%5BYour+mod+name+here%5D)

The issue form is the only supported way to add a new mod to the database.

If your mod submission got rejected, read [what to do in case of rejection](./REJECTED.md).

## Updating a mod

The database automatically detects updates to your mod after you push them to your repository, including changes to your readme and mod releases.

To change the information that you submitted to the mod database, such as the mod title, tags, custom thumbnail, etc, find your mod's json in the [database mods folder](https://github.com/ow-mods/ow-mod-db/blob/source/mods) and edit it.

## How it works

GitHub Actions are used to periodically update the database. Check the [Update Releases workflow](https://github.com/ow-mods/ow-mod-db/blob/source/.github/workflows/update-releases.yml) and the [TypeScript code](https://github.com/ow-mods/ow-mod-db/tree/source/scripts) that fetches the data about each mod and generates the database.

## Variables

Edit them in the [repository settings](https://github.com/ow-mods/ow-mod-db/settings/variables/actions).

### `GH_APP_ID`

ID of the GitHub App that handles all the automations. For this org, apps can be managed [here](https://github.com/organizations/ow-mods/settings/apps). This is the numeric ID you can see under "App ID" on the app's "General" settings page.

The app needs **read and write** repository permissions to `Contents`, `Issues` and `Pull Requests`.

It must be installed on both `ow-mods/ow-mod-db` and `ow-mods/outerwildsmods.com`.

### `DISCORD_MOD_UPDATE_ROLE_ID`

ID for the Discord role to ping when there's a mod update.

### `DISCORD_NEW_MOD_ROLE_ID`

ID for the Discord role to ping when there's a new mod added to the database.

## Secrets

Edit them in the [repository settings](https://github.com/ow-mods/ow-mod-db/settings/secrets/actions).

### `GH_APP_PRIVATE_KEY`

Private key of the same GitHub app from mentioned in [`GH_APP_ID`](#GH_APP_ID). You can create a key in the "Cretendials" page of the app settings, under the "Key pairs" tab. It will download a `.pem` file once you generate it, so you should just use the contents of that file as the value for this secret, and delete the file.

### `DISCORD_HOOK_URL`

Discord web hook URL where all the notifications are sent. Format:

```
https://discord.com/api/webhooks/XXX/YYY
```

### `CLOUDFLARE_API_TOKEN`

Cloudflare API token from [here](https://dash.cloudflare.com/profile/api-tokens), with Analytics read permissions.
