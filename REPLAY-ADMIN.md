# Limited replay administration — local stage 016

This implements a narrowly scoped admin role, not full school administration. There is no default admin, password, bootstrap endpoint or account creation flow. Existing production accounts are not promoted. Synthetic admin rows exist only in isolated test databases. Future provisioning must be explicitly authorized and assign both the admin role and teacher scope; an admin with no scope has no grants to manage. Demo role switching excludes admins.

`GET /admin/replays` lists only instances belonging to explicitly assigned teachers in the same scope. POST decisions require the authenticated admin, same-origin form submission, expected revision, and an expiry of 1–30 days. Grants and append-only application audit records commit in one SQLite transaction. Revocation and expiry deny subsequent requests. Previously downloaded material cannot be recalled from a browser.

`/replays` and `/replay` provide parent-supervised review for the booking's child. The server verifies the parent-child relationship and grant on every page request. No separate student login was implemented. Only immutable, sanitized teacher template pages are served; live board archives and student submissions are excluded. Cancelled bookings cannot be reviewed. A grant is attached to one booking instance and child, not all children or future classes.

Tests cover scoped admin isolation, teacher/parent denial, forged child IDs, expiry, revocation/regrant, stale decisions, audit persistence, database reopen, CSRF origin rejection and demo role isolation. A local Chrome mobile check exercised grant → parent viewer → revoke → reload 403. No overflow at 360px. No real accounts or external service were touched.

Database tables are additive. Code rollback does not remove them. The existing temporary Render SQLite remains unsuitable for durable educational records. Before deployment, add reviewed account provisioning, operational migration/backup procedures and durable storage. No deployment, paid database or new keys were created in this stage.
