import {CLASSROOM_FEATURES, featureDefaults} from './public/classroom-features.js';

// Additive local classroom configuration, not a second school or scheduling store.
export function createClassroomSettings({db,one,run,transaction,requireAccess,audit,check,user}) {
  db.exec(`CREATE TABLE IF NOT EXISTS admin_classroom_settings(
    scope TEXT PRIMARY KEY, features TEXT NOT NULL CHECK(json_valid(features)),
    revision INTEGER NOT NULL CHECK(revision > 0));`);
  function readScope(scope) {
    const row = one('SELECT features,revision FROM admin_classroom_settings WHERE scope=?', scope);
    return {features: {...featureDefaults(), ...(row ? JSON.parse(row.features) : {})}, revision: row?.revision || 0};
  }
  function classroomSettings(id) { return readScope(requireAccess(id, 'classroom.read').scope); }
  // Only trusted server code calls this with the room owner's identity, never a browser scope.
  function classroomFeaturesForTeacher(id) {
    const teacher = user(id); check(teacher.role === 'teacher', 'حساب المعلم غير صالح.', 403);
    return readScope(teacher.scope).features;
  }
  function setClassroomSettings(id, {features, revision}) {
    return transaction(() => {
      const actor = requireAccess(id, 'classroom.write');
      check(features && typeof features === 'object' && !Array.isArray(features), 'راجع إعدادات المكونات.');
      const keys = CLASSROOM_FEATURES.map(f => f.key);
      check(Object.keys(features).length === keys.length && keys.every(k => Object.hasOwn(features,k) && typeof features[k] === 'boolean'), 'راجع إعدادات المكونات.');
      const before = readScope(actor.scope);
      check(Number.isSafeInteger(revision) && revision === before.revision, 'تغيّرت الإعدادات. حدّث الصفحة ثم أعد المحاولة.', 409);
      const changes = keys.filter(k => features[k] !== before.features[k]);
      if (!changes.length) return before;
      const next = {features: Object.fromEntries(keys.map(k => [k,features[k]])), revision: revision + 1};
      run('INSERT INTO admin_classroom_settings VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET features=excluded.features,revision=excluded.revision', actor.scope, JSON.stringify(next.features), next.revision);
      audit(actor, 'classroom.settings.updated', actor.scope || 'classroom', {revision:next.revision,changes:Object.fromEntries(changes.map(k=>[k,{before:before.features[k],after:features[k]}]))});
      return next;
    });
  }
  return {classroomSettings,setClassroomSettings,classroomFeaturesForTeacher};
}
