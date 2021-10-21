# Outer Wilds Mod Database

Uses the mod list in [`mods.json` of the `source`](https://github.com/Raicuparta/ow-mod-db/blob/source/mods.json) branch, fetches the required data for each mod. That data is then added to [`database.json` in the `master` branch](https://github.com/Raicuparta/ow-mod-db/blob/master/database.json). The process happens automatically every once in a while.

## Adding your mod to the list

Fork this repo, add your mod to the end of the list in `mods.json`, and open a PR. The easiest way to do this is to [edit the file directly in GitHub.com](https://github.com/Raicuparta/outer-wilds-mod-db/edit/source/mods.json), follow the big flashy buttons to fork the repo, and propose the change. Do not edit `database.json` yourself. It will be updated automatically.

### Mod entry format

Each mod entry in the list has the following format:

```json
{
  "name": "Human Readable Title",
  "uniqueName": "unique-mod-id",
  "repo": "GitHub-User/Repo-Name"
}
```

Note that `uniqueName` needs to be the same as what you define in your mod's `manifest.json`. It needs to be unique within the mod list, and should never change after the mod has been published.

### Example

Let's imagine you have a mod located at `github.com/UserName/my-mod`. To add this mod to the database, your change to `mods.json` should look like this:

```diff
-  }
+  },
+  {
+    "name": "My Mod",
+    "uniqueName": "my-mod",
+    "repo": "UserName/my-mod",
+  }
```
 
