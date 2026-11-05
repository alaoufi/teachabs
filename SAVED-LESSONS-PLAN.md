# Saved lessons: local foundation, not a finished replay feature

Implemented locally through `store.savedLessons`: immutable teacher-owned templates with 1–30 numbered pages, sanitized teacher scenes only, fresh booking-linked instances starting at page one, revision-checked page navigation, JSON template export/import, and SQLite persistence. A template can only be instantiated by its owner for a confirmed booking with matching teacher, subject and grade. Student drafts and approved participation are not included in template serialization. Template reuse creates a separate snapshot; it does not reuse prior students' work.

The local teacher library now provides save/append-as-new-template, numbered read-only page viewing, fresh booking-linked instances, revision-checked navigation and JSON download. Browser checks cover navigation, reload, export, parent denial and 320px layout. Live SSE page navigation and a browser import control are not implemented. There is no audio/video recording or timed playback. Student replay explicitly returns 403; no administration role or grant system currently exists. No endpoint or visual toggle can enable replay yet.

## Next stages

1. Bind numbered page controls and teacher template save/open/export/import UI to authenticated lesson endpoints; synchronize page revision and current page, and define how unsaved drafts behave when the teacher changes page. Test two seats, conflicts, disconnects and restore.
2. Add actual administrative identity, scoped grants, audit events, expiry/revocation and student membership. Replay serves the approved lesson snapshot only, never another student's draft. Test that clients cannot invent a grant or change student IDs.
3. Choose durable storage and a separate protected backup destination, define retention, then restore-test the complete database. No paid resource, secret or external database was created. Current free Render SQLite remains temporary; local persistence and export do not make it durable.

## Saudi primary curriculum catalog contract

Prepare a separate catalog with jurisdiction `SA`, stage `primary`, grades 1–6, official plan edition/year, authoritative source and retrieval date. Subject records come from the verified plan; do not infer a complete list from the five prototype subjects currently in the app. Unit and lesson records require stable IDs, order, grade/subject references, objectives, source, rights/provenance and review state. Resource records reference lesson IDs, versions, allowed roles and local tool adapters. Unverified or incomplete records are not published to students.

sa-primary-reference.json records the fifth-edition subject map supplied by research, with source URLs and explicit unverified status for the sixth edition / 1448 target. Units and lessons remain empty and student publication is disabled. No official textbook text, unit names or lesson inventory has been imported. The existing sample assignments remain synthetic and must not be relabelled as official curriculum. A new catalog version should preserve links to older template versions rather than silently changing saved lessons.
