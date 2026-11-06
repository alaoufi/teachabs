# Administration lifecycle 011

Continues the isolated administration branch from `268fce9a9e0636872ae6d969f10c9a90c56cb93e`. This stage manages organizational school records only. It does not change or create teaching rooms, lessons, whiteboards, shared routes, or deployment settings.

## Completed

- Rename administrative class records and archive/restore empty records, without deleting them or changing their grade.
- A separate `school.lifecycle` permission requires `school.read`. Existing creation permission does not silently grant lifecycle access. The general supervisor grants it through the existing account form.
- Revision checks reject stale edits. Changes use the existing immediate transaction and audit log. Duplicate names within a grade are rejected, including names belonging to archived records.
- Archiving is refused while a teacher or student assignment exists. The operation never silently removes assignments. Archived records cannot receive new teacher/student assignments, in the interface or the server.
- An additive lifecycle table records state and revision. Existing classes remain active by default without rewriting their rows.
- Compact class cards expose editing through a native disclosure. Missing prerequisites show short guidance instead of empty, unusable forms. Already-open grades are excluded from the grade-opening selector.

## Verification

- Full regression suite: **111/111 passed**. Seven new lifecycle tests cover permission grant/revocation, stale updates, archival constraints, scope denial, escaping, additive migration, reopening, empty states, and two concurrent HTTP edits.
- Independent read-only review found no blocking authorization, mutation, scope, migration, or form issue. Syntax and whitespace checks passed.
- Tests use synthetic in-memory or temporary databases. No live database was opened or changed.
- `test/admin-lifecycle-browser.cjs` covers create, rename, archive, restore, rejection of archiving an assigned record, reload, keyboard disclosures, and widths 320/390/768/1280. Browser execution is still pending; no visual/accessibility pass is claimed. HTTP concurrency testing used one server process, not multiple writers on separate processes.

## Preservation and rollout caution

Numbered backup `admin-design-011` preserves the complete pre-change history and file hashes. Final bundles/patches retain the tested stage. Code is saved on GitHub independently of the trial server.

The migration does not delete data, but rolling the code back to stage 010 removes archive enforcement because that older version ignores the lifecycle table. Do not run old and new writers concurrently against the same database. A rollout or rollback needs a verified database backup and a compatible deployment plan; do not drop the lifecycle table to reverse the code.

No PR, merge, deployment, restart, live database action, or classroom code change is included. The live service branch must be checked before deployment to preserve newer classroom work.

## Still missing

School years/terms, middle/secondary stages and tracks, bulk enrollment, complete administrative scheduling, staff/supervisor dashboards, and durable production storage/backups remain unfinished. Group scheduling and teaching-room integration need explicit coordination with classroom development; this stage does not implement them.
