# Board workspace candidate 001, revision 2

Base: `64282c1` (live trial baseline). This candidate is isolated and is not deployed.

## Changes

- The drawing canvas appears before lesson tools. The workspace has a raised border and shadow. Permissions, library, math, export/import and timer remain available in groups below the canvas.
- A dedicated expanded workspace covers the surrounding classroom without removing its features. A visible return button and Escape restore the classroom.
- Property controls can be hidden locally, and 44px selection actions provide move mode, enlarge, shrink and delete. Element resizing is distinct from fitting the board viewport.
- Teacher insertion of a lesson aid or formula starts a **local private preparation**. The teacher can move, resize or delete it before the explicit “confirm placement and send” action. No scene request is sent during preparation. All changes in that preparation are private, including edits to existing elements.
- After confirmation, intentional edits synchronize normally for live explanation. The teacher can explicitly begin another private preparation. Panel state, page scrolling, expanded view, selection and viewport fitting are never included in synchronized content.
- A changed shared scene or lesson blocks publication of an older preparation. Changes only to student drafts, permissions or the timer do not overwrite the preparation; the latest server revision is used at publication. Disconnection disables publishing. Cancellation restores the latest shared scene and resets Excalidraw’s Store and History before restoring the shared scene with `CaptureUpdateAction.NEVER`. Cancelled private elements and their deleted tombstones cannot enter later Undo/Redo or outgoing snapshots.
- Student drafts and teacher review/publication gates remain enforced by the existing server; no backend authorization code was changed.
- Newly inserted protractors store arc/tick bounds from their actual points instead of 1×1 placeholders. This fixes the geometric cause of line collapse during resize. Already distorted saved instances are not reconstructed automatically.

## Verification

- `npm run build:board`: passed.
- `npm test`: 44 tests passed, including 15 new regression/client tests.
- `git diff --check`: passed.
- A deterministic client harness exercises the actual board event handlers with mocked rendering and the real Excalidraw 0.18.1 Store/History implementation, including the editor’s committed-element filtering. Verified: no outgoing scene during preparation, resize/move/angle changes remain private, confirmation sends once, later movement synchronizes, cancellation sends nothing, drawing → Undo → Redo after cancellation never resurrects or transmits private content (including deleted elements), delayed permission/timer replies preserve the local preparation, a delayed lesson change blocks publication into the wrong lesson, concurrent shared edits block publication, disconnect/reconnect keeps the draft, student permission gates and draft-only writing, and view/selection controls do not send scene edits.
- Pure geometry tests cover point/bounds consistency across repeated scale changes, grouped move/delete, locked/unrelated element preservation, and the protractor angle anchor after scaling.
- **Not verified:** actual browser rendering, pointer dragging, native Excalidraw handles, touch interaction, 320–500px responsive layouts, or actual two-browser SSE behavior. The environment's local-browser connection is unavailable; Chromium socket creation and the supported browser preview were blocked. No restriction was bypassed. The client harness does not replace browser testing.
- Do not call this candidate ready for public deployment until an isolated browser preview passes teacher/student synchronization, preparation isolation, resizing/dragging/deletion, responsive layout, restore/export, cancellation/Undo, and expanded-workspace checks.

## Backup and rollback

Created before editing:

- Git tag `rollback-board-layout-001-before`, pointing to `64282c1`.
- Private local source backup `board-layout-001-before.tar.gz` and Git bundle `board-layout-001-before.bundle` under the shared project backup directory. These contain source only, not a live database.

Use a normal revert of the candidate commit to roll back. Never force-push. Preserve any live SQLite data before a deployment or rollback. The existing Render free trial storage warning still applies.

## Independent review fixes (revision 2)

An independent review reproduced two blockers in revision 1. Both have regression coverage in revision 2:

1. Clearing only History left the private scene in Excalidraw Store.snapshot. A later live drawing and Undo could resurrect and automatically send the cancelled tool. Cancellation now calls the public resetScene API to reset both Store and History, then restores the latest shared scene using NEVER capture. All normal remote scene application also uses NEVER. The exact drawing → cancellation → new drawing → Undo → Redo sequence now asserts that no private ID occurs in any outgoing payload, even as a deleted tombstone. Existing shared content is restored and remains intact.
2. A delayed permission/timer/lesson response could call apply while preparation was active and replace its canvas. Scene application now preserves the private scene while updating only remote metadata; older revisions are ignored. Permission and timer replies leave publication available when the shared scene is unchanged; a changed lesson keeps the draft but blocks its publication.

Backup 002 and tag `rollback-board-layout-002-before` preserve revision 1 before these fixes. Independent re-review and isolated visual/browser validation are still required before deployment.
