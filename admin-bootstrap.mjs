import {openStore} from './store.mjs';
import {databasePath} from './paths.mjs';
const [name,email]=process.argv.slice(2);
if(!name||!email){console.error('npm run admin:bootstrap -- "اسم المشرف العام" admin@example.com');process.exit(1);}
const store=openStore(databasePath());
try{
  const {token}=store.admin.bootstrap({name,email});
  const url=new URL('/activate',process.env.APP_ORIGIN||'http://127.0.0.1:'+(process.env.PORT||4817));
  url.searchParams.set('code',token);
  console.log('رابط خاص للمشرف الأول، صالح ليوم واحد. لا تنشره في السجلات العامة.');
  console.log(url.href);
}catch(err){console.error(err.message);process.exitCode=1;}finally{store.close();}
