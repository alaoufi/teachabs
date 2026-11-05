# Durable storage decision and recovery runbook — stage 017

Status: local only, 2026-11-05. No hosted database, disk, credentials, payments or live configuration were created/changed. PostgreSQL/psql/Docker were not found locally; PostgreSQL migration has NOT been executed or validated.

## Decision

| Option | Fit for this code | Remaining work / limits |
|---|---|---|
| SQLite on a persistent disk, one application instance | Smallest operational change; existing synchronous SQL remains | Requires approved paid Render service/disk, explicit LEARNING_DB under mount, protected off-service backups, restore drills. Single instance and disk deployment restrictions remain. |
| Managed PostgreSQL | Preferred longer-term target for concurrent durable application data | Requires asynchronous repository conversion, parameterized SQL adapter, migrations, transaction/CAS tests, approved database plan/region/network and credentials. Current code cannot switch by adding DATABASE_URL. |
| Current free Render SQLite | Synthetic demonstrations only | Local files can disappear on restart/redeploy/spin-down. Not durable. Free Render Postgres also expires after 30 days; not a permanent storage solution. |

Recommendation: choose the long-term PostgreSQL route if the goal is sustained use with real learners; use persistent SQLite only as an explicitly accepted single-instance interim stage. No price or plan was accepted. Shared SSE/presence remains in memory; a database migration alone does not make multi-instance collaboration work.

## Implemented now

`database-backup.mjs` creates dated numbered directories, uses SQLite's online backup API (including committed WAL content), verifies integrity and foreign keys, and records schema hash, table counts and SHA-256. Concurrent backup requests reserve distinct numbers. No retention pruning or overwrite occurs. Restore requires a NEW path without a database/WAL/SHM and validates before and after copying. It does not point the app at the restore or delete anything. Hashes detect accidental changes, not malicious replacement of both database and manifest.

Examples (placeholders, not executed against live data):

```text
node database-backup.mjs snapshot PRIVATE_SOURCE.sqlite PRIVATE_BACKUP_DIRECTORY
node database-backup.mjs restore PRIVATE_SNAPSHOT_DIRECTORY NEW_RESTORE.sqlite
```

Backups contain private account and learning data, including authentication hashes/session data. Keep them out of GitHub, Library and public directories; use a protected encrypted storage destination with reviewed Windows ACLs/Unix permissions. This utility does not encrypt or upload files. Code bundles do not replace database backups. There is no schedule or off-host destination configured yet.

Board read/transition/write now executes in a single BEGIN IMMEDIATE transaction. Revision checks occur inside the transaction so a stale writer on a second database connection is rejected instead of overwriting. This does not implement cross-process SSE fan-out.

## PostgreSQL conversion gates

1. Introduce a repository interface, preserving externally visible authorization behavior. Convert request/service/store call chains to async; do not mix a PostgreSQL driver into synchronous DatabaseSync calls.
2. Version schema migrations separately. Map epoch-millisecond INTEGER values to BIGINT, boolean flags explicitly, audit INTEGER PRIMARY KEY to identity, and JSON state to JSONB or validated text. Preserve IDs, foreign keys, unique confirmed-slot index and request idempotency constraint. Replace SQLite PRAGMA, question-mark placeholders, rowid ordering and ON CONFLICT column behavior as needed.
3. Lock aggregate rows or perform UPDATE WHERE revision inside a transaction; handle initial insert conflict, serialization failures and bounded retries. Preserve draft/private page archives and scope checks. Use a separate migration role from the least-privilege runtime role.
4. Build a parameterized importer from a verified SQLite snapshot, in foreign-key order: users, children, slots, bookings, templates, instances, board/activity states, admin scopes, grants and audit. Decide whether to invalidate sessions/invites at cutover; do not silently expose or carry credentials. Preserve page/replay revisions. Never feed SQLite dump SQL directly into PostgreSQL.
5. In an approved isolated PostgreSQL test database, compare every table count and canonical per-record hashes, validate FKs/uniques, and run existing authorization and two-seat tests plus real concurrent writers, retries, restart and restore tests. No target database is currently available, so this gate is blocked.
6. Before real cutover: confirm current data and backup destination, maintenance window, retention, region, cost ceiling, RPO/RTO and who can restore. Freeze writes, make final verified snapshot, import once, verify, switch connection securely, smoke-test, then enable writes. Keep old SQLite read-only.
7. Rollback before new writes may switch back to the retained source. After new PostgreSQL writes, returning to old SQLite would lose work: stop writes and reconcile or restore forward; do not blindly redeploy old code. Keep application rollback and data rollback distinct.

## Restore drill / operations gates

Restore to a new isolated path/database, run integrity/FK/count/hash checks and domain/authorization tests, then start an isolated app with synthetic identities. Never test a restored production snapshot on a public preview. PostgreSQL backup/restore should use version-compatible pg_dump/pg_restore and include required roles/ownership handling; test restoration into a new database. RPO/RTO and retention are not claimed until measured. Store backup manifests and run outcomes privately, and alert on failed/missing backups before accepting real students.

## Evidence

29 automated tests passed. New test keeps a WAL source open, creates two simultaneous numbered backups, rejects stale writes from another connection, restores to a fresh path, checks teacher ownership after restore, refuses overwrite and detects tampered manifest. This is a local synthetic drill, not a backup of live Render data or a load test. Existing tests cover SSE reconnect and replay grant/revoke persistence.

## Official references reviewed 2026-11-05

- https://render.com/docs/disks — paid persistent disks; only mounted paths persist.
- https://render.com/docs/free — ephemeral free service and free Postgres 30-day expiry.
- https://render.com/docs/postgresql-creating-connecting — managed PostgreSQL and same-region private connectivity.
- https://www.sqlite.org/backup.html — online consistent snapshot API.
- https://nodejs.org/api/sqlite.html — backup API; availability additionally verified on installed Node v26.7.0.
- https://www.postgresql.org/docs/current/backup-dump.html — consistent logical dumps and restore prerequisites.
