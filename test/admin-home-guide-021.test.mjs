import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openStore} from '../store.mjs';
import {adminHome} from '../admin-views.mjs';
const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
function rules(selector){return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(m=>m[1].trim()===selector).map(m=>m[2]).join(';');}
test('home guide gets a full unshrunk flex row when opened, not a narrow half-width column',()=>{
 const head=rules('.adm .adm-hub-head'),guide=rules('.adm .adm-hub-head>details.adm-help'),open=rules('.adm .adm-hub-head>details.adm-help[open]');
 assert.match(head,/flex-wrap:wrap/);assert.match(guide,/flex:0 0 auto/);
 assert.match(open,/flex:0 0 100%/);assert.match(open,/max-width:none/);assert.match(open,/width:100%/);
 assert.doesNotMatch(open,/flex-basis:50%/);
 assert.match(rules('.adm .adm-hub-head>div'),/flex:1 1 0%/);assert.match(rules('.adm .adm-hub-head>details.adm-help>p'),/overflow-wrap:break-word/);
});
test('home guide retains native disclosure, accessible label and font-independent icon',t=>{
 const store=openStore(':memory:');t.after(()=>store.close());const a=store.admin,ids=a.demo(),html=adminHome(a.profile(ids.supervisor),a.overview(ids.supervisor));
 assert.match(html,/<details class="adm-help"><summary aria-label="دليل استخدام الإدارة">/);
 assert.match(html,/<svg class="adm-info-icon"[^>]*aria-hidden="true"/);assert.doesNotMatch(html,/class="adm-help" open|onclick=|onkeydown=/);
 assert.match(html,/«التعليم» لإدارة المعلمين ومواعيدهم/);assert.match(html,/«الصفوف» للسجلات والإسنادات/);
});
