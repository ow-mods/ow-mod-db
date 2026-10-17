# PR TODO

If Rai merged this file to the source branch, he's an idiot.

Review of `source...horrible-ts-mess` (`b1c0259`). `npm run typecheck` passes. Overall the workflow → TS split looks sane; the main risks are in notification-diff logic and the checker rewrite.

## Worth fixing

1. ~~**New-mod notifications can be missed**~~ — Fixed by the split into the `mods/` folder: the previous-mod list is no longer read from Git history, so new mods are simply the ones absent from the previous database (`getDiff()` in `scripts/src/update-database/get-diff.ts`). The fragile `previous-mods.json`/`fetch-depth: 2`/`HEAD~1` logic is gone.

2. **Checker lost DLL validation** — old `mods-checker` verified that `manifest.json` declares a DLL and that the DLL actually exists in the ZIP (`MissingDLL` / `InvalidDLL`), and effectively validated installability. `scripts/src/handle-mod-issue/checker.ts` only checks that `filename` is a string if present (`checker.ts:234`) and accepts a `manifest.json` from any nested path (`checker.ts:181-205`). Mods that would previously fail now pass. This is the clearest accidental feature removal.

3. **"Force new mod notification" was removed without replacement** — `.github/workflows/force-new-mod-notification.yml` and `scripts/src/send-notifications/force-new-mod-notification.ts` are deleted. `notify-mod` only supports forced _updates_. Unless intentional, admins can no longer manually re-send a new-mod notification.

4. **`update-releases` ordering now loses notifications on deploy failure** — `Commit Database` runs before deploy (`update-releases.yml:67`). If `deploy-pages` fails, the database is already updated but notifications never run; the next run sees those mods as already present and won't notify. The old order only committed after a successful deploy, so failures were retried.

5. **Fixed 5-minute sleep is risky with a 5-minute schedule** — `update-releases.yml:103` adds `sleep 300` to a workflow scheduled every 5 minutes with a `concurrency: update-releases` group. With any build duration, scheduled runs will queue/skip. Polling the website build or moving the wait out of the concurrency group would be safer.

6. **Manual `workflow_dispatch` no longer force-processes issues** — `scripts/src/handle-mod-issue/index.ts:126-135` skips closed issues or issues without `add-mod`. The old workflow's dispatch path bypassed the job-level filter, so admins could reprocess closed/unlabelled issues by number. If that was used for retries, let dispatch bypass applicability.

7. **Force-update now also posts to per-mod webhooks** — the workflow now passes `DISCORD_MOD_HOOK_URLS`, and `sendDiffNotifications` uses it for all diffs. The old force-update script passed `{}`, so it only hit the global hook. This may be intended, but it can duplicate a notification into mod-specific channels.

8. **Tests/fixtures were deleted** — `scripts/src/test` and the `test` script are gone. There's now no regression coverage for the diff/notification logic, which is exactly where the subtle behavior changes are. Keeping a couple of fixtures around would be worthwhile.

No other obvious regressions in the database build path — mod fetching, mod-manager fetching, thumbnails, install counts, and output shape appear preserved.
