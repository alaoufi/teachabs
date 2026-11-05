# Teaching board trial

The lesson now embeds Excalidraw 0.18.1 locally. Its public collaboration service is not used. Existing lesson authorization and SSE carry versioned board snapshots; SQLite stores them separately in the additive `lesson_boards` table.

Teachers control whether students may edit the shared scene. Permission applies to the entire board. Stale revisions receive HTTP 409; the client retains unsaved work for JSON export and offers reload of the last saved scene. Disconnection disables editing until a snapshot is received again. Conflicts require manual recovery rather than silently merging drawings.

`board-ui/aids.js` is the initial teaching resource catalog. It contains six original sample activities across mathematics, science, Arabic, English and discussion etiquette. These are starter samples, not comprehensive or curriculum-reviewed coverage. Add stable IDs, subject, title, explanation and original or explicitly licensed content here. No student data is sent to a resource provider.

MathLive edits formulas locally; KaTeX renders them locally. Inserted formulas are PNG images, so retain the original formula separately if further editing is needed. Arabic explanations are separate text, avoiding ambiguous mixed direction math.

## Build and verification

Use Node 24 or later: `npm ci`, `npm run build:board`, `npm test`.
Generated assets are served from `/board-assets/`. Third-party notices are retained in `THIRD_PARTY_LICENSES`. The build patches Excalidraw's pinned font fallback to the same origin; review this patch before upgrading the engine. CSP blocks external scripts, fonts and connections on the lesson page.

Automated Chromium checks exercised teacher/student scene synchronization, permission changes, math image synchronization, offline recovery, reload persistence and 320/360/412-pixel layouts. No external requests or browser errors were observed in that run. No Android device or emulator was available. APK file selection and actual cross-network audio/video remain unverified.

## Data and deployment

Export JSON regularly. The envelope identifies format and version; elements remain Excalidraw-specific. Export/import into another engine is not guaranteed. PNG provides a portable visual copy.

Render's free SQLite storage is ephemeral. This change does not make it durable. Do not redeploy the existing trial until its current database is safely backed up or the owner confirms all existing data is disposable synthetic data. Use synthetic data only. Do not publish database files, backups, environment files or credentials.

Rollback baseline: deployed `bb0c11159f08528f3f73e57feab295d44eb5dd78`, local tag `rollback-005-before-board`. Backup 005 retains the deployed source, latest previous local source, Git bundles and a consistent private local SQLite backup. The Render database is not included. No automatic backup deletion is configured. Roll back deployment with a normal revert, never a force push; preserve the database before redeployment.
