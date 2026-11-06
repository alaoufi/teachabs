# Synthetic administration browser QA 028

Exact application source: `1e515fb8f6e543982fbad3ec16acc79ab238e5e9` (023). This source preserves the 022 teacher-filter and admission-return fixes: the only later app modification is administration banner CSS. The QA commit must be its direct child, with exactly the four listed QA-only paths changed. No application code, main branch, runtime settings or credentials are modified. Only initial creation of `codex/admin-filter-recovery-browser-qa-028`, attempt 1, on this public repository may run the 15-minute standard Ubuntu job. Read-only repository permission, credential persistence disabled.

## Scope

- Real application and synthetic in-memory records, loopback-only. No real login, production database, public preview, Android runtime, deployment or PR.
- Nine local classes, two custom long-name tracks, six explicit teachers including foreign/grade/subject alternatives, thirteen explicit students, other-scope records, restricted role, retained and conflicting individual links. Preflight validates all generated model records, name limits (tracks/teachers 60, classes/students 40), capacity, memberships, scoping, sessions and exact teacher candidate sets before any browser launch.
- Explicit class/subject selection, placeholders, hierarchy resets, exact teacher option lists, keyboard, Back/Forward, compatible assignment and stale/forged/unauthorized rejection.
- Real class-first and student-first empty, stale and over-capacity form submissions, successful batches, repeated admissions, current canonical recovery paths and no audit/membership mutation on rejection. General error pages remain appropriate for foreign/missing class or denied authorization/origin.
- Matrix: teacher math, teacher science, student-first and error-return at 320/360/393 widths and 100/160/200% text. Full option references and geometry are measured and original PNGs retained.
- Demo banner: 320/360/393/768/1280 widths at 100/130/160/200%, closed, role-open and role-plus-guide-open. Explicit original screenshots at 320/200 and 393/200, including an unsaved keyboard-selected role. Never submit the role-switch form. Inspect pixels as well as geometry, especially native selected text truncation.
- Suspended/pending teacher accounts and changed qualifications are covered by exact-source unit/HTTP tests; this browser fixture does not modify private SQLite internals to create these teacher states. Suspended students and stale individual-link conflicts are in the browser fixture.

## Safety and evidence

Preinstalled Chrome only. Isolated pinned Playwright 1.62.0, no project dependency installation. Chromium sandbox enabled; failure stops without changing security settings. Fresh temporary HOME and browser context with no inherited credentials. External page requests blocked; only synthetic loopback mutations are used. Reports preserve every passed/failed assertion and scenario exceptions; absent later checks are not a pass. Original screenshots are split into small routine workflow artifacts with three-day retention. No PNGs or other binary evidence are committed to Git.

Run model-only validation with `node ci/filter-recovery-browser-qa-028/fixture.mjs --check`. The browser command requires the isolated environment prepared by the workflow. Do not launch local Chromium where socket access is restricted and do not disable its sandbox.
