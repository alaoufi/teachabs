# Original page overlay prototype

Two original SVG pages extend the existing lesson catalog, only in preview. Open teacher preview and select original-book-p1 in the lesson library. These are original test activities, not official textbooks, PDFs or the 1448 curriculum. No external book content or parallel library is introduced.

The page appears behind the existing Excalidraw canvas. Drawing remains in a separate annotation scene. Teacher navigation uses existing lesson commands; students follow but cannot navigate the shared lesson. Each page uses existing lessonScenes, preparation and student moderation. Hide/show only changes local visibility and retains annotations. Zoom and fit move both layers locally without changing the other seat's viewport. Book controls are below the canvas; existing Excalidraw controls retain their positions.

Restoration uses existing session snapshots. Render's ephemeral storage is not durable learner progress. Existing JSON/PNG exports retain annotations only, not the SVG page. No PDF importer, intelligent tutor or official curriculum is claimed. On narrow phones, use zoom or accessible text details for reading.

Backups 003, 004 and 005 preserve checkpoints outside the repository. Backup 003 was restored and checked with git fsck; bundles 004 and 005 were verified. Source rights remain documented in CURRICULUM-INTEGRATION-AUDIT.md.

Build review: Node 26.7.0, npm 11.19.0, esbuild 0.28.2. Manifests and build script unchanged. Restored baseline 04d6bab rebuilt with the same dependencies matches the committed baseline after LF and generated import-hash normalization; affected imported chunks also match. Only board.js and board.css carry substantive generated changes. No third-party implementation, font or license changes.

Browser verification: two Chrome seats, teacher navigation, blocked student navigation, separate page annotations, undo/redo isolation, restored page after reload, transparent annotation canvas, local hide/show, mobile touch-emulated drawing, widths 320/500/1280, controls below canvas and no page errors. Evidence: task-10/book-verification; executable test: test/original-book-browser.cjs. Physical mobile and stylus remain untested. Initial scene background is explicitly transparent on reload to preserve page visibility.

Full regression suite: 89 tests passed, zero failures after the overlay/reload fix.
