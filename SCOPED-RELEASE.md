# Scoped trial release: loading and timer only

Based directly on live b78329d. Includes Brotli/gzip, content ETags, revalidation of fixed entry files and immutable hashed chunks, optional equation-tool loading with safe retry, initial board loading feedback, and the teacher-controlled synchronized class timer.

Does not include saved lesson libraries, admin/replay grants, database migrations/backup commands, ruler, protractor or 3D viewer. No database schema change; existing board JSON gains an optional classTimer. Rollback b78329d ignores that field without dropping board drawings.

Validation: 26 automated tests passed. Scoped Chrome checks passed for mobile teacher/student timer start/pause/resume/reset/reload, initial/optional-load failure and retry, private draft publish/hide/offline/reconnect and confirmed/cancelled clear. Timer comparison waits for pause acknowledgement on both clients. No physical phone or Render cold-start benchmark.

Trial SQLite is still ephemeral; user explicitly authorized deployment after disclosure of possible loss. No automatic backup deletion, service rename, billing change or new resource.
