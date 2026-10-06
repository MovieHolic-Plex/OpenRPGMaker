// Reproduce and queue the three authored variants; never writes human decisions.
import fs from 'node:fs';import path from 'node:path';
import {DEFAULT_DATA,openStore,queue,packageFor,save,read} from '../../lib/store.mjs';
import {renderDraft} from '../../lib/workflow.mjs';
const args=process.argv.slice(2);if(args.length&&(args.length!==2||args[0]!=='--data'))throw Error('--data PATH only');
const store=openStore(args[1]??DEFAULT_DATA),scratch=fs.mkdtempSync(path.join(store.data,'identity-wave-2-')),items=[];
try{
 for(const role of ['professor','ranger','captain']){
  const bundle=renderDraft(path.join(import.meta.dirname,role),path.join(scratch,role));const id=queue(store,bundle);packageFor(store,id);items.push({role,id});
 }
 const writeWave=(id,label,ids)=>{const target=path.join(store.data,'waves',id+'.json');save(target+'.tmp',{id,label,candidateIds:ids,scope:'Authored identity variants; no automatic approval.'});fs.renameSync(target+'.tmp',target);};
 writeWave('identity-wave-2','새 외형 · 박사 / 레인저 / 선장',items.map(i=>i.id));
 const baseline=path.join(store.data,'waves/full-cast-v1.json');
 if(fs.existsSync(baseline)){
  const old=read(baseline).candidateIds;
  const pairs=items.flatMap(i=>[old.find(id=>id.startsWith(i.role+'-')),i.id].filter(Boolean));
  writeWave('identity-wave-2-compare','이전 안과 비교 · 박사 / 레인저 / 선장',pairs);
 }
 console.log(JSON.stringify({items,data:store.data,autoApproved:0}));
}finally{store.db.close();fs.rmSync(scratch,{recursive:true,force:true});}
