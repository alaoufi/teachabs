import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openStore} from '../store.mjs';
import {adminSchool,adminRegistrationAgents} from '../admin-views.mjs';

test('class and agent card names keep their own title cell and separate state row',t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const a=store.admin,ids=a.demo(),id=ids.supervisor;
 const gradeId=a.addSchoolGrade(id,{grade:4});a.addSchoolClass(id,{gradeId,name:'الرابع · أ (مثال)',capacity:10});
 const html=adminSchool(a.profile(id),a.school(id));
 assert.match(html,/<div class="school-class-title"><h3>الرابع · أ \(مثال\)<\/h3>/);
 const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
 assert.match(css,/\.adm \.school-class-top\{display:grid;grid-template-columns:34px minmax\(0,1fr\)/);
 assert.match(css,/\.adm \.school-class-top>\.adm-badge\{grid-column:2;grid-row:2/);
 assert.match(css,/\.adm \.adm-agent-head>\.adm-badge\{grid-column:2;grid-row:2/);
 assert.match(css,/\.adm :is\(h1,h2,h3\)\{overflow-wrap:break-word;word-break:normal;hyphens:none\}/);
 assert.match(adminRegistrationAgents(a.profile(id),[{id:'preview-agent',name:'وكيل تجريبي باسم طويل',email:'agent@example.invalid',activated:true}]),/وكيل تجريبي باسم طويل/);
});

test('review build preserves accessibility scaling and restricts test navigation to packaged pages',()=>{
 const java=readFileSync(new URL('../admin-preview-android/app/src/main/java/app/teachabs/adminpreview/PreviewActivity.java',import.meta.url),'utf8');
 assert.doesNotMatch(java,/setTextZoom|setDefaultFontSize|setInitialScale/);
 assert.match(java,/route\.startsWith\("\/admin"\)/);assert.match(java,/allowed\(Uri\.parse\(requested\)\)/);
 const ps=readFileSync(new URL('../admin-preview-android/review-emulator.ps1',import.meta.url),'utf8');
 assert.match(ps,/ro.kernel.qemu/);assert.match(ps,/capture-only-not-visual-approval/);assert.match(ps,/finally/);assert.match(ps,/font_scale',\$originalScale/);
});
