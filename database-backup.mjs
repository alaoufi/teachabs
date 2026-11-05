import {DatabaseSync,backup} from 'node:sqlite';
import {mkdir,readdir,readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const digest=async file=>createHash('sha256').update(await readFile(file)).digest('hex');
function inspect(file){
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  const integrity=db.prepare('PRAGMA integrity_check').all();if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw Error('Database integrity check failed');
  if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Database foreign-key check failed');
  const schema=db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").all();
  const counts={};for(const row of schema.filter(r=>r.type==='table'))counts[row.name]=db.prepare('SELECT count(*) n FROM "'+row.name.replaceAll('"','""')+'"').get().n;
  return {schemaHash:createHash('sha256').update(JSON.stringify(schema)).digest('hex'),counts};
 }finally{db.close();}
}
export async function snapshotDatabase(source,root){
 source=resolve(source);root=resolve(root);await stat(source);await mkdir(root,{recursive:true,mode:0o700});
 const entries=await readdir(root);let number=Math.max(0,...entries.map(n=>Number(/^snapshot-(\d+)-/.exec(n)?.[1]||0)))+1,directory;
 for(;;number++){directory=join(root,'snapshot-'+String(number).padStart(4,'0')+'-'+new Date().toISOString().replaceAll(/[:.]/g,'-'));try{await mkdir(join(root,'.reserved-'+String(number).padStart(4,'0')),{mode:0o700});await mkdir(directory,{mode:0o700});break;}catch(e){if(e.code!=='EEXIST')throw e;}}
 const target=join(directory,'database.sqlite'),db=new DatabaseSync(source,{readOnly:true});
 try{await backup(db,target);}finally{db.close();}
 const manifest={format:'teaching-db-snapshot',version:1,createdAt:new Date().toISOString(),number,sha256:await digest(target),...inspect(target)};
 await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest,null,2),{flag:'wx',mode:0o600});return {directory,number};
}
export async function restoreDatabase(directory,target){
 directory=resolve(directory);target=resolve(target);const source=join(directory,'database.sqlite'),manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
 if(manifest.format!=='teaching-db-snapshot'||manifest.version!==1||await digest(source)!==manifest.sha256)throw Error('Snapshot verification failed');
 const info=inspect(source);if(info.schemaHash!==manifest.schemaHash||JSON.stringify(info.counts)!==JSON.stringify(manifest.counts))throw Error('Snapshot content mismatch');
 // Destination must not exist. Never replace an active database or its WAL files.
 for(const suffix of ['','-wal','-shm']){try{await stat(target+suffix);throw Error('Restore destination already exists');}catch(e){if(e.code!=='ENOENT')throw e;}}
 await copyFile(source,target,constants.COPYFILE_EXCL);
 if(await digest(target)!==manifest.sha256)throw Error('Restored file verification failed');inspect(target);return {verified:true};
}
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const [action,source,target]=process.argv.slice(2);try{if(!source||!target||!['snapshot','restore'].includes(action))throw Error('Usage: node database-backup.mjs snapshot SOURCE BACKUP_ROOT | restore SNAPSHOT_DIRECTORY NEW_DATABASE');const result=await(action==='snapshot'?snapshotDatabase(source,target):restoreDatabase(source,target));console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}
}
