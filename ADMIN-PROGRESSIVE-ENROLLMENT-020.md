# Progressive administration and class enrollment 020

This isolated change builds on published 019 (25e11ce2e33aef92fbeb20eb3c6b6933278f90ac). The requested flow is explicit path, fixed stage, fixed grade, then class selection or creation. No downstream control or record appears before its parent is selected. Changing a parent clears descendants. Existing complete grade links stop at the class chooser rather than selecting a class automatically.

Two confirmed enrollment methods share one server operation: (1) select unassigned students of the selected grade, then choose their destination class; (2) open a class, see only its own members, and select additions from that grade's unassigned active students. No student is transferred or removed automatically. A batch contains 1–100 distinct students and is saved completely or rejected completely using the existing immediate transaction and per-student guards/audits.

The implementation retains native labeled controls, numbered wrapped references for variable-length names, SVG information marks, compact forms and mobile touch targets. Archived classes remain selectable for inspection/restoration, but cannot accept enrollment. Permission-scoped identity lists, exact scope/grade checks, capacity and direct-teacher-link constraints remain authoritative on the server.

Actual admissions still support only the primary stage of the explicitly initialized current registration path. New paths and middle/secondary stages support structure only. Their student and teacher identities are not inferred from a numeric grade. Shared registration, server, store, classroom and whiteboard files are out of scope; no schema or live-data changes, deployment, merge, PR or APK release.

## Execution and checks

1. Preserve 019 and a numbered verified Git bundle; work on independent 020.
2. Add failing tests for incomplete selector states, hierarchy errors, class-specific visibility and both bulk form routes.
3. Implement strict navigation, canonical class redirects, two scoped forms and atomic bulk admission without schema changes.
4. Test permission/origin and rollback/error cases, individual-link compatibility and independent-process races. Update old UI assertions only where automatic selection was intentionally removed.
5. Run the complete suite, independent review, source/credential boundary checks, commit and verify GitHub tree and numbered backup.
6. Send the exact source SHA for separate visual/mobile review. Source tests do not constitute visual approval.

## Review boundaries

The class membership screen now shows one class at a time. The existing dedicated teacher-to-student assignment page remains grade-wide across that grade's classes, as explicitly requested in 016, with each student's class labeled; it is not a class enrollment or transfer page. No teacher assignment is rewritten by 020.

The existing offline Android preview generator is not regenerated here. Its controls are disabled and it does not support the new multi-step form interaction. A new APK must not be treated as a functional review of 020 without a separately designed and tested preview flow. Browser review should use the synthetic local app, check every partial state and both enrollment methods at 320/360/393 widths and increased text size, and verify Back/Forward, refresh, duplicate submission, full capacity and stale membership errors. Those visual steps remain pending.

## Verified source checkpoint

- Complete suite: 230/230 passed after the final changes. New coverage: 11 selector tests, 8 HTTP/UI enrollment tests and 18 bulk-store tests. The bulk tests include three rounds each of independent-process overlapping batches, last-seat competition and concurrent capacity shrink.
- Independent read-only review found no blocking correctness, security or permission regression; it separately rechecked selectors, candidate filtering, retained suspended membership and rollback. Visual approval is not included.
- Read-only comparison found main at 76358e30a0cf2f775c456f1458002b928188d610, common base f495c617288d991bb019c09b1d10d57d74567465. Its changed paths do not overlap this 020 patch. Main changes shared server/store/views and classroom work; no merge or integration was attempted.
- Source allowlist and credential-pattern checks cover only administration source, synthetic tests and this document. No databases, real student data, environment files, credentials or APK are included. Numbered Git bundle rollback points are retained outside the repository.
