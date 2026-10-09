import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,queue,ROLES,packageFor} from './store.mjs';

export function prepareCast(store){
 const directory=path.join(ROOT,'harness-data/pokemon-character-casting/templates/full-cast-v1');
 const rendered=spawnSync('python3',[path.join(import.meta.dirname,'author-cast-wave.py'),'--render'],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
 if(rendered.status!==0)throw Error('캐릭터 부분 수정 실패: '+rendered.stdout+rendered.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 if(manifest.errors.length)throw Error('완성되지 않은 캐릭터가 있습니다');
 const ids=new Map(manifest.items.map(item=>[item.role,queue(store,item.bundle)]));
 ids.set('explorer',queue(store,path.join(ROOT,'harness-data/pokemon-character-casting/templates/naru-camper-v2')));
 if(ids.size!==16||ROLES.some(role=>!ids.has(role)))throw Error('16역할이 모두 필요합니다');
 const candidateIds=ROLES.map(role=>ids.get(role));
 for(const id of candidateIds)packageFor(store,id);
 const wave={id:'full-cast-v1',label:'전체 캐릭터 · 16역할',candidateIds,scope:'Walking only, 16roles/192poses; 15 new derivatives + existing Naru v2. No automatic approval.'};
 const waves=path.join(store.data,'waves');fs.mkdirSync(waves,{recursive:true});
 const target=path.join(waves,wave.id+'.json'),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(wave,null,2)+'\n');fs.renameSync(temp,target);
 return {wave:wave.id,roles:ids.size,poses:192,candidateIds,autoApproved:0,data:store.data};
}
