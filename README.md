# Outer Wilds Mod Database

Uses the mod list in [`mods.json` of the `source`](https://github.com/ow-mods/ow-mod-db/blob/source/mods.json) branch, fetches the required data for each mod. That data is then added to [`database.json` in the `master` branch](https://ow-mods.github.io/ow-mod-db/database.json). The process happens automatically every once in a while.

The database is deployed to GitHub Pages, since GitHub aggressively caches direct access to the raw file in the repo. So if you want to read from the database, you should use this URL: https://ow-mods.github.io/ow-mod-db/database.json

## [Click here to add your mod to the database](https://github.com/ow-mods/ow-mod-db/issues/new?labels=add-mod&template=add-mod.yml&title=%5BYour+mod+name+here%5D)

Or, if you want, you can [edit the mod list yourself and open a PR](https://github.com/ow-mods/outer-wilds-mod-db/edit/source/mods.json)

## How it works

GitHub Actions are used to periodically update the database. Check the [Update Releases workflow](https://github.com/ow-mods/ow-mod-db/blob/source/.github/workflows/update-releases.yml) and the [TypeScript code](https://github.com/ow-mods/ow-mod-db/tree/source/scripts) that fetches the data about each mod and generates the database.

## Repository secrets

If you fork this repository, you'll need to add a few secrets for everything to work.

### `GH_TOKEN`

GitHub token with repo permissions. Format:

```
ghp_XXX
```

### `GH_USER`

User name that owns GH_TOKEN

### `DISCORD_HOOK_URL`

Discord web hook URL where all the notifications are sent. Format:

```
https://discord.com/api/webhooks/XXX/YYY
```

### `DISCORD_MOD_HOOK_URLS`

JSON object where keys are the uniqueName of a mod, and the values are the Discord hook urls of the channel where update notifications should be sent to. Format:

```json
{
  "uniqueNameA": "https://discord.com/api/webhooks/XXX/YYY",
  "uniqueNameB": "https://discord.com/api/webhooks/WWW/ZZZ"
}
```

### DISCORD_MOD_UPDATE_ROLE_ID

ID for the Discord role to ping when there's a mod update.

### DISCORD_NEW_MOD_ROLE_ID

ID for the Discord role to ping when there's a new mod added to the database.

### GOOGLE_SERVICE_ACCOUNT

Base64-encoded JSON object. Credentials of a Google service account with permissions to get the outerwildsmods.com view counts from google analytics. JSON format (before base64 encoding):

```json
{
  "type": "service_account",
  "project_id": "XXX",
  "private_key_id": "XXX",
  "private_key": "XXX",
  "client_email": "XXX",
  "client_id": "XXX",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "XXX"
}
```

The Google service account is created on [Google Cloud](https://console.cloud.google.com). Specifically, you need to create the credentials on [APIs and Services -> Google Analytics Data API -> Credentials](https://console.cloud.google.com/apis/api/analyticsdata.googleapis.com/credentials). Then I guess (because I don't remember if that's how I did it back then) you fill in the json above, encode it with base64, and save it in the `GOOGLE_SERVICE_ACCOUNT` secret.

You also need to note the "email" address of those credentials, and give it view permissions in [Google Analytics](https://analytics.google.com/analytics), under Admin -> Account -> Account Access Management. Fun stuff.
