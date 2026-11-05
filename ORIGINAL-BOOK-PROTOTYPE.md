# Original book prototype — not an official curriculum

Two original HTML pages are integrated into the existing lesson catalog, visible only in preview. Select original-book-p1 in the existing lesson library. The teacher switches pages through existing lesson commands; students follow the selected page. Each page uses existing lessonScenes for separate annotation state, teacher preparation and student moderation. No new store, parallel library, external content, official textbook, PDF renderer or intelligent tutor is introduced.

Page text is immutable UI; explanations are in the separate existing whiteboard, not an overlay on PDF. Page display and its controls are below the canvas. Zoom is local text zoom (75–175%), not synchronized. Current page and annotation restoration use existing session snapshots; preview persistence is not a durable learner record or evidence of mastery. Render's ephemeral storage remains a limitation. Export existing board JSON/PNG to retain annotations.

Backup 003 and source baseline are documented in CURRICULUM-INTEGRATION-AUDIT.md. Source verification test: test/original-book.test.mjs. This is a source prototype pending browser validation and reproducible asset build review before deployment. No claim that official 1448 books are available. The audit's earlier 'not implemented' list describes its earlier checkpoint; this document records the subsequent original-material experiment.

Build review: npm run build:board touched many existing hashed assets and a font beyond this small source change. Do not publish those artifacts without investigating dependency/build drift. Keep existing deployed assets intact until a verified build and browser permission/navigation tests pass.
