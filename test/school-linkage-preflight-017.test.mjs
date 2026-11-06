import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {Worker} from 'node:worker_threads';
import {openStore} from '../store.mjs';

const moduleUrl = new URL('../school-linkage-preflight.mjs', import.meta.url);
const cliFile = fileURLToPath(moduleUrl);
const scopeA = "PRIVATE_SCOPE_ALPHA' OR 1=1 --";
const scopeB = 'PRIVATE_SCOPE_BETA';
const privateName = '<PRIVATE_PERSON_017>';
const privateEmail = 'private-person-017@example.invalid';
const id = value => 'PRIVATE_ID_017_' + value;
const countKeys = [
  'children', 'teachers', 'classes', 'unsupportedClasses', 'memberships',
  'unsupportedMemberships', 'unknownCapacityClasses', 'directAssignments',
  'teacherConflicts', 'crossScopeMemberships', 'invalidLegacyChildren',
  'invalidTeacherQualifications', 'confirmedBookings'
];
const requiredBlockers = [
  'learner_context_missing', 'teacher_context_missing', 'booking_matcher_legacy',
  'lesson_matcher_legacy', 'historical_context_live', 'source_coordination'
];
const zeroCounts = {
  children: 0, teachers: 0, classes: 0, unsupportedClasses: 0, memberships: 0,
  unsupportedMemberships: 0, unknownCapacityClasses: 0, directAssignments: 0,
  teacherConflicts: 0, crossScopeMemberships: 0, invalidLegacyChildren: 0,
  invalidTeacherQualifications: 0, confirmedBookings: 0
};
const alphaCounts = {
  children: 3, teachers: 2, classes: 4, unsupportedClasses: 3, memberships: 3,
  unsupportedMemberships: 2, unknownCapacityClasses: 1, directAssignments: 2,
  teacherConflicts: 0, crossScopeMemberships: 0, invalidLegacyChildren: 0,
  invalidTeacherQualifications: 0, confirmedBookings: 1
};

async function inspect(file, options) {
  const {inspectSchoolLinkage} = await import(moduleUrl);
  assert.equal(typeof inspectSchoolLinkage, 'function');
  return inspectSchoolLinkage(file, options);
}
function temporaryFile(t, name = 'PRIVATE_DATABASE_017.sqlite') {
  const directory = mkdtempSync(join(tmpdir(), 'school-preflight-017-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  return join(directory, name);
}
function raw(file, callback) {
  const db = new DatabaseSync(file);
  try { return callback(db); } finally { db.close(); }
}
function schemaAndRows(file) {
  const db = new DatabaseSync(file, {readOnly: true});
  try {
    const schema = db.prepare('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name').all();
    const tables = schema.filter(row => row.type === 'table');
    const rows = Object.fromEntries(tables.map(({name}) => [name,
      db.prepare('SELECT * FROM "' + name.replaceAll('"', '""') + '" ORDER BY rowid').all()
    ]));
    return {schema, rows};
  } finally { db.close(); }
}
function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}
function cli(args, options = {}) {
  return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', cliFile, ...args], {
    encoding: 'utf8', timeout: 15000, ...options
  });
}
function assertBlocked(report) {
  assert.equal(report.version, 17);
  assert.equal(report.readOnly, true);
  assert.equal(report.status, 'blocked');
  assert.equal(report.schema.compatible, true);
  assert.deepEqual(Object.keys(report.counts).sort(), [...countKeys].sort());
  for (const count of Object.values(report.counts)) assert.ok(Number.isSafeInteger(count) && count >= 0);
  const codes = report.blockers.map(blocker => blocker.code);
  for (const code of requiredBlockers) assert.ok(codes.includes(code), 'Missing integration blocker: ' + code);
  assert.equal(new Set(codes).size, codes.length);
}
function assertPrivate(report, file) {
  const serialized = JSON.stringify(report);
  for (const value of [privateName, privateEmail, 'PRIVATE_ID_017_', scopeA, scopeB, 'PRIVATE_SCOPE_', file, dirname(file)]) {
    assert.ok(!serialized.includes(value), 'Report disclosed a fixture identity, scope, or source path');
  }
  assert.deepEqual(Object.keys(report).sort(), ['blockers', 'counts', 'readOnly', 'schema', 'status', 'version']);
}

// Schema creation belongs exclusively to fixtures. The preflight must never call openStore.
function fixture(t) {
  const file = temporaryFile(t);
  openStore(file).close();
  raw(file, db => {
    db.exec('PRAGMA foreign_keys=ON; BEGIN;');
    const user = db.prepare('INSERT INTO users(id,role,name,email,scope,subjects,grades,language) VALUES(?,?,?,?,?,?,?,?)');
    for (const [key, role, scope] of [
      ['pa', 'parent', scopeA], ['pb', 'parent', scopeB], ['pe', 'parent', ''],
      ['ta', 'teacher', scopeA], ['ta2', 'teacher', scopeA], ['tb', 'teacher', scopeB], ['te', 'teacher', ''],
      ['actor', 'admin', scopeA]
    ]) user.run(id(key), role, privateName, key === 'pa' ? privateEmail : key + '-' + privateEmail, scope,
      role === 'teacher' ? '["math","science"]' : null, role === 'teacher' ? '[1,4]' : null, 'ar');
    const child = db.prepare('INSERT INTO children VALUES(?,?,?,?,?,?)');
    for (const [key, parent, grade] of [['a1', 'pa', 4], ['a2', 'pa', 1], ['a3', 'pa', 4], ['b1', 'pb', 4], ['b2', 'pb', 4], ['e1', 'pe', 4]]) {
      child.run(id(key), id(parent), privateName, grade, 'sa', 'ar');
    }
    const track = db.prepare('INSERT INTO school_tracks VALUES(?,?,?,?,?,?)');
    track.run(id('track-a'), scopeA, privateName, 'unspecified', '', 1);
    track.run(id('track-a-new'), scopeA, privateName + ' new', 'private', privateName, 0);
    track.run(id('track-b'), scopeB, privateName, 'unspecified', '', 1);
    const grade = db.prepare('INSERT INTO school_grades VALUES(?,?,?,?,?)');
    for (const [key, scope, trackKey, stage, ordinal] of [
      ['ga', scopeA, 'track-a', 'primary', 4], ['gm', scopeA, 'track-a', 'middle', 1],
      ['gs', scopeA, 'track-a', 'secondary', 1], ['gn', scopeA, 'track-a-new', 'primary', 4],
      ['gb', scopeB, 'track-b', 'primary', 4]
    ]) grade.run(id(key), scope, id(trackKey), stage, ordinal);
    const classroom = db.prepare('INSERT INTO school_classes VALUES(?,?,?)');
    for (const [key, gradeKey] of [['ca', 'ga'], ['cm', 'gm'], ['cs', 'gs'], ['cn', 'gn'], ['cb', 'gb']]) {
      classroom.run(id(key), id(gradeKey), privateName);
      if (key !== 'cn') db.prepare('INSERT INTO school_class_capacity VALUES(?,?)').run(id(key), 10);
    }
    for (const [childKey, classKey] of [['a1', 'ca'], ['a2', 'cm'], ['a3', 'cn'], ['b1', 'cb']]) {
      db.prepare('INSERT INTO school_student_assignments VALUES(?,?)').run(id(childKey), id(classKey));
    }
    for (const [classKey, teacherKey] of [['ca', 'ta'], ['cb', 'tb']]) {
      db.prepare('INSERT INTO school_teacher_assignments VALUES(?,?,?)').run(id(classKey), 'math', id(teacherKey));
    }
    for (const [key, childKey, subject, teacherKey, classKey] of [
      ['da1', 'a1', 'math', 'ta', 'ca'], ['da3', 'a3', 'science', 'ta', 'cn'], ['db1', 'b1', 'math', 'tb', 'cb']
    ]) db.prepare('INSERT INTO school_teacher_students VALUES(?,?,?,?,?,?,?)')
      .run(id(key), id(childKey), subject, id(teacherKey), id(classKey), id('actor'), 1000);
    for (const [key, teacherKey] of [['sa', 'ta'], ['sb', 'tb']]) {
      db.prepare('INSERT INTO slots(id,teacher,subject,minutes,start,instructions) VALUES(?,?,?,?,?,?)')
        .run(id(key), id(teacherKey), 'math', 45, 2000000000000, privateName);
    }
    for (const [key, parent, childKey, slotKey, status] of [
      ['ba', 'pa', 'a1', 'sa', 'confirmed'], ['bac', 'pa', 'a1', 'sa', 'cancelled'], ['bb', 'pb', 'b1', 'sb', 'confirmed']
    ]) db.prepare('INSERT INTO bookings(id,parent,child,slot,request,status) VALUES(?,?,?,?,?,?)')
      .run(id(key), id(parent), id(childKey), id(slotKey), id(key + '-request'), status);
    db.exec('COMMIT;');
  });
  return file;
}

// Catches accidental CLI execution or default database creation at import time.
test('import is inert and exposes the standalone inspection function', t => {
  const file = temporaryFile(t, 'unused.sqlite');
  const before = readdirSync(dirname(file));
  const result = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e',
    `const m = await import(${JSON.stringify(moduleUrl.href)}); if (typeof m.inspectSchoolLinkage !== 'function') process.exit(9);`
  ], {cwd: dirname(file), encoding: 'utf8', timeout: 15000});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.deepEqual(readdirSync(dirname(file)), before);
});

// Catches write-capable initialization, missing joins, unsupported ordinal matching, and PII disclosure.
test('compatible preflight gives exact scoped aggregates and leaves every schema row and byte unchanged', async t => {
  const file = fixture(t);
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: scopeA});
  assertBlocked(report);
  assert.deepEqual(report.counts, alphaCounts);
  assert.deepEqual(report.schema.missingTables, []);
  assert.equal(report.schema.integrity, 'ok');
  assert.equal(report.schema.foreignKeyViolations, 0);
  assertPrivate(report, file);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
  assert.deepEqual(await inspect(file, {scope: scopeA}), report);
});

// Catches omitted scope predicates, SQL interpolation, and treating the empty scope as a wildcard.
test('independent, empty, and absent scopes never include another school data', async t => {
  const file = fixture(t);
  const beta = await inspect(file, {scope: scopeB});
  assertBlocked(beta);
  assert.deepEqual(beta.counts, {...zeroCounts, children: 2, teachers: 1, classes: 1, memberships: 1, directAssignments: 1, confirmedBookings: 1});
  const empty = await inspect(file, {scope: ''});
  assertBlocked(empty);
  assert.deepEqual(empty.counts, {...zeroCounts, children: 1, teachers: 1});
  const absent = await inspect(file, {scope: "PRIVATE_SCOPE_ABSENT' OR 1=1 --"});
  assertBlocked(absent);
  assert.deepEqual(absent.counts, zeroCounts);
  assertPrivate(beta, file);
  assertPrivate(empty, file);
});

// Catches a missing explicit scope being silently interpreted as production scope ''.
test('API requires an explicit string scope before inspecting any database', async t => {
  const file = fixture(t), before = schemaAndRows(file), beforeHash = digest(file);
  await import(moduleUrl);
  for (const options of [undefined, null, {}, {scope: undefined}, {scope: null}, {scope: 0}, {scope: false}, {scope: []}]) {
    await assert.rejects(inspect(file, options));
  }
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches sqlite silently creating missing files and accepting memory databases as existing input.
test('missing files and non-file inputs fail without creating or migrating a database', async t => {
  const file = temporaryFile(t);
  await import(moduleUrl);
  await assert.rejects(inspect(file, {scope: ''}));
  assert.equal(existsSync(file), false);
  await assert.rejects(inspect(dirname(file), {scope: ''}));
  await assert.rejects(inspect(':memory:', {scope: ''}));
  for (const invalid of [undefined, null, '', 42]) await assert.rejects(inspect(invalid, {scope: ''}));
  assert.deepEqual(readdirSync(dirname(file)), []);
});

// Catches automatically installing current school tables or migrating an unknown legacy database.
test('legacy and incomplete schemas require review with null counts and no migrations', async t => {
  const file = temporaryFile(t);
  raw(file, db => db.exec(`
    CREATE TABLE users(id TEXT PRIMARY KEY, role TEXT, name TEXT, scope TEXT);
    CREATE TABLE school_grades(id TEXT PRIMARY KEY, scope TEXT, grade INTEGER);
    CREATE TABLE private_original_017(value TEXT);
    INSERT INTO private_original_017 VALUES('PRIVATE_PERSON_017');
  `));
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: ''});
  assert.equal(report.status, 'schema_review_required');
  assert.equal(report.readOnly, true);
  assert.equal(report.schema.compatible, false);
  assert.ok(report.schema.missingTables.includes('children'));
  assert.ok(report.schema.missingTables.includes('school_teacher_students'));
  assert.deepEqual(report.counts, Object.fromEntries(countKeys.map(key => [key, null])));
  assertPrivate(report, file);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches column-dependent queries running against an almost-compatible but unsupported shape.
test('missing required columns fail closed even when every required table exists', async t => {
  const file = fixture(t);
  raw(file, db => db.exec('ALTER TABLE users RENAME COLUMN grades TO private_old_grades_017;'));
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: scopeA});
  assert.equal(report.status, 'schema_review_required');
  assert.equal(report.schema.compatible, false);
  assert.deepEqual(report.schema.missingTables, []);
  assert.match(JSON.stringify(report.schema.missingColumns), /users/);
  assert.match(JSON.stringify(report.schema.missingColumns), /grades/);
  assert.deepEqual(report.counts, Object.fromEntries(countKeys.map(key => [key, null])));
  assert.doesNotMatch(JSON.stringify(report), /private_old_grades_017/);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches an accidentally optional source table allowing a partial readiness report.
test('every required table is checked before counts are collected', async t => {
  for (const table of ['users', 'children', 'slots', 'bookings', 'school_grades', 'school_tracks', 'school_classes',
    'school_student_assignments', 'school_teacher_assignments', 'school_class_capacity', 'school_teacher_students']) {
    const file = fixture(t);
    raw(file, db => db.exec('PRAGMA foreign_keys=OFF; DROP TABLE ' + table));
    const before = schemaAndRows(file), beforeHash = digest(file);
    const report = await inspect(file, {scope: scopeA});
    assert.equal(report.status, 'schema_review_required', table);
    assert.equal(report.schema.compatible, false, table);
    assert.ok(report.schema.missingTables.includes(table), table);
    assert.deepEqual(report.counts, Object.fromEntries(countKeys.map(key => [key, null])), table);
    assertPrivate(report, file);
    assert.deepEqual(schemaAndRows(file), before);
    assert.equal(digest(file), beforeHash);
  }
});

// Catches incoming foreign memberships disappearing when only the learner or class side is filtered.
test('suspicious cross-scope memberships are counted for both participating scopes only', async t => {
  const file = fixture(t);
  raw(file, db => {
    db.prepare('UPDATE school_student_assignments SET class_id=? WHERE child=?').run(id('cb'), id('a2'));
    db.prepare('INSERT INTO school_student_assignments VALUES(?,?)').run(id('b2'), id('ca'));
  });
  const before = schemaAndRows(file), beforeHash = digest(file);
  for (const scope of [scopeA, scopeB]) {
    const report = await inspect(file, {scope});
    assertBlocked(report);
    assert.equal(report.counts.crossScopeMemberships, 2);
    assertPrivate(report, file);
  }
  assert.equal((await inspect(file, {scope: ''})).counts.crossScopeMemberships, 0);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches class/direct teacher conflicts being hidden by a preferred-assignment resolver.
test('direct and inherited teacher disagreements are reported without repairing either link', async t => {
  const file = fixture(t);
  raw(file, db => db.prepare('UPDATE school_teacher_students SET teacher=? WHERE id=?').run(id('ta2'), id('da1')));
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: scopeA});
  assertBlocked(report);
  assert.equal(report.counts.directAssignments, 2);
  assert.equal(report.counts.teacherConflicts, 1);
  assert.equal((await inspect(file, {scope: scopeB})).counts.teacherConflicts, 0);
  assertPrivate(report, file);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches corrupt qualification JSON aborting the report or invalid source values being treated as context.
test('invalid legacy children and malformed teacher qualifications are aggregate diagnostics', async t => {
  const file = fixture(t);
  raw(file, db => {
    db.prepare('UPDATE children SET grade=7 WHERE id=?').run(id('a1'));
    db.prepare('UPDATE children SET language=? WHERE id=?').run('PRIVATE_INVALID_LANGUAGE_017', id('a2'));
    db.prepare('UPDATE users SET grades=? WHERE id=?').run('{PRIVATE_BROKEN_JSON_017', id('ta'));
    db.prepare('UPDATE users SET subjects=? WHERE id=?').run('["PRIVATE_UNKNOWN_SUBJECT_017"]', id('ta2'));
  });
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: scopeA});
  assertBlocked(report);
  assert.equal(report.counts.invalidLegacyChildren, 2);
  assert.equal(report.counts.invalidTeacherQualifications, 2);
  const beta = await inspect(file, {scope: scopeB});
  assert.equal(beta.counts.invalidLegacyChildren, 0);
  assert.equal(beta.counts.invalidTeacherQualifications, 0);
  assert.doesNotMatch(JSON.stringify(report), /PRIVATE_INVALID_LANGUAGE_017|PRIVATE_BROKEN_JSON_017|PRIVATE_UNKNOWN_SUBJECT_017/);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches exposing raw PRAGMA foreign_key_check rows or silently deleting inconsistent records.
test('foreign-key defects are counted without disclosing row identifiers or modifying data', async t => {
  const file = fixture(t);
  raw(file, db => {
    db.exec('PRAGMA foreign_keys=OFF;');
    db.prepare('INSERT INTO school_student_assignments VALUES(?,?)').run(id('missing-child'), id('ca'));
  });
  const before = schemaAndRows(file), beforeHash = digest(file);
  const report = await inspect(file, {scope: scopeA});
  assertBlocked(report);
  assert.equal(report.schema.foreignKeyViolations, 1);
  assertPrivate(report, file);
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches immutable/main-file-only readers that omit committed data still present in a live WAL.
test('read-only inspection sees committed WAL rows without checkpointing or modifying the live database', async t => {
  const file = fixture(t), writer = new DatabaseSync(file);
  try {
    writer.exec('PRAGMA journal_mode=WAL; PRAGMA wal_autocheckpoint=0;');
    writer.prepare('INSERT INTO children VALUES(?,?,?,?,?,?)').run(id('wal-child'), id('pa'), privateName, 4, 'sa', 'ar');
    const wal = file + '-wal';
    assert.ok(existsSync(wal));
    const before = schemaAndRows(file), mainHash = digest(file), walHash = digest(wal);
    const report = await inspect(file, {scope: scopeA});
    assertBlocked(report);
    assert.equal(report.counts.children, 4);
    assert.deepEqual(schemaAndRows(file), before);
    assert.equal(digest(file), mainHash);
    assert.equal(digest(wal), walHash);
  } finally { writer.close(); }
});

// Catches collecting aggregates from different commits instead of one consistent read transaction.
test('concurrent committed changes cannot produce a report assembled from different snapshots', async t => {
  const file = fixture(t);
  raw(file, db => db.prepare('INSERT INTO slots(id,teacher,subject,minutes,start,instructions) VALUES(?,?,?,?,?,?)')
    .run(id('snapshot-slot'), id('ta'), 'math', 45, 2000001000000, privateName));
  const shared = new SharedArrayBuffer(4), stop = new Int32Array(shared);
  const worker = new Worker(`
    const {workerData, parentPort} = require('node:worker_threads');
    const {DatabaseSync} = require('node:sqlite');
    const db = new DatabaseSync(workerData.file);
    const stop = new Int32Array(workerData.shared);
    db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA wal_autocheckpoint=0;');
    const child = db.prepare("INSERT INTO children VALUES(?,?,?,4,'sa','ar')");
    const booking = db.prepare("INSERT INTO bookings(id,parent,child,slot,request,status) VALUES(?,?,?,?,?,'confirmed')");
    const dropBooking = db.prepare('DELETE FROM bookings WHERE id=?');
    const dropChild = db.prepare('DELETE FROM children WHERE id=?');
    let present = false;
    parentPort.postMessage('ready');
    try {
      while (!Atomics.load(stop, 0)) {
        db.exec('BEGIN IMMEDIATE;');
        if (present) {
          dropBooking.run(workerData.booking); dropChild.run(workerData.child);
        } else {
          child.run(workerData.child, workerData.parent, 'Synthetic concurrent learner');
          booking.run(workerData.booking, workerData.parent, workerData.child, workerData.slot, workerData.booking);
        }
        db.exec('COMMIT;');
        present = !present;
        Atomics.wait(stop, 0, 0, 1);
      }
    } finally { db.close(); }
  `, {eval: true, workerData: {file, shared, child: id('snapshot-child'), parent: id('pa'), slot: id('snapshot-slot'), booking: id('snapshot-booking')}});
  const completed = once(worker, 'exit');
  try {
    await once(worker, 'message');
    for (let i = 0; i < 80; i++) {
      const report = await inspect(file, {scope: scopeA});
      assertBlocked(report);
      assert.ok([3, 4].includes(report.counts.children));
      assert.equal(report.counts.children - report.counts.confirmedBookings, 2,
        'Children and confirmed bookings changed atomically and must describe the same commit');
    }
  } finally {
    Atomics.store(stop, 0, 1);
    Atomics.notify(stop, 0);
    const [code] = await completed;
    assert.equal(code, 0);
  }
});

// Catches reporting readiness with exit zero or mixing text and user identities into the JSON stream.
test('CLI emits a complete blocked JSON report with exit 2, including an explicitly empty scope', async t => {
  const file = fixture(t), before = schemaAndRows(file), beforeHash = digest(file);
  for (const scope of [scopeA, '']) {
    const result = cli(['--database', file, '--scope', scope]);
    assert.equal(result.status, 2, result.stderr);
    assert.equal(result.stderr, '');
    const report = JSON.parse(result.stdout);
    assertBlocked(report);
    assert.deepEqual(report, await inspect(file, {scope}));
    assertPrivate(report, file);
  }
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches treating schema review as a successful inspection or mutating old databases only in the CLI path.
test('CLI returns review JSON with exit 2 for an existing empty schema', t => {
  const file = temporaryFile(t);
  raw(file, db => db.exec('CREATE TABLE original_017(value INTEGER); INSERT INTO original_017 VALUES(17);'));
  const before = schemaAndRows(file), beforeHash = digest(file);
  const result = cli(['--database', file, '--scope', '']);
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, 'schema_review_required');
  assert.equal(report.schema.compatible, false);
  assert.deepEqual(report.counts, Object.fromEntries(countKeys.map(key => [key, null])));
  assert.equal(result.stderr, '');
  assert.deepEqual(schemaAndRows(file), before);
  assert.equal(digest(file), beforeHash);
});

// Catches defaulting omitted args, ignoring unknown flags, unsanitized sqlite errors, and accidental file creation.
test('CLI rejects invalid arguments and unreadable inputs with sanitized stderr and exit 1', t => {
  const missing = temporaryFile(t), corrupt = join(dirname(missing), 'PRIVATE_CORRUPT_017.sqlite');
  const valid = fixture(t), before = schemaAndRows(valid), beforeHash = digest(valid);
  writeFileSync(corrupt, 'PRIVATE_CORRUPT_CONTENT_017');
  const cases = [
    [], ['--database', missing], ['--scope', scopeA],
    ['--database', missing, '--scope', ''],
    ['--database', corrupt, '--scope', scopeA],
    ['--database', dirname(missing), '--scope', scopeA],
    ['--database', valid, '--scope', '', '--unknown-private-flag'],
    ['--database', valid, '--scope', '', '--scope', scopeB],
    ['--database', valid, '--scope', '', '--database', valid],
    ['--database', valid, '--scope', '', 'PRIVATE_EXTRA_POSITIONAL_017']
  ];
  for (const args of cases) {
    const result = cli(args);
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, '');
    assert.ok(result.stderr.trim().length > 0);
    assert.ok(result.stderr.length < 1000);
    for (const secret of [missing, corrupt, scopeA, scopeB, 'PRIVATE_CORRUPT_CONTENT_017', 'PRIVATE_', 'node:sqlite', 'at inspectSchoolLinkage']) {
      assert.ok(!result.stderr.includes(secret), 'CLI error disclosed input or stack details');
    }
  }
  assert.equal(existsSync(missing), false);
  assert.equal(readFileSync(corrupt, 'utf8'), 'PRIVATE_CORRUPT_CONTENT_017');
  assert.deepEqual(schemaAndRows(valid), before);
  assert.equal(digest(valid), beforeHash);
});

// Catches preflight enabling school contexts or expanding legacy runtime registration by side effect.
test('inspection does not enable middle secondary or alternate-track registration and assignments', async t => {
  const file = temporaryFile(t), store = openStore(file), a = store.admin;
  try {
    const ids = a.demo(), actor = ids.supervisor, scope = a.profile(actor).scope;
    const agent = a.switchDemo(actor, 'registration_agent');
    const parent = store.registration.addParent(agent, {name: 'Synthetic parent', email: randomUUID() + '@example.invalid'}).id;
    const grade = a.addSchoolGrade(actor, {grade: 4});
    const legacyTrack = a.school(actor).grades.find(row => row.id === grade).track_id;
    const alternateTrack = a.addSchoolTrack(actor, {name: 'Synthetic alternate track'});
    const cases = [
      {trackId: legacyTrack, levelKey: 'middle:1', grade: 1},
      {trackId: legacyTrack, levelKey: 'secondary:1', grade: 1},
      {trackId: alternateTrack, levelKey: 'primary:4', grade: 4}
    ].map(context => ({...context, classId: a.addSchoolClass(actor, {...context, name: 'Synthetic class', capacity: 10}),
      childId: store.registration.addChild(agent, {parent, name: 'Synthetic learner', grade: context.grade})}));
    const teacherId = a.education(actor).teachers[0].id;
    const before = schemaAndRows(file);
    assertBlocked(await inspect(file, {scope}));
    for (const {classId, childId} of cases) {
      assert.throws(() => a.assignSchoolStudent(actor, {classId, childId}), error => error.status === 409);
      assert.throws(() => a.assignSchoolTeacher(actor, {classId, teacherId, subject: 'math'}), error => error.status === 409);
    }
    assert.throws(() => store.registration.addChild(agent, {parent, name: 'Unsupported learner', grade: 7}), error => error.status === 400);
    assert.throws(() => a.createTeacher(actor, {name: 'Unsupported teacher', email: randomUUID() + '@example.invalid', subjects: ['math'], grades: [7], language: 'ar'}), error => error.status === 400);
    assert.deepEqual(schemaAndRows(file), before);
  } finally { store.close(); }
});
