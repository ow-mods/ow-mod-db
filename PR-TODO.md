# PR TODO

If Rai merged this file to the source branch, he's an idiot.

Review of `source...horrible-ts-mess` (`b1c0259`). `npm run typecheck` passes. Overall the workflow → TS split looks sane; the main risks are in notification-diff logic.

1. **Manual `workflow_dispatch` no longer force-processes issues** — `scripts/src/handle-mod-issue/index.ts:126-135` skips closed issues or issues without `add-mod`. The old workflow's dispatch path bypassed the job-level filter, so admins could reprocess closed/unlabelled issues by number. If that was used for retries, let dispatch bypass applicability.
