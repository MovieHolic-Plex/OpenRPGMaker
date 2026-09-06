import assert from 'node:assert/strict';
import {mock} from 'node:test';
import {createServer} from 'vite';
import {writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {execFileSync} from 'node:child_process';
const out=resolve(process.argv[2]);
const root=process.cwd();
const before=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const previous=new Map(['window','fetch'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
const rows=[];
let server;
try{
 Object.defineProperty(globalThis,'window',{configurable:true,writable:true,value:{location:{hostname:'127.0.0.1',pathname:'/',search:''},localStorage:{getItem:()=>null,setItem(){}}}});
 Object.defineProperty(globalThis,'fetch',{configurable:true,writable:true,value:async()=>new Response('[]')});
 server=await createServer({root,configFile:false,envFile:false,cacheDir:join(out,'cache'),resolve:{alias:{'@':join(root,'src')}},optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false,watch:null},appType:'custom'});
 const {store}=await server.ssrLoadModule('/src/project/store.ts');
 const audit=await server.ssrLoadModule('/src/editor/editActivityLog.ts');
 store._setPersistenceStateForTest({loaded:true,remotePersistenceEnabled:true,disabledReason:null});
 for(const resetBeforeNextSpy of [false,true]){
  // Time is the behavior being investigated: run the real deferred callback deterministically.
  mock.timers.enable({apis:['setTimeout']});
  const earlier=[],later=[];
  globalThis.fetch=async(input,init)=>{earlier.push({url:String(input),method:init?.method});return new Response('[]');};
  audit.recordEditActivity({scope:'system',origin:'system',label:'previous normalization',generation:0,fields:[{path:'bundledTilesets',after:true}]});
  assert.equal(earlier.length,0);
  if(resetBeforeNextSpy)audit._resetEditActivityForTest();
  let observed;
  const signal=new Promise(resolve=>{observed=resolve;});
  globalThis.fetch=async(input,init)=>{later.push({url:String(input),method:init?.method,body:JSON.parse(init.body)});observed();return new Response('[]');};
  const snapshot=structuredClone(store.getCurrent());
  const result=await store.flush();
  assert.deepEqual(result,{kind:'saved'});
  assert.equal(later.length,0);
  mock.timers.tick(1500);
  if(!resetBeforeNextSpy){await signal;assert.equal(later.length,1);assert.equal(later[0].url,'/__oprn/edit-activity');assert.equal(later[0].method,'POST');}
  else assert.equal(later.length,0);
  assert.deepEqual(structuredClone(store.getCurrent()),snapshot);
  assert.equal(store.hasUnsavedChanges(),false);
  assert.equal(later.some(r=>r.url.includes('/rest/')),false);
  rows.push({resetBeforeNextSpy,cleanFlush:result,requestsBeforeDeadline:0,requestsAfterDeadline:later.map(r=>({url:r.url,method:r.method,fields:r.body.entries.flatMap(e=>e.fields??[])})),unchangedProject:true,unsaved:false});
  // The first row consumes its queue without resetting mirrorState; preserve enabled mirroring for the control.
  mock.timers.reset();
 }
 audit._resetEditActivityForTest();
 assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),before);
 assert.equal(execFileSync('git',['diff','--name-only','--','src','test'],{encoding:'utf8'}),'');
}finally{
 mock.timers.reset();
 if(server)await server.close();
 await rm(join(out,'cache'),{recursive:true,force:true});
 for(const [k,d]of previous){if(d)Object.defineProperty(globalThis,k,d);else Reflect.deleteProperty(globalThis,k);}
 await writeFile(join(out,'result.json'),JSON.stringify({root,head:before,rows,scope:'Controlled public audit-queue/real clean-flush probe; not replay of the entire original test sequence',cleanup:{serverClosed:true,timersReset:true,globalsRestored:true,ownedCacheRemoved:true}},null,2)+'\n',{flag:'wx'});
}
console.log(JSON.stringify({head:before,rows,pass:true}));
