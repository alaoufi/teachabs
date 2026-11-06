# Administration separation 010

Builds on `658f9209bae4d6d30de2eb44f8ef39ddad4f156a` without changing classroom, whiteboard, shared server/layout, registration logic, database schema, or deployment settings.

## Independent administration interface

- A dedicated green administration masthead, account name, and POST logout replace the shared site's visible header and footer only on pages containing the administration shell.
- Administration breadcrumbs and section navigation stay inside `/admin`. The mixed demo/classroom entry is no longer linked inside the administration shell.
- Existing dimensional containers, floating cards, section shapes, and short native guides remain. The agents workspace adds compact counters, separate permission cards, a collapsible invitation form, and visible setup states.
- `/admin/agents` provides agent account management in the administration layout. It calls the existing `registration.agents`, `registration.setPermissions`, `admin.createRegistrationAgent`, and `admin.renewInvitation` functions. No parallel identity store or permission policy is introduced.
- Create/renew use `/admin/agents/new` and `/admin/agents/renew`. Invitation results return to the agents workspace. All former `/admin/registration-agents` routes remain compatible.
- “Setup complete” refers to account/password setup, not whether the account is currently suspended or active.

## Verification and boundaries

- `npm test`: **104/104 passed**, including six new separation/route tests. Syntax and `git diff --check` passed. Independent read-only review found no actionable authorization, routing, escaping, or CSS-scope regressions.
- Tests cover supervisor-only access, unauthenticated redirect, finance/teacher/parent/agent denial, origin checks, cross-scope requests, stale revisions, permission round trips, invitation renewal, invalidation of old tokens, escaped names, and legacy route compatibility. All data is synthetic and isolated.
- Browser verification is still blocked by the execution/browser environment described in `ADMIN-DESIGN-009.md`. No visual, responsive, keyboard, or screenshot pass is claimed. The supplied browser regression script now includes the agents page and should be run before visual approval/deployment.
- This is an interface and route-boundary separation, not separate hosting or databases. Shared login, activation, generic error pages, the legacy agents URL, and the common demo entry remain unchanged. Further changes to those shared entry points require coordination with classroom development.
- Administrative grade/class assignments remain organizational records; this change does not implement group scheduling or confer classroom access.

## Preservation

Numbered backup `admin-design-010` contains a verified complete pre-change Git bundle, tracked-file hashes, final code bundle/patch, and test logs. The new branch preserves 009 as its parent. The backups contain no production database. Revisit the baseline on a separate branch to recover earlier code rather than overwriting working branches.

Saved for review only. No pull request, merge, deployment, service restart, or live database change is included. Before later deployment, verify the live Render branch so that newer classroom work is preserved.
