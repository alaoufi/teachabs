# Administration design 009

## Scope

Continues the preview at `9c2a0bd36cd0e8ac01ab9c316b3bd448670e16db` in an isolated clone and branch. The administration home keeps its floating section cards. Eight section workspaces now share the dimensional container, compact panels, and a closed-by-default native `ⓘ` guide: accounts, finance, student records, educational affairs, operations, technical support, resource library, and activity log. Account and teacher forms use the same layout.

Adds a keyboard skip link and Arabic labels for the existing school audit events. Important trial-data, payment, access, and resource-license notices stay visible. No JavaScript dependency, schema, permission, or storage change is introduced.

Only administration views, administration CSS, their new tests, and this document change. Classroom, whiteboard, server routes, registration logic, and school assignment logic are unchanged. Registration-agent account management still has its separate existing layout and is not represented as redesigned here. New school scheduling and other unimplemented administrative workflows remain future work.

## Verification

- Node.js 24.22.1. The copied dependency tree matched the existing lockfile byte for byte; no package files changed.
- Before edits: 94/94 regression tests passed.
- Final `npm test`: 98/98 passed, including four new design/guide/access/audit tests. Syntax and whitespace checks passed.
- Tests use synthetic isolated databases only. No production or local-user database was opened or copied.
- Browser verification is **not complete**. The standalone Chromium runner could not start because the execution environment denied its local socket, including after the permitted escalation. The cloud browser could not reach the isolated preview (`ERR_CONNECTION_REFUSED`). No responsive screenshot or browser-flow pass is claimed.
- `test/admin-design-browser.cjs` is supplied for an environment that supports Chromium. It covers 10 administration pages at 320/390/768/1280 pixels, guide keyboard controls, mobile navigation, Back/Forward, unsaved-form cancellation, finance save/reload, task and support updates, and read-only/forbidden access. This script still needs execution before deployment or a visual-readiness claim.

## Preservation and rollback

Numbered backup `admin-design-009` was created before edits with a complete, verified Git bundle and SHA-256 file manifest. The independent Git branch retains the exact baseline as its parent. A second bundle and patch capture the final commit. These local code backups contain no runtime database and must not be confused with production-data backups.

To review or recover the earlier code, create a new branch at the baseline SHA above; do not reset or force-push any working branch. This stage is saved for review only. No pull request, merge, or deployment is part of this change.
