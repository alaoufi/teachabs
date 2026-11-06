// A separate process and SQLite connection are essential: Promise.all on one
// synchronous store cannot exercise competing SQLite transactions.
import {openStore} from '../../store.mjs';

const {file,actor,operation,values}=JSON.parse(process.argv[2]);
let store;
try {
  store=openStore(file);
  process.send({type:'ready',pid:process.pid});
  process.once('message',message=>{
    if(message.type!=='go')throw new Error('Unexpected race barrier message');
    // The parent holds BEGIN IMMEDIATE until both workers reach this barrier.
    process.send({type:'attempting',pid:process.pid});
    let result;
    try {
      const value=store.admin[operation](actor,values);
      result={type:'result',pid:process.pid,ok:true,value};
    }catch(error){
      result={type:'result',pid:process.pid,ok:false,status:error.status,code:error.code,message:error.message};
    }
    store.close();
    process.send(result,()=>process.disconnect());
  });
}catch(error){
  try {store?.close();}catch{}
  process.send({type:'fatal',message:error.message,code:error.code},()=>process.disconnect());
  process.exitCode=1;
}
