import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {staticPage} from '../admin-preview-android/generate-assets.mjs';
import {openStore} from '../store.mjs';
import {adminSchool,adminSchoolIndividuals,adminHome,adminFinance} from '../admin-views.mjs';

function fixture(t){const store=openStore(':memory:');t.after(()=>store.close());const a=store.admin,ids=a.demo();return {a,id:ids.supervisor};}
const wrapper=(html,name)=>html.match(new RegExp('<div class="adm-field adm-readable-select">(?:(?!<div).)*?<select name="'+name+'"[\\s\\S]*?</div>'))?.[0]||'';

test('long path choices retain full values and a numbered wrapped name list outside the label',t=>{
 const {a,id}=fixture(t),prefix='المسار التعليمي الدولي ذو الاسم الطويل المشترك ';
 const one=a.addSchoolTrack(id,{name:prefix+'الأول',curriculumName:'منهج طويل لتوضيح أسماء الخيارات دون اختصار'}),two=a.addSchoolTrack(id,{name:prefix+'الثاني',curriculumName:'منهج آخر طويل لتوضيح أسماء الخيارات دون اختصار'});
 const html=adminSchool(a.profile(id),a.school(id),{trackId:two,stage:'primary',grade:1}),block=wrapper(html,'trackId');assert.ok(block);
 const control=block.match(/<select name="trackId"[^>]*id="([^"]+)"[^>]*aria-describedby="([^"]+)"/);assert.ok(control);assert.match(block,new RegExp('<label for="'+control[1]+'">'));assert.match(block,new RegExp('id="'+control[2]+'"'));
 assert.ok(block.indexOf('</label>')<block.indexOf('<select'));assert.ok(block.indexOf('</select>')<block.indexOf('<details'));
 assert.match(block,/عرض الأسماء كاملة/);assert.match(block,/<ol class="adm-option-names">/);
 assert.match(block,new RegExp('<option value="'+one+'"[^>]*>١ · '));assert.match(block,new RegExp('<option value="'+two+'" selected>٢ · '));
 assert.ok(block.includes(prefix+'الأول'));assert.ok(block.includes(prefix+'الثاني'));
 assert.doesNotMatch(block,/<script|onchange=|title=/);
});

test('individual assignment full-name list distinguishes similar grade labels without changing selection',t=>{
 const {a,id}=fixture(t),g1=a.addSchoolGrade(id,{grade:1}),g4=a.addSchoolGrade(id,{grade:4});
 const s=a.schoolTeacherStudents(id,{gradeId:g4,subject:'math'});
 for(const g of s.grades)g.trackName='اسم المسار الطويل المتشابه قبل مرحلة الطالب وصفه';s.grade={...s.grade,trackName:s.grades[0].trackName};
 const html=adminSchoolIndividuals(a.profile(id),s),block=wrapper(html,'gradeId');assert.ok(block);
 assert.match(block,new RegExp('<option value="'+g1+'"[^>]*>١ · '));assert.match(block,new RegExp('<option value="'+g4+'" selected>٢ · '));
 assert.match(block,/الابتدائية · الأول/);assert.match(block,/الابتدائية · الرابع/);assert.match(block,/<ol class="adm-option-names">/);
});

test('readable choice text is escaped and short fixed stages do not gain an unnecessary list',t=>{
 const {a,id}=fixture(t),name='<img src=x onerror=alert(1)> مسار طويل للاختبار',trackId=a.addSchoolTrack(id,{name});
 const html=adminSchool(a.profile(id),a.school(id),{trackId,stage:'middle',grade:2});
 assert.match(wrapper(html,'trackId'),/&lt;img src=x onerror=alert\(1\)&gt;/);assert.doesNotMatch(html,/<img src=x/);
 const stages=wrapper(html,'stage');assert.ok(stages);assert.equal((stages.match(/<option /g)||[]).length,4);assert.doesNotMatch(stages,/adm-option-names|<details/);
 assert.match(stages,/<option value="middle" selected>المتوسطة/);
});

test('administration guide info marks use font-independent decorative SVG',t=>{
 const {a,id}=fixture(t),p=a.profile(id),pages=[adminHome(p,a.overview(id)),adminSchool(p,a.school(id)),adminSchoolIndividuals(p,a.schoolTeacherStudents(id,{})),adminFinance(p,[])];
 for(const html of pages){assert.doesNotMatch(html,/[ⓘℹ]/);assert.match(html,/<svg class="adm-info-icon"[^>]*viewBox="0 0 24 24"[^>]*aria-hidden="true"[^>]*focusable="false"/);assert.match(html,/<circle /);assert.doesNotMatch(html,/<text[ >]/);}
 const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
 assert.match(css,/\.adm \.adm-option-names[^}]*white-space:normal/);assert.match(css,/\.adm \.adm-option-names[^}]*overflow-wrap:break-word/);assert.match(css,/\.adm \.adm-info-icon\{[^}]*width:20px/);
});

test('dynamic teacher names get a full-name fallback even below the character heuristic, with unnumbered placeholders',t=>{
 const {a,id}=fixture(t),gradeId=a.addSchoolGrade(id,{grade:4});
 const s=a.schoolTeacherStudents(id,{gradeId,subject:'math'});s.teachers=s.teachers.map(row=>({...row,name:'WWWWWWWW'}));
 const html=adminSchoolIndividuals(a.profile(id),s),block=wrapper(html,'teacherId');assert.ok(block);
 assert.match(block,/<option value="">اختر المعلم<\/option>/);assert.match(block,/<ol class="adm-option-names">/);assert.match(block,/>١ · WWWWWWWW<\/option>/);
 const ids=[...html.matchAll(/<select[^>]*id="([^"]+)"/g)].map(match=>match[1]);assert.equal(ids.length,new Set(ids).size);
});

 test('individual assignment full-name references and guide SVG survive offline sanitization',t=>{
 const {a,id}=fixture(t),gradeId=a.addSchoolGrade(id,{grade:4}),p=a.profile(id);
 const html=staticPage(adminSchoolIndividuals(p,a.schoolTeacherStudents(id,{gradeId,subject:'math'})),new Set(['/admin/school']));
 assert.match(html,/<ol class="adm-option-names">/);assert.match(html,/<svg class="adm-info-icon"/);
 assert.doesNotMatch(html,/<form[ >]|<script[ >]|[ⓘℹ]/);
 for(const select of html.matchAll(/<select[^>]*>/g))assert.match(select[0],/disabled/);
});
