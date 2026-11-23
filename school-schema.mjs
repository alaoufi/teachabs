import {randomUUID} from 'node:crypto';
const LEGACY_GRADE_SQL='CREATE TABLE school_grades(id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade))';
const normalizeSchema=sql=>String(sql).replace(/\s+/g,'').replace(/;$/,'').toLowerCase();
export function ensureLegacySchoolTrack({one,run},scope){
 let row=one('SELECT * FROM school_tracks WHERE scope=? AND legacy=1',scope);
 if(row)return row;
 let name='مسار التسجيل الحالي',suffix=1;
 while(one("SELECT id FROM school_tracks WHERE scope=? AND name=? AND education_type='unspecified' AND curriculum_name=''",scope,name))name='مسار التسجيل الحالي ('+(++suffix)+')';
 const id=randomUUID();run("INSERT INTO school_tracks(id,scope,name,education_type,curriculum_name,legacy) VALUES(?,?,?,'unspecified','',1)",id,scope,name);
 return one('SELECT * FROM school_tracks WHERE id=?',id);
}

export function ensureSchoolSchema({db,one,all,run,transaction}){
 // Bootstrap the previous schema for fresh stores; populated legacy IDs are preserved below.
 db.exec(`CREATE TABLE IF NOT EXISTS school_grades(id TEXT PRIMARY KEY,scope TEXT NOT NULL,grade INTEGER NOT NULL CHECK(grade BETWEEN 1 AND 6),UNIQUE(scope,grade));
 CREATE TABLE IF NOT EXISTS school_classes(id TEXT PRIMARY KEY,grade_id TEXT NOT NULL REFERENCES school_grades(id),name TEXT NOT NULL,UNIQUE(grade_id,name));
 CREATE TABLE IF NOT EXISTS school_class_lifecycle(class_id TEXT PRIMARY KEY REFERENCES school_classes(id),state TEXT NOT NULL CHECK(state IN ('active','archived')),revision INTEGER NOT NULL CHECK(revision>=1));
 CREATE TABLE IF NOT EXISTS school_teacher_assignments(class_id TEXT NOT NULL REFERENCES school_classes(id),subject TEXT NOT NULL,teacher TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(class_id,subject));
 CREATE TABLE IF NOT EXISTS school_student_assignments(child TEXT PRIMARY KEY REFERENCES children(id),class_id TEXT NOT NULL REFERENCES school_classes(id));
 CREATE TABLE IF NOT EXISTS school_supervision(teacher TEXT PRIMARY KEY REFERENCES users(id),supervisor TEXT NOT NULL REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS school_schema_migrations(version INTEGER PRIMARY KEY,applied INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS school_tracks(id TEXT PRIMARY KEY,scope TEXT NOT NULL,name TEXT NOT NULL,education_type TEXT NOT NULL CHECK(education_type IN ('unspecified','government','private','other')),curriculum_name TEXT NOT NULL DEFAULT '',legacy INTEGER NOT NULL DEFAULT 0 CHECK(legacy IN (0,1)),UNIQUE(scope,name,education_type,curriculum_name));
 CREATE UNIQUE INDEX IF NOT EXISTS school_tracks_legacy ON school_tracks(scope) WHERE legacy=1;
 CREATE UNIQUE INDEX IF NOT EXISTS school_tracks_scope_key ON school_tracks(id,scope);
 CREATE TABLE IF NOT EXISTS school_class_capacity(class_id TEXT PRIMARY KEY REFERENCES school_classes(id),capacity INTEGER NOT NULL CHECK(typeof(capacity)='integer' AND capacity>=1 AND capacity<=9007199254740991));
 CREATE INDEX IF NOT EXISTS school_students_class ON school_student_assignments(class_id);`);
 const current=()=>all('PRAGMA table_info(school_grades)').some(c=>c.name==='stage');
 if(current()){
  if(!one('SELECT version FROM school_schema_migrations WHERE version=15'))throw new Error('School schema needs an explicit migration review.');
  return;
 }
 // SQLite's documented parent-table rebuild: keep the original table name until DROP,
 // preserve IDs, check every foreign key before committing, and restore enforcement.
 const foreignKeys=one('PRAGMA foreign_keys').foreign_keys;
 if(foreignKeys!==1)throw new Error('School migration requires foreign-key enforcement at startup.');
 db.exec('PRAGMA foreign_keys=OFF');
 try{
  transaction(()=>{
   if(current())return; // A concurrent initializer may have completed after our first read.
   const shape=all('PRAGMA table_xinfo(school_grades)').map(c=>[c.name,c.type,c.notnull,c.dflt_value,c.pk,c.hidden]);
   const expected=[['id','TEXT',0,null,1,0],['scope','TEXT',1,null,0,0],['grade','INTEGER',1,null,0,0]];
   const sql=one("SELECT sql FROM sqlite_master WHERE type='table' AND name='school_grades'")?.sql;
   if(JSON.stringify(shape)!==JSON.stringify(expected)||normalizeSchema(sql)!==normalizeSchema(LEGACY_GRADE_SQL)||all('PRAGMA foreign_key_list(school_grades)').length)throw new Error('School migration stopped: unknown legacy grade schema or columns require review.');
   const custom=all("SELECT name FROM sqlite_master WHERE tbl_name='school_grades' AND type IN ('index','trigger') AND sql IS NOT NULL");
   if(custom.length)throw new Error('School migration stopped: custom grade indexes/triggers require review.');
   if(one("SELECT name FROM sqlite_master WHERE name='school_grades_015'"))throw new Error('School migration stopped: replacement table already exists.');
   const legacyRows=all('SELECT id,scope,grade FROM school_grades ORDER BY id'),tracks=new Map();
   for(const {scope} of legacyRows)if(!tracks.has(scope)){
    const track=ensureLegacySchoolTrack({one,run},scope);
    tracks.set(scope,track.id);
   }
   db.exec(`CREATE TABLE school_grades_015(id TEXT PRIMARY KEY,scope TEXT NOT NULL,track_id TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN ('primary','middle','secondary')),grade INTEGER NOT NULL CHECK(typeof(grade)='integer' AND ((stage='primary' AND grade BETWEEN 1 AND 6) OR (stage IN ('middle','secondary') AND grade BETWEEN 1 AND 3))),UNIQUE(scope,track_id,stage,grade),FOREIGN KEY(track_id,scope) REFERENCES school_tracks(id,scope));`);
   for(const row of legacyRows)run('INSERT INTO school_grades_015 VALUES(?,?,?,?,?)',row.id,row.scope,tracks.get(row.scope),'primary',row.grade);
   const copied=all('SELECT id,scope,grade FROM school_grades_015 ORDER BY id');
   if(JSON.stringify(copied)!==JSON.stringify(legacyRows))throw new Error('School migration row verification failed.');
   db.exec('DROP TABLE school_grades; ALTER TABLE school_grades_015 RENAME TO school_grades;');
   if(all('PRAGMA foreign_key_check').length)throw new Error('School migration foreign-key verification failed.');
   run('INSERT OR REPLACE INTO school_schema_migrations VALUES(15,?)',Date.now());
  });
 }finally{
  db.exec('PRAGMA foreign_keys=ON');
  if(one('PRAGMA foreign_keys').foreign_keys!==1)throw new Error('School foreign-key enforcement could not be restored.');
 }
}
