import {openStore} from '../../store.mjs';
import {createApp} from '../../server.mjs';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
if (!process.env.QA_OUTPUT_DIR) throw new Error('QA_OUTPUT_DIR must name a temporary output directory');
const output=resolve(process.env.QA_OUTPUT_DIR);mkdirSync(output,{recursive:true});
const store=openStore(':memory:'), a=store.admin, ids=a.demo(), actor=ids.supervisor;
const gradeId=a.addSchoolGrade(actor,{grade:4});
const classId=a.addSchoolClass(actor,{gradeId,name:'الرابع أ · اختبار مرئي',capacity:10});
const classB=a.addSchoolClass(actor,{gradeId,name:'الرابع ب · اختبار تعارض',capacity:10});
const teacherId=a.createTeacher(actor,{name:'معلم الرياضيات التجريبي',email:'visual-teacher@example.invalid',subjects:['math','science'],grades:[4],language:'ar'}).id;
const other=a.createTeacher(actor,{name:'معلم الفصل التجريبي',email:'visual-other@example.invalid',subjects:['math'],grades:[4],language:'ar'}).id;
const agent=a.switchDemo(actor,'registration_agent');
const {id:parent}=store.registration.addParent(agent,{name:'ولي أمر وهمي للفحص',email:'visual-parent@example.invalid'});
store.registration.setStatus(agent,{kind:'parent',id:parent,status:'active'});
const children=[];
for(const [i,name] of ['طالب تجريبي أول','طالب تجريبي ثان','طالب تجريبي ثالث','طالب لديه إسناد فصل'].entries()) {
 const id=store.registration.addChild(agent,{parent,name,grade:4});children.push(id);a.assignSchoolStudent(actor,{classId:i===3?classB:classId,childId:id});
}
a.assignSchoolTeacher(actor,{classId:classB,teacherId:other,subject:'math'});
const port=4826, base=`http://127.0.0.1:${port}`;
const server=createApp(store,{origin:base}), original=server.listeners('request')[0], session=store.session(actor);
server.removeAllListeners('request');server.on('request',(req,res)=>{req.headers.cookie='ks='+session;original(req,res);});
server.listen(port,'127.0.0.1',()=>console.log('Synthetic in-memory browser fixture ready at '+base+'/admin/school/assignments'));
writeFileSync(join(output,'fixture-metadata.json'),JSON.stringify({source:'6671f61bc13eba5e842904227d08ea7faf4cb810',synthetic:true,persistence:false,base,gradeId,teacherId,children},null,2));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{server.closeAllConnections();server.close(()=>{store.close();process.exit(0);});});
