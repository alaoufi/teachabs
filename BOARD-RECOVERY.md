# Board file recovery — local stage 026

Teacher-only, explicitly confirmed file restore is validated by the existing server scene sanitizer and revision check. The previous teacher scene is retained in SQLite with each restore; student draft/publication are unchanged. Undo restores the last unused snapshot and retains the displaced scene too. Snapshots are isolated by lesson and saved page, omitted from HTTP/SSE payloads, and never automatically pruned. Capacity is bounded: nine imports/history entries leave one slot for undo; total board capacity remains 2 MB. A full history refuses changes, without deleting anything. This is not an unlimited version archive.

The UI confirms before replacing content, waits for pending edits, rejects stale file reads, and exposes undo after reload. Failed imports leave the scene intact. Offline users must export local work before reloading. Current free Render storage remains ephemeral: this feature does not provide durable hosting or off-site backup.

Backup 026 was bundle-verified, restored at 2e696586, and passed git fsck before editing. Registration work remains isolated at c611881; no registration files or admin grants were modified. Integrate this small patch separately when merging those branches, especially the visibleBoard serializer. No live service was changed by this stage.

Validation: full suite 40 passed before adding the dedicated HTTP test; dedicated HTTP authorization/SSE/reconnect test also passed. Browser results are recorded separately; physical device testing is not claimed.

Browser verification passed: cancel, confirmed import, student synchronization, history privacy and undo after reload. Chrome emulation at 320px/root-font 200% has no document overflow; native Excalidraw toolbar still requires separate accessibility/layout review at extreme font scaling (some tools extend beyond the visible toolbar). No physical phone or network-drop drill was performed. Imported elements are normalized through Excalidraw restoreElements before server validation.
