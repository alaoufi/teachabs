import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {openStore} from '../store.mjs';
import {adminHome,adminSchool,adminFinance} from '../admin-views.mjs';

function fixture(t){const store=openStore(':memory:'),ids=store.admin.demo();t.after(()=>store.close());return {store,ids,a:store.admin};}
const cards=html=>[...html.matchAll(/<a class="adm-section-card"[^>]*data-section="([^"]+)"[^>]*aria-label="([^"]+)"[^>]*>(.*?)<\/a>/g)].map(([,key,label,body])=>({key,label,body}));

test('compact hub presents one set of sections, stable floating identities and full accessible names',t=>{
 const {a,ids}=fixture(t),p=a.profile(ids.supervisor),html=adminHome(p,a.overview(ids.supervisor)),list=cards(html);
 assert.equal(list.length,10);assert.equal(new Set(list.map(c=>c.key)).size,10);
 assert.doesNotMatch(html,/class="adm-sidebar"|class="adm-mobile-nav"|class="adm-heading"/);
 assert.match(html,/<h1>أقسام الإدارة<\/h1>/);assert.match(html,/aria-label="دليل استخدام الإدارة"/);
 for(const c of list){assert.match(c.body,/shape-[01] tone-[012]/);assert.ok(c.label.startsWith(c.body.match(/<h2>([^<]+)<\/h2>/)[1]+': '));assert.match(c.body,/<h2>[^<]+<\/h2>/);}
 const finance=cards(adminHome(a.profile(ids.finance),a.overview(ids.finance)));
 assert.equal(finance.length,1);assert.equal(finance[0].key,'finance');assert.equal(finance[0].body,list.find(c=>c.key==='finance').body);assert.equal(finance[0].label,'المحاسبة: المحاسبة المالية');
 assert.doesNotMatch(html,/shape-2/);
});

test('demo identity remains visible while role switching is collapsible and content pages retain navigation',t=>{
 const {a,ids}=fixture(t),p=a.profile(ids.supervisor),html=adminHome(p,a.overview(ids.supervisor));
 assert.match(html,/<details class="adm-simulation"><summary><strong>تجربة مؤقتة<\/strong><span>بيانات وهمية/);
 assert.doesNotMatch(html,/<details class="adm-simulation" open/);
 assert.match(html,/action="\/admin\/demo\/switch"/);
 const finance=adminFinance(p,a.ledger(ids.supervisor));
 assert.match(finance,/class="adm-sidebar"/);assert.match(finance,/class="adm-mobile-nav"/);
 const live=adminHome({...p,scope:null},a.overview(ids.supervisor));assert.doesNotMatch(live,/class="adm-simulation"/);
});

test('school forms share the compact workspace and do not advertise unavailable assignment actions',t=>{
 const {a,ids}=fixture(t),p=a.profile(ids.supervisor),html=adminSchool(p,a.school(ids.supervisor));
 assert.match(html,/class="adm-content adm-workspace"/);assert.match(html,/class="school-setup-grid"/);
 assert.doesNotMatch(html,/action="\/admin\/school\/(?:teachers|students)"/);
 assert.match(html,/الحجوزات الفردية كما هي/);
 const css=readFileSync(new URL('../public/admin.css',import.meta.url),'utf8');
 assert.match(css,/\.adm \.adm-hub \.adm-card-icon\{position:absolute;top:-22px/);
 assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 assert.match(css,/\.adm \.adm-form\{gap:10px\}/);
 assert.match(css,/min-height:44px;padding:8px 10px;font-size:16px/);
});
