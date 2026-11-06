import {statSync} from 'node:fs';
import {resolve} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';

// This is an inspection contract, not an application initializer or migration.
// Keep dependencies standalone: importing the store would cross that boundary.
const REQUIRED_COLUMNS = {
  users: ['id', 'role', 'scope', 'subjects', 'grades', 'language'],
  children: ['id', 'parent', 'grade', 'curriculum', 'language'],
  slots: ['id'],
  bookings: ['parent', 'slot', 'status'],
  school_grades: ['id', 'scope', 'track_id', 'stage'],
  school_tracks: ['id', 'scope', 'legacy'],
  school_classes: ['id', 'grade_id'],
  school_student_assignments: ['child', 'class_id'],
  school_teacher_assignments: ['class_id', 'subject', 'teacher'],
  school_class_capacity: ['class_id', 'capacity'],
  school_teacher_students: ['child', 'subject', 'teacher', 'class_id']
};
const COUNT_KEYS = [
  'children', 'teachers', 'classes', 'unsupportedClasses', 'memberships',
  'unsupportedMemberships', 'unknownCapacityClasses', 'directAssignments',
  'teacherConflicts', 'crossScopeMemberships', 'invalidLegacyChildren',
  'invalidTeacherQualifications', 'confirmedBookings'
];
const INTEGRATION_BLOCKERS = [
  'learner_context_missing', 'teacher_context_missing', 'booking_matcher_legacy',
  'lesson_matcher_legacy', 'historical_context_live', 'source_coordination'
];
const LEGACY_SUBJECTS = new Set(['math', 'arabic', 'science', 'english', 'islamic']);

function validArray(value, predicate) {
  if (typeof value !== 'string') return false;
  try {
    const array = JSON.parse(value);
    return Array.isArray(array) && array.length > 0 && array.every(predicate);
  } catch {
    return false;
  }
}

function inspectSnapshot(db, scope) {
  const count = (sql, ...parameters) => db.prepare(sql).get(...parameters).n;
  const blockers = INTEGRATION_BLOCKERS.map(code => ({code}));
  const missingTables = [], missingColumns = [];
  const tables = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(row => row.name));
  for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
    if (!tables.has(table)) {
      missingTables.push(table);
      continue;
    }
    // Identifiers here come only from the fixed allowlist above, never the input.
    const available = new Set(db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name));
    for (const column of columns) if (!available.has(column)) missingColumns.push(table + '.' + column);
  }

  // PRAGMA details can contain row IDs or stored values. Reduce them in memory;
  // neither raw results nor SQLite exception text may enter the report.
  const integrity = db.prepare('PRAGMA integrity_check').all().every(row => row.integrity_check === 'ok') ? 'ok' : 'failed';
  let foreignKeyViolations = null;
  try {
    foreignKeyViolations = count('SELECT COUNT(*) n FROM pragma_foreign_key_check');
  } catch {
    blockers.push({code: 'foreign_key_check_failed'});
  }
  if (missingTables.length) blockers.push({code: 'schema_missing_tables'});
  if (missingColumns.length) blockers.push({code: 'schema_missing_columns'});
  if (integrity !== 'ok') blockers.push({code: 'integrity_check_failed'});
  if (foreignKeyViolations > 0) blockers.push({code: 'foreign_key_violations'});
  const compatible = missingTables.length === 0 && missingColumns.length === 0 && integrity === 'ok' && foreignKeyViolations !== null;
  const report = {
    version: 17,
    readOnly: true,
    status: compatible ? 'blocked' : 'schema_review_required',
    schema: {compatible, missingTables, missingColumns, integrity, foreignKeyViolations},
    counts: Object.fromEntries(COUNT_KEYS.map(key => [key, null])),
    blockers
  };
  if (!compatible) return report;

  const counts = report.counts;
  const classes = 'FROM school_classes c JOIN school_grades g ON g.id=c.grade_id';
  const track = 'LEFT JOIN school_tracks t ON t.id=g.track_id AND t.scope=g.scope';
  const unsupported = "(g.stage IS NOT 'primary' OR t.legacy IS NOT 1)";
  const memberships = 'FROM school_student_assignments m JOIN school_classes c ON c.id=m.class_id JOIN school_grades g ON g.id=c.grade_id';
  counts.children = count('SELECT COUNT(*) n FROM children ch JOIN users p ON p.id=ch.parent WHERE p.scope=?', scope);
  counts.teachers = count("SELECT COUNT(*) n FROM users WHERE role='teacher' AND scope=?", scope);
  counts.classes = count(`SELECT COUNT(*) n ${classes} WHERE g.scope=?`, scope);
  counts.unsupportedClasses = count(`SELECT COUNT(*) n ${classes} ${track} WHERE g.scope=? AND ${unsupported}`, scope);
  counts.memberships = count(`SELECT COUNT(*) n ${memberships} WHERE g.scope=?`, scope);
  counts.unsupportedMemberships = count(`SELECT COUNT(*) n ${memberships} ${track} WHERE g.scope=? AND ${unsupported}`, scope);
  counts.unknownCapacityClasses = count(`SELECT COUNT(*) n ${classes} LEFT JOIN school_class_capacity k ON k.class_id=c.id WHERE g.scope=? AND k.capacity IS NULL`, scope);
  counts.directAssignments = count(`SELECT COUNT(*) n FROM school_teacher_students d JOIN school_classes c ON c.id=d.class_id JOIN school_grades g ON g.id=c.grade_id WHERE g.scope=?`, scope);
  counts.teacherConflicts = count(`SELECT COUNT(*) n ${memberships}
    JOIN school_teacher_students d ON d.child=m.child
    JOIN school_teacher_assignments inherited ON inherited.class_id=m.class_id AND inherited.subject=d.subject
    WHERE g.scope=? AND inherited.teacher<>d.teacher`, scope);
  counts.crossScopeMemberships = count(`SELECT COUNT(*) n ${memberships}
    JOIN children ch ON ch.id=m.child JOIN users p ON p.id=ch.parent
    WHERE p.scope<>g.scope AND (p.scope=? OR g.scope=?)`, scope, scope);
  counts.invalidLegacyChildren = count(`SELECT COUNT(*) n FROM children ch JOIN users p ON p.id=ch.parent
    WHERE p.scope=? AND (typeof(ch.grade)<>'integer' OR ch.grade NOT BETWEEN 1 AND 6
      OR ch.curriculum IS NOT 'sa' OR (ch.language IS NOT 'ar' AND ch.language IS NOT 'en'))`, scope);
  counts.invalidTeacherQualifications = 0;
  for (const teacher of db.prepare("SELECT subjects,grades,language FROM users WHERE role='teacher' AND scope=?").iterate(scope)) {
    // Validate each dimension independently. Bad JSON in one must not prevent
    // checking the other or abort inspection of the remaining teachers.
    const validSubjects = validArray(teacher.subjects, value => typeof value === 'string' && LEGACY_SUBJECTS.has(value));
    const validGrades = validArray(teacher.grades, value => Number.isInteger(value) && value >= 1 && value <= 6);
    const validLanguage = teacher.language === 'ar' || teacher.language === 'en';
    if (!validSubjects || !validGrades || !validLanguage) counts.invalidTeacherQualifications++;
  }
  counts.confirmedBookings = count(`SELECT COUNT(*) n FROM bookings b
    JOIN users p ON p.id=b.parent JOIN slots s ON s.id=b.slot WHERE p.scope=? AND b.status='confirmed'`, scope);

  const diagnostics = {
    unsupported_school_context: counts.unsupportedClasses + counts.unsupportedMemberships,
    unknown_class_capacity: counts.unknownCapacityClasses,
    conflicting_teacher_assignments: counts.teacherConflicts,
    cross_scope_memberships: counts.crossScopeMemberships,
    invalid_legacy_children: counts.invalidLegacyChildren,
    invalid_teacher_qualifications: counts.invalidTeacherQualifications
  };
  for (const [code, value] of Object.entries(diagnostics)) if (value > 0) blockers.push({code});
  return report;
}

/** Inspect an explicitly supplied existing snapshot. No readiness/enable action exists. */
export function inspectSchoolLinkage(databasePath, options) {
  if (!options || typeof options.scope !== 'string') throw new Error('An explicit string scope is required.');
  if (typeof databasePath !== 'string' || !databasePath || databasePath === ':memory:' || databasePath.startsWith('file:')) {
    throw new Error('An existing database file is required.');
  }
  try {
    if (!statSync(databasePath).isFile()) throw new Error();
    const db = new DatabaseSync(databasePath, {readOnly: true});
    try {
      // BEGIN is deferred/read-only, never BEGIN IMMEDIATE. Every schema check,
      // integrity check and aggregate observes the same SQLite read snapshot.
      db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF; BEGIN;');
      const report = inspectSnapshot(db, options.scope);
      db.exec('ROLLBACK;');
      return report;
    } finally {
      db.close();
    }
  } catch {
    // Do not attach a cause: paths, values and schema text can occur in errors.
    throw new Error('Unable to inspect the existing database safely.');
  }
}

function runCli(args) {
  try {
    if (args.length !== 4 || args[0] !== '--database' || args[2] !== '--scope') throw new Error();
    const report = inspectSchoolLinkage(args[1], {scope: args[3]});
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    process.exitCode = 2;
  } catch {
    process.stderr.write('Preflight failed. Use an existing SQLite snapshot: --database FILE --scope SCOPE.\n');
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) runCli(process.argv.slice(2));
