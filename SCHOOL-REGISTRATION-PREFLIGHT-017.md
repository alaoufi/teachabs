# School registration linkage preflight 017

## Delivery boundary

This checkpoint supplies a standalone, read-only diagnostic and a coordination plan. It does **not** enable middle-school, secondary-school, or new-path registration, teacher eligibility, bookings, lessons, or school assignments. Existing primary registration and the 015/016 assignment guards remain unchanged. A clean report is still `blocked`, never ready for deployment or enrollment.

The branch is `codex/admin-registration-preflight-017`, based on `6671f61bc13eba5e842904227d08ea7faf4cb810`. Its deliverables are:

- `school-linkage-preflight.mjs`: standalone API and CLI.
- `test/school-linkage-preflight-017.test.mjs`: synthetic-fixture regression coverage.
- This document: source boundaries, report semantics, and required integration decisions.

No application initializer, runtime module, migration, server route, lesson, board, or registration implementation is changed by this checkpoint. No PR, merge, deployment, APK build, or live database access is performed here. The source checkpoint is intended for the authorized GitHub backup. No live database backup or visual/native Android QA is claimed.

## Why registration cannot yet use the school catalog

The administrative catalog in `school-catalog.mjs` already defines twelve fixed levels: primary years 1–6, middle years 1–3, and secondary years 1–3. Stage and year together identify a level. `middle:1` must never be inferred from legacy numeric grade `1`, nor represented by inventing numeric grades 7–12.

School paths have stable IDs, a display name, a separate education type, and an optional free-text curriculum label. These names and labels are not authoritative curriculum identifiers. Matching text such as “Saudi,” “Egyptian,” or the name of the legacy path cannot authorize learner or teacher eligibility.

Current source boundaries are:

| Boundary | Existing behavior | Integration requirement |
| --- | --- | --- |
| `registration.mjs` / `addChild` | Validates integer grade 1–6; stores the numeric grade and hardcodes curriculum `sa` and language `ar`. | Coordinate canonical learner context and agent-facing registration inputs. |
| `store.mjs` / `child` | Accepts only integer grade 1–6, curriculum `sa`, and language `ar` or `en`. | Add explicit contexts without reinterpreting existing child records. |
| Teacher registration and administration | Store separate subject and numeric-grade JSON arrays plus language. | Replace implicit subject × grade coverage with explicit, versioned qualification tuples. |
| `store.mjs` / `offers` | Filters scope, language, subject, grade-array membership, duration, activation and availability. It has no path/stage-aware educational context. | Coordinate an explicit-context matcher while preserving availability, isolation, authorization and replay protections. |
| `store.mjs` / `duration` | Grade `<= 3` means 30 minutes; otherwise 45 minutes. | Decide duration by authoritative context rather than reusing a primary-year number. |
| `lesson-catalog.mjs` / `allowedLessons` | Non-preview lessons match only subject and numeric grade. | Coordinate lesson/catalog eligibility for the same educational context. |
| `store.mjs` / `bookings`, `lesson.mjs` | Booking views join the child's current grade/language; lesson context uses the current booking view's subject/grade. No historical educational-context snapshot exists. | Preserve and define historical context explicitly before learner contexts can change. |
| School 015/016 assignments | Support primary levels in the marked legacy path; direct and inherited teacher links are administrative relations. | Keep guards until canonical integration is reviewed and deliberately enabled. |

School membership or teacher assignment is **not** currently a booking restriction. This preflight neither introduces such a restriction nor gives an assignment permission to alter classroom access.

## Running the diagnostic

Use Node.js 24 or newer and an explicitly supplied **existing SQLite snapshot**:

```sh
node school-linkage-preflight.mjs --database /path/to/review-copy.sqlite --scope SCHOOL_SCOPE
node school-linkage-preflight.mjs --database /path/to/review-copy.sqlite --scope ''
```

The second command intentionally selects the empty scope. An omitted scope is invalid; it is never defaulted to the empty scope or treated as a wildcard. The CLI accepts exactly the shown argument order and rejects duplicate or unknown flags. There is no default database path, environment-variable database selection, repair flag, or enable flag.

The exported synchronous API is:

```js
import {inspectSchoolLinkage} from './school-linkage-preflight.mjs';
const report = inspectSchoolLinkage(existingSnapshotPath, {scope: explicitlySelectedScope});
```

Importing the module does not inspect a database or run the CLI. Invalid API arguments and read failures throw fixed, sanitized errors. The CLI emits only report JSON to stdout and exits `2` for both `blocked` and `schema_review_required`. Argument or read errors produce fixed, sanitized stderr, no stdout, and exit `1`. There is no exit-zero readiness outcome. Node may issue its own SQLite experimental warning depending on the installed Node version; the fixture CLI tests disable that runtime warning.

### Read-only and privacy guarantees

- The implementation checks that the supplied path is an existing regular file, rejects memory/URI inputs, and opens it with `DatabaseSync(..., {readOnly: true})`. A missing path cannot create a database.
- `PRAGMA query_only=ON` adds connection-level write protection; `trusted_schema=OFF` avoids trusting schema expressions. A deferred read transaction covers schema inspection, integrity checks, and every aggregate so concurrent commits cannot mix different snapshots in one report.
- It does not import `openStore` or any application module, initialize tables, migrate, update rows, write audit events, checkpoint a WAL, or change journal mode. Connections close on success and every inspection error.
- A standard read-only SQLite connection sees committed WAL records. It is intentionally not opened with `immutable=1`, which can ignore WAL state. SQLite may use or update shared-memory lock/read-marker sidecars; the guarantee is no application/schema, main database, or WAL data mutation, not an absence of SQLite locking activity.
- Do not copy only the main file of a running WAL database. Prepare a consistent, authorized backup through a SQLite-aware backup procedure or a coordinated stopped-writer process, then verify the restore. This tool creates no backup and does not verify that a manually supplied file copy captured every production commit.
- Output contains aggregate counts, fixed field names, fixed diagnostic codes, and missing names drawn only from the required-schema allowlist. It never includes stored names, email addresses, child or teacher IDs, raw schema text, raw integrity/foreign-key rows, the input scope value, or the input database path. Raw exceptions and their causes are not emitted.
- Aggregates still describe a school. Keep the report in the authorized review context. The tool is a local operator diagnostic, not a public HTTP endpoint or an authorization substitute.

## Report contract

The report has exactly `version`, `readOnly`, `status`, `schema`, `counts`, and `blockers` at its top level. `version` is `17`, and `readOnly` is `true`.

`schema` contains:

- `compatible`: whether the consumed table/column shape is available and integrity checks can support inspection. It is not certification of every application constraint or migration version.
- `missingTables`: required fixed table names that are absent or are not tables.
- `missingColumns`: required fixed `table.column` names absent from existing required tables.
- `integrity`: `ok` or `failed`, reduced from SQLite integrity results without their details.
- `foreignKeyViolations`: a snapshot-wide count, or `null` if SQLite cannot perform the check. A positive count does not conceal the scoped aggregates; it adds a blocker. A failed check requires schema review.

Integrity and foreign-key inspection are **snapshot-wide**, not scoped. All learner/class/teacher/booking counts below are scoped. With missing required shape, failed integrity, or an unexecutable foreign-key check, status is `schema_review_required`, compatibility is false, and **all thirteen counts are null**. No partial counts are presented as trustworthy. A readable compatible snapshot has status `blocked` regardless of its counts.

Only columns consumed by this diagnostic are required:

| Table | Required columns |
| --- | --- |
| `users` | `id`, `role`, `scope`, `subjects`, `grades`, `language` |
| `children` | `id`, `parent`, `grade`, `curriculum`, `language` |
| `slots` | `id` |
| `bookings` | `parent`, `slot`, `status` |
| `school_grades` | `id`, `scope`, `track_id`, `stage` |
| `school_tracks` | `id`, `scope`, `legacy` |
| `school_classes` | `id`, `grade_id` |
| `school_student_assignments` | `child`, `class_id` |
| `school_teacher_assignments` | `class_id`, `subject`, `teacher` |
| `school_class_capacity` | `class_id`, `capacity` |
| `school_teacher_students` | `child`, `subject`, `teacher`, `class_id` |

Additional columns and unrelated tables are preserved, not printed or treated as migration authority. Older schemas are reported, never upgraded. This is deliberately not an exact migration-schema fingerprint or a replacement for migration review.

### Aggregate definitions

Counts include retained records regardless of account/class activity, rather than hiding historical or inconsistent administrative links.

| Count | Meaning |
| --- | --- |
| `children` | Children whose parent user has the selected scope. |
| `teachers` | Users with role `teacher` in the selected scope. |
| `classes` | Classes whose school-grade row has the selected scope. |
| `unsupportedClasses` | Such classes without both primary stage and a same-scope track marked `legacy=1`. |
| `memberships` | Student-assignment rows whose class/grade has the selected scope, including rows with a missing child. |
| `unsupportedMemberships` | Those memberships outside the primary legacy context. |
| `unknownCapacityClasses` | Selected-scope classes with no capacity value; existing students are not removed or assigned an assumed capacity. |
| `directAssignments` | Direct teacher-student links by their class/grade scope. |
| `teacherConflicts` | Direct links disagreeing with the inherited teacher for the same child's membership and subject; scope follows the membership's class/grade. Neither link is preferred, repaired, or deleted. |
| `crossScopeMemberships` | Memberships whose parent-user scope differs from their class/grade scope, counted when **either** side is the selected scope. |
| `invalidLegacyChildren` | Selected-scope children with a non-integer/out-of-range 1–6 grade, curriculum other than `sa`, or language outside `ar`/`en`. |
| `invalidTeacherQualifications` | Selected-scope teachers with malformed/non-array/empty grades or subjects, non-integer grades outside 1–6, unrecognized subjects, or language outside `ar`/`en`. Each teacher counts once. Both JSON dimensions are validated independently; malformed values do not abort the report. |
| `confirmedBookings` | Confirmed bookings whose parent user has the selected scope and whose slot exists. Dangling slot references are covered by the global foreign-key diagnostic rather than counted as valid linked bookings. |

Recognized legacy subjects are `math`, `arabic`, `science`, `english`, and `islamic`. SQL scope parameters are bound, including a quoted or empty string. No name, ID, or scope-value inference is used.

### Blocker codes

Every report contains these integration blockers, even with no data:

| Code | Work required before canonical linkage |
| --- | --- |
| `learner_context_missing` | Introduce explicit, versioned learner education contexts. |
| `teacher_context_missing` | Introduce explicit qualification tuples rather than subject/grade cross-products. |
| `booking_matcher_legacy` | Coordinate context-aware offers, duration, slots and booking revalidation. |
| `lesson_matcher_legacy` | Coordinate context-aware lesson/catalog selection with the classroom owner. |
| `historical_context_live` | Decide and implement immutable booking/lesson context history. |
| `source_coordination` | Coordinate source owners and the shared write/initialization boundaries below. |

Data-dependent blockers are `unsupported_school_context`, `unknown_class_capacity`, `conflicting_teacher_assignments`, `cross_scope_memberships`, `invalid_legacy_children`, `invalid_teacher_qualifications`, and `foreign_key_violations`. Shape/check blockers are `schema_missing_tables`, `schema_missing_columns`, `integrity_check_failed`, and `foreign_key_check_failed`. Each blocker is a fixed `{code}` object; associated quantities are in the count/schema fields. Resolving a data blocker does not remove any baseline integration blocker.

## Proposed additive integration, not an implemented migration

1. Define a stable, versioned education-context identity containing authoritative curriculum/system ID and version, school/path binding, stage, ordinal year, and teaching language. Keep display names and free-text labels separate. Agree which dimensions are mandatory before choosing a schema.
2. Add learner-context records linked to the existing child ID, with an explicit validity/history model. Do not replace children or overwrite their primary numeric grade to simulate another stage. Preserve existing child, user, school-grade, path, class, membership, assignment, slot and booking IDs.
3. Add teacher-qualification tuples binding teacher, subject and the exact context/version. Do not automatically expand two arrays into all combinations for new contexts. Legacy compatibility may be mapped only by a documented, explicitly authorized policy.
4. Provide scoped, permission-checked, audited administration for explicitly approved mappings. A mapping must refer to stable identifiers and be reviewed against the source record. Never infer it from a numeric grade, curriculum label, class name or path name. Unmapped/ambiguous rows stay blocked for review.
5. Coordinate all writers and readers: parent and agent registration, teacher invitation/admin editing, school eligibility, offers, duration/slot validation, booking revalidation, lesson selection and historical display. Until all relevant consumers agree on context, keep 015/016 guards intact.
6. Preserve confirmed bookings and already recorded results. Define how legacy bookings are labeled when their original context cannot be proven; do not invent a historical snapshot from a child's current record. Any approved backfill needs provenance, verification, and a reversible plan.

### Decisions still required

- Lesson duration for each new stage/curriculum and any allowed exceptions.
- The authoritative subject catalog, new-subject approvals, curriculum versions, and their qualification relationships.
- Whether school bindings should ever restrict booking choices, and how existing bookings and unassigned learners would be handled if that policy changes.
- Which context fields must be captured at booking and lesson time, how corrections are recorded, and how uncertain legacy history is displayed.
- Whether a learner can have simultaneous paths/contexts, how the active context is selected, and how class membership and subject exclusivity apply across them. Current single-child membership and child/subject direct-link uniqueness cannot simply be assumed correct for that policy.

## Source coordination and rollout gate

The coordination checkpoint supplied for this task records read-only inspection of main at `e2f7a099e30e04c80259b13b078922d11adf61ab`, with common base `f495c617288d991bb019c09b1d10d57d74567465`. Claude-side work changes `store.mjs`, `server.mjs`, `views.mjs`, and lesson/catalog/board files. These are coordination facts, not an approval to merge those changes. Re-check current heads before any future integration.

Coordinate explicitly with those owners before changing:

- Shared transaction behavior. `store.mjs` has a nested-operation-aware transaction wrapper; `registration.mjs` starts its own `BEGIN IMMEDIATE`. Context writes, child creation and audit must be atomic without accidentally nesting independent transaction boundaries.
- Initialization order and circular dependencies. Registration currently imports `UserError` from the store, and store startup creates registration/admin services in an existing order. Do not introduce a new initializer or context lookup before its dependencies are available.
- Positional `INSERT INTO children VALUES(...)` statements in both parent and agent registration, as well as synthetic/demo writers and tests. Adding columns without first coordinating explicit insert column lists can break old writers. Additive side tables are safer than casually widening this shared table.
- Slot/offer/booking semantics and lesson context, including Claude's lesson/catalog/board work. Do not overwrite or merge shared files to bypass this coordination gate.

Before an authorized release: agree on the policy decisions, freeze the relevant source revisions, stop incompatible writers, obtain and verify an independent live-data backup, test restoration and any migration against a copy, run integrity and identity-preservation checks, verify transactional/race/authorization behavior, and complete browser/native UI review for changed flows. Plan rollback for both schema and post-release data; a code-only rollback or mixed old/new writers may violate assignment and qualification invariants.

The verified `before.bundle` under `/workspace/shared/teachabs-backups/admin-registration-preflight-017/` protects source history only. It is **not** a live SQLite backup or evidence of restore readiness. This checkpoint does not execute any rollout step.

## Verification scope

The focused suite uses only synthetic temporary databases and covers import side effects, exact independent/empty/quoted-scope counts, all required tables and missing columns, legacy-schema non-migration, aggregate privacy, malformed qualifications, cross-scope membership, direct/inherited conflicts, foreign-key defects, CLI errors and exit codes, unchanged stored schema/rows/main-file bytes, committed WAL visibility without WAL mutation, consistent concurrent read snapshots, and retained runtime refusal of unsupported registration/assignments.

At this source checkpoint, the focused suite passed 18/18 tests and the complete `npm test` suite passed 199/199 with no failures. Syntax and whitespace checks passed. These results were independently reproduced by the fixture-test owner; neither run used a real database.

Run the final source checks with:

```sh
node --test test/school-linkage-preflight-017.test.mjs
npm test
node --check school-linkage-preflight.mjs
git diff --check
```

Synthetic test success is not evidence of production-schema compatibility, live backup integrity, migration safety, merged-source compatibility, or visual/native QA. Actual registration integration remains intentionally unfinished pending the decisions and coordination above.
