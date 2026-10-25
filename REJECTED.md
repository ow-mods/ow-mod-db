# My mod submission was rejected. What do I do?

If you tried to submit a mod to the database, and it was rejected, it's still possible to distribute your mod to people using the [Outer Wilds Mod Manager](https://outerwildsmods.com/mod-manager/).

The easiest way is for you to create a deep link that, when clicked, opens the mod manager and shows a dialog to install your mod. You could for instance share this link in your mod's readme.

A mod zip deep link has the format `owmods://install-url/[ZIP_URL]`, where `[ZIP_URL]` is the full url to your mod's release zip.

Here's an example deep link. GitHub doesn't allow clickable links to custom protocols, so you'll need to copy and paste the URL to your browser's URL bar and press enter:

`owmods://install-url/https://github.com/JohnCorby/ow-vanilla-fix/releases/download/v0.18.0/JohnCorby.VanillaFix.zip`

If you're sharing the link in other platforms or your own web page, you might be able to create an actual clickable link, which makes it easier for your users.

Opening this link opens the "Install From" dialog in the mod manager, and after that your users just need to confirm by clicking the "Install" button in that dialog.

If deep linking doesn't work for whatever reason, you can instruct your users to reach the same dialog via the mod manager three dot menu -> Install From -> Select "URL" in the "Install From" dropdown -> paste your zip URL in the "URL" field -> click "Install".

You're also free to share your mod on other platforms with more relaxed policies, like [Nexus Mods](https://www.nexusmods.com/games/outerwilds).
