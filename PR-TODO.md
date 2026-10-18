# PR TODO

If Rai merged this file to the source branch, he's an idiot.

Second-pass review of `source...horrible-ts-mess` (`5a441fcd`). `npm run typecheck` passes. Migration checked: all 436 `mods/*.json` files match the old `mods.json` entries field-for-field (apart from `$schema`). The points you removed from this file are treated as resolved; below are only new findings.

Fixed after review: missing `notifications.json` is now initialized from the current database and notifications are skipped for that run. Invalid `uniqueName`s are now rejected by the checker before PR creation; `getModFileName` no longer validates. Checker API failures now only become user-facing errors on 404; other failures propagate as checker crashes.

No remaining must-fix items.

## Worth doing while here

- **Editing cannot clear some fields.** `alpha`, `parent`, `authorDisplay`, and `thumbnailUrl` are only overwritten when the form supplies a value (`handle-mod-issue/modify-mod-list.ts:48-59`). Unchecking Alpha cannot convert an alpha mod back to a normal mod, and there is no way to remove a parent/thumbnail. Either add explicit "remove" checkboxes to the form or document this limitation; at minimum note that unchecking DLC *does* remove `requires-dlc`, which is inconsistent.
- **`measureTime` creates an unhandled rejected promise.** `promise.finally(...)` is not handled (`scripts/src/update-database/build-database.ts:12-21`), so a failed `fetchMods` can terminate Node via unhandled rejection before the intended `Failed to update database` error. Use `promise.then(log, log)` or return/handle the derived promise.
- **Validate mod files against `mods/mod.schema.json`.** Right now only filename/JSON/duplicates are checked; typos like `"tag"` instead of `"tags"` silently produce wrong database entries. A small schema validation in `readModFiles` (or a cheap CI step) fits the one-file-per-mod design.
- **Document notification state.** README should explain `notifications.json`, how it is advanced, and how to reset/seed it. This is now required operational knowledge.

## Manual test checklist

### Add-mod issue flow
1. New mod, all fields filled → pending comment, success report, one new `mods/<uniqueName>.json` in a PR, correct `$schema`, sorted fields, tags/DLC/alpha/parent/thumbnail/author, issue closed.
2. New mod, only required fields → no undefined/empty optional fields written; defaults correct.
3. Duplicate `uniqueName` with duplicate-check enabled → failure report, no PR.
4. Failure cases: `uniqueName` invalid as a file name (slash, colon, unicode, `.`, `..`), manifest `uniqueName` mismatch, manifest version vs release tag mismatch, no release, no ZIP asset, invalid/missing `manifest.json`, no open-source license, missing dependency, nonexistent repo, invalid repo URL. Each must show the intended report and leave the issue open.
5. Repo URL variants: `https://github.com/o/r`, trailing `/`, trailing `.git`, extra path/query, non-GitHub URL.
6. Retry via `checker, retry` updates the existing report comment (not duplicate); manual dispatch with `--force` works on a closed/unlabelled issue.
7. Simulate a transient GitHub API failure and confirm it is not reported as "repo missing" or "no license".

### Edit-mod issue flow
8. Edit name/repo/tags/author/thumbnail/parent/DLC → only the existing file changes; `downloadCountOffset`, `firstReleaseDateOverride`, `repoVariations`, `required`, `utility` are preserved.
9. Try clearing alpha/parent/thumbnail via the form → verify documented behaviour, and verify DLC tag removal.
10. Edit with duplicate-check selected vs. unselected; confirm the checker still validates the manifest against the expected unique name.

### Mods folder / database build
11. Direct PR with wrong filename, duplicate `uniqueName`, invalid JSON, invalid tag → build fails with a clear message; `mod.schema.json` is ignored as a mod file.
12. Build with a new mod, an updated release, a removed mod, and an alpha mod → `database.json` shape correct, removed mod gone, alpha in `alphaReleases`, install counts/mod manager/thumbnails present.
13. Update a release version → version/download URL/date/description refresh; unchanged mods reuse cached data; `databaseEntryUpdatedAt` logic still refreshes after 12h.
14. PR build must not commit/deploy/notify; merged `mods/**` push must run the full production flow.

### Notifications
15. Missing `notifications.json` → (after fix) seeds/skips without failing and without a mass notification; `{}` is not used as a bootstrap.
16. New mod → new-mod notification, state entry added, next run sends nothing.
17. Release update → update notification with correct old/new versions, state advances.
18. Prerelease add/update → prerelease notification; release + prerelease changed in the same run both notify correctly.
19. No database changes → no Discord call and no state commit.
20. More than 10 diffs → messages chunked at 10 embeds, role pings only where appropriate, long descriptions truncate safely, mod without thumbnail still renders.
21. Discord 429/5xx → retries; if delivery ultimately fails, state is not advanced so the next run retries (confirm whether earlier chunks get duplicated).
22. Force new notification (empty previous version) and force update notification → correct embed type, state committed/pushed, no duplicate on the next scheduled run.
23. Remove and re-add a mod with the same version → decide/verify whether it should notify.

### Deployment
24. Scheduled, push, and manual runs: database commit → Pages deploy → website dispatch → Discord notify → state commit. Break each stage once and verify the next run retries without losing or duplicating notifications.
25. Confirm `database.json`, thumbnails, and the Discord website links resolve after the website rebuild.
