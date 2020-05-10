# Outer Wilds Mod Database

Uses the mod list in `mods.json`, and for each mod it will fetch the required data. That data is then added to `releases.json`. This process is repeated every 15 minutes.

## Adding your mod to the list

Fork this repo, add your mod to the end of the list in `mods.json`, and open a PR. The easiest way to do this is to [edit the file directly in GitHub.com](https://github.com/Raicuparta/outer-wilds-mod-db/edit/master/mods.json), and follow the big flashy buttons to fork the repo, and propose the change. Do not `releases.json` yourself. It will be updated automatically.

### Mod entry format

Each mod entry in the list has the following format:

```json
{
  "repo": "UserName/my-mod",
  "manifest": "MyMod/manifest.json"
}
```

Where `repo` is the GitHub repository path, and `manifest` is the path of the mod's manifest file, relative to the repository's root.

### Example

Let's imagine you have a mod located at `github.com/UserName/my-mod`, a repository with the following structure:

```bash
├── MyMod
│   ├── manifest.json
│   ├── MyMod.cs
│   └── MyMod.csproj
└── MyMod.sln
```

To add this mod to the database, your change to `mods.json` should look like this:

```diff
-  }
+  },
+  {
+    "repo": "UserName/my-mod",
+    "manifest": "MyMod/manifest.json"
+  }
```
