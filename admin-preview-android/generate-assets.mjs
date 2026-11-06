import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {openStore} from '../store.mjs';
import * as view from '../admin-views.mjs';

const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const digest=value=>createHash('sha256').update(value).digest('hex');

// Templates are our generated administration HTML, never scraped pages or user data.
export function staticPage(body,allowedRoutes){
 let safe=body.replace(/<input\b[^>]*\btype="hidden"[^>]*>/g,'')
  .replace(/<form\b[^>]*class="([^"]*)"[^>]*>/g,'<div class="$1 preview-readonly" role="group" aria-label="نموذج عرض فقط">')
  .replace(/<\/form>/g,'</div>')
  .replace(/<button\b[^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/button>/g,'<button class="$1" type="button" disabled title="معاينة فقط، لا يتم الحفظ">$2</button>')
  .replace(/<(input|select|textarea)\b([^>]*)>/g,(_,tag,attrs)=>`<${tag}${attrs.replace(/\s(?:disabled|readonly)(?=[\s>]|$)/g,'')} disabled>`)
  .replace(/<a\b([^>]*)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,(all,before,url,after,label)=>{
   if(url.startsWith('#')||allowedRoutes.has(url))return `<a${before}href="${url}"${after.replace(/\s(?:target|rel)="[^"]*"/g,'')}>${label}</a>`;
   return `<span class="preview-disabled-link" role="link" aria-disabled="true">${label}<small>غير متاح في المعاينة</small></span>`;
  });
 if(/<form\b|<script\b|\saction=|\son\w+=|type="hidden"/i.test(safe))throw new Error('Preview still contains an active form or script');
 if(/<button\b(?![^>]*\bdisabled)[^>]*>/i.test(safe))throw new Error('Preview has an active action button');
 const csp="default-src 'none'; style-src 'self'; img-src 'self'; font-src 'self'; form-action 'none'; base-uri 'none'; connect-src 'none'; script-src 'none'";
 return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>الإدارة · معاينة تصميم فقط</title>${['style','depth','admin','preview'].map(name=>`<link rel="stylesheet" href="/preview-assets/${name}.css">`).join('')}</head><body><aside class="preview-banner" id="preview-mode"><strong>معاينة تصميم فقط</strong><span>بيانات وهمية · لا حفظ ولا اتصال بخادم</span></aside><main>${safe}</main></body></html>`;
}

export function generateAssets(destination=join(here,'app/src/main/assets')){
 const out=resolve(destination);mkdirSync(join(out,'pages'),{recursive:true});mkdirSync(join(out,'styles'),{recursive:true});
 const store=openStore(':memory:');
 try{
  const a=store.admin,ids=a.demo(),id=ids.supervisor,p=a.profile(id),members=a.members(id);
  const gradeId=a.addSchoolGrade(id,{grade:4}),classId=a.addSchoolClass(id,{gradeId,name:'الرابع · أ (مثال)'});
  const archived=a.addSchoolClass(id,{gradeId,name:'الرابع · ب (مؤرشف)'});
  a.updateSchoolClass(id,{classId:archived,name:'الرابع · ب (مؤرشف)',state:'archived',revision:0});
  const school=a.school(id),teacher=school.teachers.find(t=>t.subjects?.includes('math')&&t.grades?.includes(4)),student=school.students.find(c=>c.grade===4);
  if(teacher)a.assignSchoolTeacher(id,{classId,teacherId:teacher.id,subject:'math'});
  if(student)a.assignSchoolStudent(id,{classId,childId:student.id});
  const rows=new Map([
   ['/admin',view.adminHome(p,a.overview(id))],
   ['/admin/school',view.adminSchool(p,a.school(id))],
   ['/admin/accounts',view.adminAccounts(p,members)],
   ['/admin/accounts/new',view.adminAccountForm(p)],
   ['/admin/finance',view.adminFinance(p,a.ledger(id))],
   ['/admin/registration',view.adminRegistration(p,a.registration(id))],
   ['/admin/education',view.adminEducation(p,a.education(id))],
   ['/admin/education/teachers/new',view.adminTeacherForm(p)],
   ['/admin/operations',view.adminOperations(p,a.operations(id))],
   ['/admin/technical',view.adminTechnical(p,a.technical(id))],
   ['/admin/agents',view.adminRegistrationAgents(p,[{id:'preview-agent',name:'وكيل تجريبي',email:'agent@example.invalid',activated:true,register_parent:true,register_child:true,manage_status:false,rev:1}])],
   ['/admin/libraries',view.adminLibraries(p,a.libraries(id))],
   ['/admin/audit',view.adminAudit(p,a.auditLog(id))],
  ]);
  for(const member of members)rows.set('/admin/accounts/'+encodeURIComponent(member.id),view.adminAccountForm(p,member));
  const allowed=new Set(rows.keys()),routes={},files={};
  const write=(file,value)=>{writeFileSync(join(out,file),value);files[file]=digest(value);};
  let n=0;
  for(const [route,body] of rows){const file='pages/page-'+(++n)+'.html';routes[route]=file;write(file,staticPage(body,allowed));}
  for(const name of ['style','depth','admin']){const file='styles/'+name+'.css';routes['/preview-assets/'+name+'.css']=file;const css=readFileSync(join(root,'public',name+'.css'),'utf8');if(/@import|url\(/i.test(css))throw new Error('Offline preview CSS must not reference network or unbundled assets');write(file,css);}
  routes['/preview-assets/preview.css']='styles/preview.css';
  write('styles/preview.css',`.preview-banner{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:4px 12px;padding:9px 12px;background:#fff0cb;border-bottom:1px solid #d7b875;color:#60451b;font-family:system-ui,sans-serif;font-size:12px;line-height:1.6}.preview-banner strong{font-size:13px}.preview-readonly button:disabled{opacity:.65;cursor:default}.preview-readonly :is(input,select,textarea):disabled{opacity:1;-webkit-text-fill-color:#365447}.preview-disabled-link{display:inline-grid;gap:3px;color:#52685e}.preview-disabled-link small{font-size:11px}.adm .adm-simulation>summary small{display:none}`);
  let sourceRevision='unversioned',sourceDirty=null;try{sourceRevision=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();sourceDirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:root,encoding:'utf8'}).trim());}catch{}
  const manifest={format:1,mode:'offline-static-preview',sourceRevision,sourceDirty,network:false,persistence:false,syntheticDataOnly:true,routes,files};
  writeFileSync(join(out,'preview-manifest.json'),JSON.stringify(manifest,null,2));
  return manifest;
 }finally{store.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const manifest=generateAssets(process.argv[2]);console.log(JSON.stringify({pages:Object.keys(manifest.routes).filter(x=>x.startsWith('/admin')).length,files:Object.keys(manifest.files).length,sourceRevision:manifest.sourceRevision,network:false,persistence:false}));}
