# Administration 015: fixed stages, education paths and class capacity

## Isolated delivery
This work starts at administration review 014, commit `c5ffe04d60438bcbb2096ea73a2b4edf9416e299`, on a separate `codex/admin-school-structure-015` branch. The `codex/admin-separation-010` branch and its Android review candidate remain unchanged. This is source work, not approval to build/deliver another APK, merge, open a PR or deploy.

## Implemented model
- The catalog is fixed: primary years 1–6, middle years 1–3, secondary years 1–3. Both server validation and SQLite constraints enforce the twelve valid combinations. Users select them; there is no create/rename/delete-stage or free-form-grade editor.
- An education path has a name, a separate education type (government, private, other or unspecified), and an optional curriculum/system label (for example Egyptian or Saudi). Selecting a curriculum does not infer the education type or vice versa.
- A fresh scope can explicitly initialize “مسار التسجيل الحالي” through an authorized, audited, idempotent setup action. It is compatible with the existing primary registration records without guessing education type/curriculum; user-named paths cannot impersonate it.
- Paths can be added by an explicitly granted `school.tracks` permission. This iteration does not rename/delete paths or silently reclassify old records.
- A path/stage/year may have any number of classes. Class names are unique within that exact grade context, not globally across paths/stages.
- Creating a class requires a name and a positive safe-integer seat capacity. “10” is an example shown in the field, not an implicit legacy default.
- Every class shows enrolled count, configured capacity and remaining seats. All retained student assignments count, including inactive students, until an authorized person explicitly removes the assignment.
- Raising or lowering capacity requires the separate opt-in `school.capacity` permission plus school read access. Existing rename/archive permission does not silently grant seat-limit changes. Supervisors retain their normal full scope.
- Capacity changes share the lifecycle revision with rename/archive operations; stale edits fail. An unchanged capacity does not increment the revision or add audit noise. A decrease below current enrollment is rejected.
- New admissions validate active class, scope, child eligibility, duplicate membership, configured capacity and available seats in the same `BEGIN IMMEDIATE` transaction as insert and audit. A competing admission or capacity update cannot pass a stale free-seat check.

## Preserved registration boundary
Current canonical children and teacher qualifications encode primary grades 1–6 only. Therefore middle/secondary classes, or newly defined paths such as an Egyptian path, are **structure-ready but not enrollment-ready**. The service rejects legacy student/teacher assignments into those contexts instead of treating the same number as the same grade. The UI says registration/specialty integration is pending and omits misleading assignment choices.

Actual enrollment into new contexts needs explicit school-owned eligibility mappings with audited administration, or coordinated changes to the canonical registration/teacher records. That work is not silently substituted here. `store.mjs`, registration, shared routes, virtual classrooms and whiteboard code are untouched. Existing primary assignments in the legacy context continue to work after explicit capacity configuration.

## Migration and data preservation
- The migration rebuilds only `school_grades` to replace the old primary-only uniqueness constraint. It keeps every existing grade ID, scope and year. Classes, lifecycle rows, student/teacher assignments, supervision, audit and canonical identity/booking rows are not rebuilt or rewritten.
- Each old scope gets a visible legacy path with unspecified education type and curriculum. No government/private/Egyptian classification is fabricated.
- Capacity is an additive table. Existing classes without a configured capacity retain all students and display “capacity not configured.” New admissions stop until an authorized person explicitly chooses a capacity at least as large as existing enrollment. No student is evicted and no arbitrary capacity is assigned.
- The grade rebuild follows SQLite's parent-table migration sequence: temporarily disable FK enforcement only on the unopened service's startup connection, acquire `BEGIN IMMEDIATE`, recheck migration state, copy and verify original IDs/values, drop the old parent, rename the replacement, run `foreign_key_check`, record a school-owned migration version and commit. FK enforcement is restored in `finally` and verified. A failure rolls back the parent-table change.
- A composite track/scope FK prevents grades from pointing to another scope's track. An exact legacy schema allowlist (including ordinary/generated columns, constraints and foreign keys), custom grade indexes/triggers, or an unexpected replacement table stop migration for review rather than being discarded.
- No live database or Render setting was accessed or migrated. Tests use synthetic in-memory or temporary file databases.

## Deployment and rollback conditions
Before any live migration: verify the actual deployed branch and Claude integration, obtain a consistent live database backup stored outside ephemeral hosting, stop old writers, test the migration against a restorable copy, and verify the restored copy. Numbered Git/code bundles do not replace a live data backup.

Do not mix old and new writers. Older code uses three-value grade inserts and numeric-only eligibility checks; it can fail on the new schema or bypass new capacity rules. A code-only rollback is not safe. Revert with a verified database/schema rollback plan or restore the backup in a coordinated maintenance window, accounting for any later writes.

## Verification and remaining QA
- Existing tests are updated to pass an explicit capacity in newly created synthetic class fixtures.
- HTTP/UI checks cover denied origin/role/scope, fixed level options, separate capacity grants, stale edits, labels/escaping, and hiding unsupported assignment actions.
- Dedicated structure tests cover migration preservation/rollback and competing processes/SQLite connections for admissions and capacity reductions.
- Browser workflow scripts use the new path/level/capacity form. Their presence is not a claim that visual/native Android review has run for 015.
- Android review 014 remains an independent task. The changed administration page in 015 needs its own visual review before user-facing release.

## Final source verification for this checkpoint
- 151/151 Node tests passed after the final authorization fix.
- Independent-process races exercised two writer processes/SQLite connections queued behind a third connection's lock; last-seat admission and admission-versus-capacity-reduction invariants passed repeatedly.
- Tests reject unknown ordinary/generated legacy columns and altered constraints/defaults/FKs without losing their data. Injected migration/audit failures preserve original records and restore FK enforcement.
- Independent source review identified and resolved fresh-start compatibility, unknown-schema preservation, and implicit-initialization permission/audit gaps. The final review found no remaining source blocker in its scope.
- No browser/native Android or live migration approval is claimed for this branch.
