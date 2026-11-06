import test from 'node:test';
import assert from 'node:assert/strict';
import {openStore} from '../store.mjs';
import * as views from '../admin-views.mjs';

function fixture(t){
 const store=openStore(':memory:');
 t.after(()=>store.close());
 const ids=store.admin.demo();
 return {a:store.admin,ids,p:store.admin.profile(ids.supervisor)};
}

test('administration sections have a compact native guide and keyboard content target',t=>{
 const {a,ids,p}=fixture(t),id=ids.supervisor;
 const pages=[views.adminAccounts(p,a.members(id)),views.adminAccountForm(p),views.adminFinance(p,a.ledger(id)),views.adminRegistration(p,a.registration(id)),views.adminEducation(p,a.education(id)),views.adminTeacherForm(p),views.adminOperations(p,a.operations(id)),views.adminTechnical(p,a.technical(id)),views.adminLibraries(p,a.libraries(id)),views.adminAudit(p,a.auditLog(id))];
 for(const html of pages){
  assert.equal((html.match(/class="adm-section-guide"/g)||[]).length,1);
  assert.match(html,/<details class="adm-section-guide"><summary>/);
  assert.match(html,/class="adm-content adm-workspace" id="adm-main" tabindex="-1"/);
  assert.match(html,/class="adm-skip-link" href="#adm-main"/);
  assert.match(html,/تجربة مؤقتة/);
 }
 assert.match(views.adminFinance(p,[]),/لا ينفّذ دفعات أو تحويلات/);
 assert.match(views.adminEducation(p,{teachers:[],slots:[]}),/مواعيد فردية وليست جدولًا مدرسيًا جماعيًا/);
});

test('home and school guides are not duplicated, and school shares the compact section workspace',t=>{
 const {a,ids,p}=fixture(t);
 for(const html of [views.adminHome(p,a.overview(ids.supervisor)),views.adminSchool(p,a.school(ids.supervisor))]){
  assert.doesNotMatch(html,/class="adm-section-guide"/);
 }
 assert.doesNotMatch(views.adminHome(p,a.overview(ids.supervisor)),/class="adm-content adm-workspace"/);
 assert.match(views.adminSchool(p,a.school(ids.supervisor)),/class="adm-content adm-workspace"/);
});

test('guide and design changes retain read-only controls and role-specific navigation',t=>{
 const {a,ids}=fixture(t),p={...a.profile(ids.finance),permissions:['finance.read']};
 const html=views.adminFinance(p,a.ledger(ids.finance));
 assert.match(html,/عرض السجل فقط/);
 assert.doesNotMatch(html,/action="\/admin\/finance"/);
 assert.doesNotMatch(html,/href="\/admin\/accounts"/);
 assert.match(html,/class="adm-section-guide"/);
});

test('school events have readable Arabic audit labels and escaped details',t=>{
 const {p}=fixture(t);
 const events=['school.grade.created','school.class.created','school.teacher.assigned','school.student.assigned','school.supervisor.assigned','school.assignment.removed'];
 const html=views.adminAudit(p,events.map(action=>({action,created:Date.now(),actorName:'<script>unsafe</script>',target:'synthetic',details:{note:'<unsafe>'}})));
 for(const action of events)assert.ok(!html.includes(action));
 assert.match(html,/فتح صف دراسي/);
 assert.match(html,/إزالة إسناد/);
 assert.doesNotMatch(html,/<script>/);
 assert.match(html,/&lt;unsafe&gt;/);
});
