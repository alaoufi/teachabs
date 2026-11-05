import { openStore } from './store.mjs';
import { databasePath } from './paths.mjs';
const [name,email,subjects,grades,language]=process.argv.slice(2);
if(!language) {
  console.error('npm run invite -- "اسم المعلم" name@example.com math,science 1,2,3,4,5,6 ar');process.exit(1);
}
const s=openStore(databasePath());
try{
  const token=s.invite({name,email,subjects:subjects.split(','),grades:grades.split(',').map(Number),language});
  const url=new URL('/activate',process.env.APP_ORIGIN || 'http://127.0.0.1:'+(process.env.PORT||4817));
  url.searchParams.set('code',token);
  console.log('رابط تفعيل خاص صالح ليوم واحد');console.log(url.href);
}catch(e){console.error(e.message);process.exitCode=1;}finally{s.close();}
