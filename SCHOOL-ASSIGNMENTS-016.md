# Teacher-to-student assignments 016

## Approved scope and approach
The administration selects a path/grade, subject and eligible teacher, then one or several enrolled students. Exclusivity is per student and subject, so other-subject teachers remain possible. Existing class-subject assignments are preserved and treated as effective assignments. Nothing automatically converts, overrides or deletes them.

A separate school-owned student-subject relation is preferable to replacing the class model, which would change existing records, or an independent relation that ignored class teachers, which would permit contradictory assignments. Only children already enrolled in a class of the selected compatible grade/path are candidates. Unenrolled students must first be placed in a class. The current registration boundary remains primary 1–6 in the legacy path; unsupported paths/stages are not guessed from a year number.

## Authorization and consistency
A new explicit `school.individuals` permission, dependent on `school.read`, authorizes viewing candidate student identities and assigning/removing direct links. Existing teacher or student grants alone do not gain these rights. Supervisor access follows the existing full-permission model.

An additive `school_teacher_students` table stores an immutable assignment ID, child, subject, teacher, class context, actor and creation time, with uniqueness on child/subject and foreign keys. Batch writes validate all members under the existing BEGIN IMMEDIATE transaction before writing any rows or audit event. A conflict rejects the entire batch. Repeating an already-effective assignment to the same teacher is a no-op; it does not replace inherited links or duplicate audit. Different teachers racing for the same student/subject cannot both succeed.

Class-teacher creation and student enrollment must reject conflicts with direct links. Removing class membership requires direct links to be explicitly removed first, preserving their context. Removal targets the exact child, subject, teacher and class without requiring the retained child/teacher account to remain active. Inherited class links are removed only through the existing class-teacher controls and permission.

## Interface
Use a compact server-rendered, no-JavaScript page under `/admin/school/assignments`: choose grade/path and subject, then an eligible active teacher, then students. Assigned students remain visible but disabled, with the current teacher and source explained. Inactive students, archived classes and inconsistent records cannot be selected. A group is at most 100 students per request, with 100-row pagination; this is a request bound, not a school/class-size restriction. Unique checkbox names survive the existing shared form decoder without editing it.

## Implementation and verification plan
1. Add failing model tests for subject-specific exclusivity, one/group assignment, no-op replay, atomic conflicts, scoped permissions and legacy coexistence. Add isolated-process races and preservation checks.
2. Implement the additive store in `school-individuals.mjs`, expose its API through `school.mjs`, and add conflict checks to the existing school-owned mutation boundaries.
3. Add failing route/UI tests, then implement only administration routes, view and scoped CSS. Test origin, forged selections, escaping, permissions, pagination and disabled reasons.
4. Run all Node tests, syntax/diff checks, independent source review and secret/protected-path checks. Save numbered bundles, commit and verify GitHub branch/tree. Do not merge, deploy, build an APK, touch production data or change classroom/whiteboard/shared store/registration/server files.

Public store interfaces:
- `schoolTeacherStudents(actor, {gradeId, subject, teacherId, page})` returns compatible grades, selected grade/subject/teacher, eligible teachers, paginated candidate students and disabled reasons.
- `assignSchoolTeacherStudents(actor, {gradeId, subject, teacherId, childIds})` returns `{assigned}` after atomic validation.
- `removeSchoolTeacherStudent(actor, {assignmentId})` removes exactly one current direct link or reports a stale target.

## Release boundary
This checkpoint remains separate from Android review 014 and structure 015. Browser/native Android review of the new flow is required before user-facing release. It adds administrative relations only: it does not create bookings, lessons, groups in the teaching room, or new access to classroom data.

## Final source verification
- 181/181 Node tests passed on the final source, including existing administration/registration/school coverage, 24 direct-assignment model tests, five HTTP/UI tests and the explicit API contract.
- Independent-process race tests cover competing teachers, overlapping batches, same-teacher retries, class/direct teacher conflicts and membership removal versus direct assignment. Five additional repeated race-suite runs passed (55 contests).
- Review found an inactive-teacher removal-flow blocker; a failing regression reproduced it, and removal/list management now remain available without selecting an active teacher, including stale previously opened removal forms.
- A sparse-array batch validation regression was found and fixed. Legacy reconstruction fixtures now remove the new empty extension table before recreating a genuinely pre-015 schema; production migration checks were not weakened.
- Source review found no remaining blocker in its scope. Browser/native Android inspection has not run for this new page, and no corrected APK is claimed.

## Rollout and rollback precautions
Do not run mixed 015/016 writers against one database. Older code does not check direct links before assigning a class teacher and can create contradictory effective teachers. Code-only rollback to 015 is therefore unsafe after direct links exist. Before any authorized deployment, stop writers, take and verify a live database backup, check schema/integrity, test a copy and plan rollback with data reconciliation. Do not silently drop or rewrite direct assignments to downgrade.

Numbered Git bundles before and after this checkpoint protect source history only. No live Render database backup, production migration or deployment was performed here. Previous branch 015 and Android-review branch 014 remain unchanged.
