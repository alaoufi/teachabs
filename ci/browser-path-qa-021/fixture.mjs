import {openStore} from '../../store.mjs';
import {createApp} from '../../server.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
if (!process.env.QA_OUTPUT_DIR) throw new Error('QA_OUTPUT_DIR must name a temporary output directory');
const output=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(output,{recursive:true});
const store=openStore(':memory:'),a=store.admin,ids=a.demo(),actor=ids.supervisor;
const gradeId=a.addSchoolGrade(actor,{grade:4});
const legacyTrackId=a.school(actor).grades.find(g=>g.id===gradeId).track_id;
const classId=a.addSchoolClass(actor,{gradeId,name:'الرابع أ · اختبار مرئي',capacity:10});
const gradeOneId=a.addSchoolGrade(actor,{grade:1});
const gradeOneClassId=a.addSchoolClass(actor,{gradeId:gradeOneId,name:'الأول أ · سياق مختلف',capacity:10});
const pathId=a.addSchoolTrack(actor,{name:'المسار المصري التجريبي',educationType:'private',curriculumName:'المنهج المصري التجريبي'});
const middleId=a.addSchoolClass(actor,{trackId:pathId,levelKey:'middle:2',name:'المتوسط ب · هيكل فقط',capacity:12});
const secondaryId=a.addSchoolClass(actor,{trackId:pathId,levelKey:'secondary:3',name:'الثانوي ج · هيكل فقط',capacity:15});
const teacherId=a.createTeacher(actor,{name:'معلم الرياضيات التجريبي',email:'path-visual-teacher@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
const agent=a.switchDemo(actor,'registration_agent');
const {id:parent}=store.registration.addParent(agent,{name:'ولي أمر وهمي للفحص',email:'path-visual-parent@example.invalid'});
store.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
const childId=store.registration.addChild(agent,{parent,name:'طالب تجريبي للربط',grade:4});
a.assignSchoolStudent(actor,{classId,childId});
const port=4826,base=`http://127.0.0.1:${port}`;
const server=createApp(store,{origin:base}),original=server.listeners('request')[0],session=store.session(actor);
server.removeAllListeners('request');
server.on('request',(req,res)=>{
 if(req.url==='/__qa/state'&&req.method==='GET'){
  const school=a.school(actor),audit=a.auditLog(actor);
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify({fingerprint:createHash('sha256').update(JSON.stringify({school,audit})).digest('hex'),tracks:school.tracks,grades:school.grades,classes:school.classes,auditCount:audit.length}));return;
 }
 req.headers.cookie='ks='+session;original(req,res);
});
server.listen(port,'127.0.0.1',()=>console.log('Synthetic in-memory path browser fixture ready at '+base+'/admin/school'));
writeFileSync(join(output,'fixture-metadata.json'),JSON.stringify({source:'382c3e3ecde73bdbcf4a19fc6b683b608674ae17',synthetic:true,persistence:false,base,gradeId,legacyTrackId,classId,gradeOneClassId,pathId,middleId,secondaryId,teacherId,childId},null,2));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});});
