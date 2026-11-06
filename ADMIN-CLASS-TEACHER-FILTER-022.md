# Class teacher filtering and safe admission return 022

Isolated follow-up to published 021 (30c0c89e3a8d909852674a7890a504780917ce15). Browser QA found two administration issues: the class teacher picker displayed teachers whose grades or subjects were incompatible, although saving rejected them; rejected student admission lost the selected class through the shared error page.

## Class teacher choices

The prior picker used the broad supervision/teacher roster, which contains id/name only. A separate schoolClassTeachers read API now requires school.teachers, validates the scoped active class and explicit subject, and returns id/name only for active same-scope teachers approved for that class grade and subject. Support remains limited to the explicitly initialized current registration path's primary stage. It does not infer eligibility for a new path or middle/secondary stage from matching numeric grades.

The class screen asks for the subject before showing teachers. The subject GET form carries the exact path, stage, grade and class; upstream selections clear it. Duplicate subject query values and subject without class context are rejected. No eligible teachers, an existing class-subject assignment and conflicting individual teacher links have separate messages. The direct-link compatibility predicate is shared with the unchanged transactional write guard and is not exposed through the public admin API. No existing assignment is converted or removed.

The general supervision roster stays separate and unchanged. Ordinary archived/unsupported class views remain available, including retained assignment removal controls; they do not invoke the rejecting candidate reader unless an explicit candidate subject is requested.

## Safe return after student admission errors

Only single/batch class admission handlers have a local expected-error boundary. It checks school.students and a visible class before the write, catches only UserError 400/404/409 after rollback, and checks permission and class visibility again before rendering. The return link is constructed from the current server class row (path/stage/grade/classId), never returnUrl, next, redirect or Referer. Expected errors keep their original HTTP status; authorization denials, missing/foreign class context and unexpected errors continue to the existing shared handler without a class-specific link. Missing class IDs cannot use the existing generic destination fallback.

The link opens a fresh class page. Failed selections are not silently replayed, transferred or retained. The existing complete-batch rollback and capacity rules remain unchanged.

## Verification and boundaries

The new regression tests failed before their fixes. Coverage includes 14 teacher-filter tests and 10 error-return tests: active/pending/suspended accounts, grade/subject/scope, neighboring and revoked grants, malformed and duplicate selections, unsupported and archived contexts, retained assignments, direct-link conflicts, changed qualifications after GET, expected versus unexpected errors, hostile return parameters, escaped error text, rechecks before rendering, and single/batch capacity rollback.

The complete suite is run before commit and again against the fetched published source. Independent reviews cover both changes. Browser rendering and actual Android QA for this checkpoint remain pending; source/HTTP tests are not visual approval.

Only administration modules, synthetic tests and this document change. No shared server/store/registration/views, classroom, whiteboard, schema, real data, keys, deployment, merge, PR or APK change is included. Numbered verified Git bundles retain rollback points.

Final local verification: 256/256 tests passed, 0 failures/skips. Both independent read-only reviews found no blocker; the reviewer of safe error return also ran exception, escaping and permission/class recheck probes. Syntax and whitespace checks passed. No rendered-browser or Android approval is claimed.
