# Saudi textbook integration — evidence gate, 2026-11-05

## Verified baseline
Git main and live Render: `04d6bab8fab14193b197990b94eac00a7c0549d8`.
Clean starting checkout; isolated branch `codex/curriculum-source-gate`.
Backup 003: `task-10/backups/003/teachabs.bundle`; bundle verify, independent clone and git fsck succeeded. Retain indefinitely. Rollback source is the baseline commit above. No database or published assets changed.

## Existing systems to extend, not duplicate
- `admin-technical.mjs`: scoped `admin_libraries` catalog, libraries.read/write authorization, revision checks and audit. Categories currently teaching_aid/board_shape. Requires declared rights/attribution, but declaration alone does not verify a publisher's permission. Does not fetch books or render PDFs.
- `lesson-catalog.mjs`: explicitly synthetic lesson assignments scoped by subject and grade. Do not relabel these as official curriculum units.
- `board-ui/index.jsx`: existing Excalidraw, private teacher preparation, student draft moderation, math and geometry resources. Reuse these controls and permission checks for annotations.
- `board.mjs`: lessonScenes archive and optimistic revision; current total state budget 2MB. Do not put textbook page images or PDFs in these snapshots.
- Render free SQLite storage is ephemeral. Existing saved scenes are not a durable student-progress service.

## Source status
- https://schools.madrasati.sa/books?Language=1 and https://www.ien.edu.sa could not be retrieved through the research tool in this check. This is a retrieval limitation, not proof of site outage.
- https://wraq2.com/p/saudi-curriculum.html claims 362 books and edition 1448. Treat it only as a discovery index, not edition or rights evidence.
- Candidate from its first-grade listing: https://iencontent.ien.edu.sa/books/1448-GE-PE-K01-SM1-math.part3.pdf . Retrieval returned 502. Cover, edition, contents, page count, printed-page mapping and rights have NOT been verified. Filename alone is insufficient evidence of edition 1448 or newest edition.
- Main-task source review reported Madrasati use-policy pages 13–14 restrict storage/reproduction/use on another site without written permission. This audit has not independently interpreted that policy. No book was copied, hosted, embedded or represented as licensed.

## Integration contract for a verified book
Extend the existing catalog with explicit stage, grade, track (nullable), subject, term, book type, publisher, edition printed on cover, source URL, verification date, rights evidence URL/document, and rights status. Unknown remains unknown; never default a filename year to verified edition.
Attach units and lessons only after checking the actual contents page. Store stable IDs and separate PDF page index from printed page labels; one may differ from the other.
Keep book bytes outside lesson scene JSON. Render only the current authorized page, cancel stale page renders, and bound cache/memory. Use a local pinned PDF renderer only after license and file provenance review.
Keep page background immutable; store teacher/student annotations separately under existing booking, role, lesson, book-edition and page identifiers. Preserve private preparation and teacher publication semantics. Enforce permissions server-side, not only with disabled controls.
Progress should record last viewed page, not claim learning completion. It must be scoped to the authenticated learner/booking, with versioned writes and durable storage before claiming cross-device persistence. A browser-only bookmark must be labeled local.

## Explicitly not implemented
No official book catalog imported; no verified 1448 edition; no PDF viewer, per-page annotation integration, durable progress, intelligent tutor, generated answers or schedules. Do not publish a demo as an official textbook until a specific permitted PDF is available. An original test document can validate rendering mechanics, but must be clearly labeled non-curriculum test material.

Next dependency: provide verified official file plus permission covering in-project display, or choose an explicitly licensed test document. Then extend the existing catalog/board and test navigation, zoom, page identity, permission isolation, annotation persistence, stale writes and existing lesson workflows before deployment.
