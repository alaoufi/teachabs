import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
export const SOURCE='1e515fb8f6e543982fbad3ec16acc79ab238e5e9';
export async function fixture(root){
 const {openStore}=await import(pathToFileURL(resolve(root,'store.mjs'))),{createApp}=await import(pathToFileURL(resolve(root,'server.mjs')));
 const store=openStore(':memory:'),a=store.admin,ids=a.demo(),actor=ids.supervisor;
 const gradeId=a.addSchoolGrade(actor,{grade:4}),gradeOneId=a.addSchoolGrade(actor,{grade:1});
 const legacyTrackId=a.school(actor).grades.find(x=>x.id===gradeId).track_id;
 const cls=(name,capacity=16,g=gradeId)=>a.addSchoolClass(actor,{gradeId:g,name,capacity});
 const classes={first:cls('الفصل المشترك LongClassName ١'),second:cls('الفصل المشترك LongClassName ٢'),capacity:cls('فصل الدفعة ذات المقعد الواحد',1),full:cls('فصل مكتمل السعة',1),archived:cls('فصل مؤرشف'),gradeOne:cls('الصف الأول المختلف',16,gradeOneId),conflict:cls('فصل الإسنادات الفردية المتعارضة')};
 a.updateSchoolClass(actor,{classId:classes.archived,name:'فصل مؤرشف',state:'archived',revision:0});
 const pathId=a.addSchoolTrack(actor,{name:'المسار الدولي طويل الاسم المشترك International Alpha ١',educationType:'private',curriculumName:'منهج تجريبي Synthetic Curriculum 2026'});
 const secondPathId=a.addSchoolTrack(actor,{name:'المسار الدولي طويل الاسم المشترك International Alpha ٢'});
 classes.unsupported=a.addSchoolClass(actor,{trackId:pathId,levelKey:'primary:4',name:'رابع هيكلي فقط',capacity:16});
 classes.middle=a.addSchoolClass(actor,{trackId:pathId,levelKey:'middle:2',name:'المتوسط ب هيكل فقط',capacity:16});
 const teacher=(key,name,subjects,grades,owner=actor)=>a.createTeacher(owner,{name,email:`qa-${key}@example.invalid`,subjects,grades,language:'ar'}).id;
 const teachers={math:teacher('math','المعلم التجريبي طويل الاسم Mathematics المشترك ١',['math'],[4]),mathTwo:teacher('math2','المعلم التجريبي طويل الاسم Mathematics المشترك ٢',['math'],[4]),wrongGrade:teacher('wronggrade','معلم رياضيات للصف الأول فقط',['math'],[1]),science:teacher('science','معلم العلوم للصف الرابع فقط',['science'],[4]),multi:teacher('multi','معلم متعدد المواد والصفوف Mathematics Science',['math','science'],[1,4])};
 const agent=a.switchDemo(actor,'registration_agent'),{id:parent}=store.registration.addParent(agent,{name:'ولي أمر اصطناعي للفحص',email:'qa-parent@example.invalid'});
 store.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
 const child=(name,grade=4)=>store.registration.addChild(agent,{parent,name,grade});
 const students={};for(const [key,name,grade] of [['first','طالب القبول الأول'],['second','طالب القبول الثاني'],['third','طالب اختيار الطلاب أولا'],['stale','طالب يصبح غير متاح'],['capacityOne','طالب دفعة سعة أول'],['capacityTwo','طالب دفعة سعة ثان'],['suspended','طالب موقوف'],['wrongGrade','طالب الصف الأول',1],['member','عضو الفصل الأول'],['otherMember','عضو الفصل الثاني'],['fullMember','عضو الفصل المكتمل'],['conflictOne','عضو إسناد فردي أول'],['conflictTwo','عضو إسناد فردي ثان']])students[key]=child(name,grade||4);
 for(const [key,cl] of [['member','first'],['otherMember','second'],['fullMember','full'],['conflictOne','conflict'],['conflictTwo','conflict']])a.assignSchoolStudent(actor,{classId:classes[cl],childId:students[key]});
 store.registration.setStatus(agent,{kind:'child',id:students.suspended,status:'suspended'});
 a.assignSchoolTeacherStudents(actor,{gradeId,subject:'math',teacherId:teachers.math,childIds:[students.conflictOne]});
 a.assignSchoolTeacherStudents(actor,{gradeId,subject:'math',teacherId:teachers.mathTwo,childIds:[students.conflictTwo]});
 const other=a.demo(),foreignStudent=a.registration(other.supervisor).find(s=>s.grade===4),foreignGrade=a.addSchoolGrade(other.supervisor,{grade:4}),foreignClass=a.addSchoolClass(other.supervisor,{gradeId:foreignGrade,name:'Foreign secret class',capacity:10});
 teachers.foreign=teacher('foreign','Foreign secret teacher',['math'],[4],other.supervisor);
 const readonly=a.members(actor).find(m=>m.id===ids.education);a.updateMember(actor,readonly.id,{...readonly,permissions:['school.read']});
 const sessions={supervisor:store.session(actor),readonly:store.session(ids.education),foreign:store.session(other.supervisor)};
 const state=()=>({school:a.school(actor),foreignSchool:a.school(other.supervisor),audit:a.auditLog(actor),foreignAudit:a.auditLog(other.supervisor)});
 const fingerprint=()=>createHash('sha256').update(JSON.stringify(state())).digest('hex');
 const school=a.school(actor),allTeacherRows=a.education(actor).teachers,expectedTeachers=(grade,subject)=>allTeacherRows.filter(t=>t.grades.includes(grade)&&t.subjects.includes(subject)).map(t=>t.id).sort();
 // Preflight validates every generated record and all planned metadata before any listener or browser.
 for(const t of [...school.tracks,...a.school(other.supervisor).tracks])assert.ok(t.name.length>0&&t.name.length<=60,'track name bound');
 for(const t of [...allTeacherRows,...a.education(other.supervisor).teachers]){assert.ok(t.name.length>0&&t.name.length<=60,'teacher name bound');assert.ok(t.grades.every(g=>g>=1&&g<=6));assert.ok(t.subjects.length>0);}
 for(const c of [...school.classes,...a.school(other.supervisor).classes]){assert.ok(c.name.length>0&&c.name.length<=40,'class name bound');assert.ok(c.capacity>=1);assert.ok(c.studentCount<=c.capacity);}
 for(const s of [...school.students,...a.school(other.supervisor).students])assert.ok(s.name.length>0&&s.name.length<=40,'student name bound');
 assert.equal(school.classes.length,Object.keys(classes).length);
 for(const id of Object.values(classes))assert.ok(school.classes.some(c=>c.id===id));
 for(const id of Object.values(students))assert.ok(school.students.some(s=>s.id===id));
 assert.equal(school.classes.find(c=>c.id===classes.full).seatsAvailable,0);
 assert.equal(school.classes.find(c=>c.id===classes.archived).state,'archived');
 for(const id of [classes.unsupported,classes.middle])assert.equal(school.classes.find(c=>c.id===id).assignmentSupported,false);
 assert.equal(school.students.find(c=>c.id===students.suspended).status,'suspended');
 assert.equal(school.students.some(s=>s.id===foreignStudent.id),false);assert.equal(school.classes.some(c=>c.id===foreignClass),false);
 assert.equal(a.school(ids.education).students.length,0);
 for(const [role,session] of Object.entries(sessions))assert.equal(store.resolve(session),{supervisor:actor,readonly:ids.education,foreign:other.supervisor}[role]);
 for(const subject of ['math','science','islamic'])assert.deepEqual(a.schoolClassTeachers(actor,{classId:classes.first,subject}).teachers.map(t=>t.id).sort(),expectedTeachers(4,subject));
 assert.equal(a.schoolClassTeachers(actor,{classId:classes.conflict,subject:'math'}).reason,'individual-conflict');
 const meta={source:SOURCE,synthetic:true,persistence:false,gradeId,gradeOneId,legacyTrackId,pathId,secondPathId,classes,teachers,students,foreignStudent:{id:foreignStudent.id,name:foreignStudent.name},foreignClass};
 const app=createApp(store),original=app.listeners('request')[0];app.removeAllListeners('request');
 app.on('request',(req,res)=>{const role=req.headers['x-qa-role']||'supervisor';if(role==='anonymous')delete req.headers.cookie;else req.headers.cookie='ks='+(sessions[role]||sessions.readonly);delete req.headers['x-qa-role'];original(req,res);});
 return {store,a,actor,ids,app,meta,state,fingerprint,expectedTeachers,refreshReadonlySession:()=>{sessions.readonly=store.session(ids.education);assert.equal(store.resolve(sessions.readonly),ids.education);},grant:permissions=>{const m=a.members(actor).find(m=>m.id===ids.education);a.updateMember(actor,m.id,{...m,permissions});}};
}
if(process.argv.includes('--check')){const f=await fixture(process.env.QA_SOURCE_ROOT||resolve(import.meta.dirname,'../..'));console.log(JSON.stringify({source:SOURCE,preflight:'all records and planned candidate sets validated',classes:Object.keys(f.meta.classes).length,students:Object.keys(f.meta.students).length,teachers:Object.keys(f.meta.teachers).length,synthetic:true,persistence:false}));f.store.close();}
