import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openStore} from '../store.mjs';
import * as views from '../admin-views.mjs';
const valid=(extra={})=>({legalName:'معلم تجريبي كامل',commonName:'معلم تجريبي',phone:'0000000000',specialization:'الرياضيات',qualification:'بكالوريوس',university:'جامعة تجريبية',subjects:['الرياضيات','العلوم'],levels:['primary:1','middle:2'],maxWeeklyClasses:20,request:randomUUID(),...extra});
function fixture(t){const s=openStore(':memory:');t.after(()=>s.close());return {s,a:s.admin,ids:s.admin.demo()};}
const rejected=(fn,status=400)=>assert.throws(fn,e=>e.status===status);
test('admin registers required teacher profile without email invitation or automatic activation',t=>{
 const {s,a,ids}=fixture(t);assert.equal(typeof a.registerTeacher,'function','direct teacher registration must exist');
 const input=valid(),r=a.registerTeacher(ids.education,input),profile=a.teacherProfile(ids.education,r.id);
 assert.equal(profile.legalName,input.legalName);assert.equal(profile.name,input.commonName);assert.equal(profile.phone,input.phone);assert.deepEqual(profile.levels,input.levels);assert.deepEqual(profile.subjects,input.subjects);assert.equal(profile.maxWeeklyClasses,20);assert.equal(profile.activated,false);assert.deepEqual(profile.qualifications,[]);assert.equal(r.token,undefined);
 assert.equal(s.user(r.id).role,'teacher');assert.equal(s.user(r.id).name,input.commonName);
 assert.equal(a.education(ids.education).teachers.find(x=>x.id===r.id).activated,false);
 rejected(()=>a.renewInvitation(ids.education,r.id,'teacher'),409);
 assert.equal(a.auditLog(ids.supervisor).filter(x=>x.action==='teacher.registered').length,1);
 assert.ok(!JSON.stringify(a.auditLog(ids.supervisor).filter(x=>x.target===r.id)).includes(input.phone));
});
test('teacher registration rejects missing required fields and invalid levels subjects weekly load',t=>{
 const {a,ids}=fixture(t);assert.equal(typeof a.registerTeacher,'function');const before=a.education(ids.supervisor).teachers.length;
 for(const key of ['legalName','commonName','phone','specialization','qualification','university'])for(const value of ['', '  ', 'x'.repeat(401)])rejected(()=>a.registerTeacher(ids.education,valid({[key]:value})));
 for(const value of [0,-1,1.5,101,NaN,'20x'])rejected(()=>a.registerTeacher(ids.education,valid({maxWeeklyClasses:value})));
 for(const change of [{levels:[]},{levels:['primary:9']},{subjects:[]},{subjects:['']},{request:''},{scope:'foreign'},{id:randomUUID()},{role:'supervisor'},{email:'real@example.org'}])rejected(()=>a.registerTeacher(ids.education,valid(change)));
 assert.equal(a.education(ids.supervisor).teachers.length,before);
});
test('teacher registration is idempotent and rejects changed replay without extra rows',t=>{
 const {a,ids}=fixture(t);assert.equal(typeof a.registerTeacher,'function');const input=valid(),first=a.registerTeacher(ids.education,input);
 assert.equal(a.registerTeacher(ids.education,input).id,first.id);rejected(()=>a.registerTeacher(ids.education,{...input,specialization:'تخصص آخر'}),409);
 assert.equal(a.auditLog(ids.supervisor).filter(x=>x.action==='teacher.registered').length,1);
});
test('teacher registration reloads permissions and every detail read enforces school scope',t=>{
 const {a,s,ids}=fixture(t);assert.equal(typeof a.registerTeacher,'function');const row=a.registerTeacher(ids.education,valid()),other=a.demo();
 for(const id of [ids.finance,ids.registration,s.tour().parent,s.tour().teacher]){rejected(()=>a.registerTeacher(id,valid()),403);rejected(()=>a.teacherProfile(id,row.id),403);}
 rejected(()=>a.teacherProfile(other.supervisor,row.id),404);
 const m=a.members(ids.supervisor).find(m=>m.id===ids.education);a.updateMember(ids.supervisor,m.id,{...m,permissions:['education.read'],active:true});rejected(()=>a.registerTeacher(m.id,valid()),403);assert.equal(a.teacherProfile(m.id,row.id).id,row.id);
});
test('synthetic scope requires visibly synthetic phone and normalizes Arabic digits',t=>{
 const {a,ids}=fixture(t);assert.equal(typeof a.registerTeacher,'function');rejected(()=>a.registerTeacher(ids.education,valid({phone:'+966501234567'})));
 const r=a.registerTeacher(ids.education,valid({phone:'٠٠٠ ٠٠٠ ٠٠٠٠'}));assert.equal(a.teacherProfile(ids.education,r.id).phone,'0000000000');
});
test('teacher form replaces invite with complete registration and optional image explanation',t=>{
 const {a,ids}=fixture(t),html=views.adminTeacherForm(a.profile(ids.education));
 for(const key of ['legalName','commonName','phone','specialization','qualification','university','subjectsText','maxWeeklyClasses'])assert.match(html,new RegExp(`name="${key}"[^>]*required`),key);
 assert.match(html,/teacher_level_middle:1/);assert.match(html,/teacher_level_secondary:3/);assert.match(html,/صور المؤهلات/);assert.doesNotMatch(html,/name="email"|رابط التفعيل/);assert.match(html,/\/admin\/education\/teachers\/register/);
});
test('persistent teacher registration rejects preview placeholder and malformed international phones',t=>{
 const s=openStore(':memory:');t.after(()=>s.close());const a=s.admin.bootstrap({name:'Synthetic Supervisor',email:randomUUID()+'@example.invalid'}).id;
 for(const phone of ['0000000000','+01234567890','+1234567'])rejected(()=>s.admin.registerTeacher(a,valid({phone})));
 const r=s.admin.registerTeacher(a,valid({phone:'+966501234567'}));assert.equal(s.admin.teacherProfile(a,r.id).phone,'+966501234567');
});
