import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {hostname} from 'node:os';

export async function writeQueueJson(file,value){
  const temporary=file+'.'+process.pid+'.tmp';
  await writeFile(temporary,JSON.stringify(value,null,2)+'\n');
  await rename(temporary,file);
}

export async function readQueueJson(file){
  try{return JSON.parse(await readFile(file,'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
}

/** Provider reset is a lower bound, with one minute of clock/network margin. */
export function quotaRetryAt(message,now=Date.now()){
  if(!/exhausted your capacity|quota will reset|RESOURCE_EXHAUSTED/i.test(message))return null;
  const duration=message.match(/quota will reset after\s+((?:\d+(?:\.\d+)?[hms]\s*)+)/i)?.[1];
  let seconds=0;
  for(const part of (duration??'').matchAll(/(\d+(?:\.\d+)?)([hms])/g))seconds+=Number(part[1])*({h:3600,m:60,s:1}[part[2]]);
  // Unknown reset times must not produce a tight retry loop.
  return new Date(now+(seconds>0?seconds:6*3600)*1000+60_000).toISOString();
}

/** Only the owner removes its lock. Crash leftovers require explicit inspection. */
export async function acquireQueueLock(staging,name){
  await mkdir(staging,{recursive:true});
  const lock=join(staging,name);
  try{await mkdir(lock);}catch(error){
    if(error.code==='EEXIST')throw new Error('이미 실행 중이거나 종료 확인이 필요한 잠금: '+lock);
    throw error;
  }
  try{await writeQueueJson(join(lock,'owner.json'),{pid:process.pid,host:hostname(),startedAt:new Date().toISOString()});}
  catch(error){await rm(lock,{recursive:true,force:true});throw error;}
  return ()=>rm(lock,{recursive:true,force:true});
}
