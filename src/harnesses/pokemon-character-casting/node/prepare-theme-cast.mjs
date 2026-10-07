import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT,queue,THEME_ROLES,packageFor} from './store.mjs';

// Desert / snow / coast townsfolk and route trainers as template edits. Queues only; publishes the
// wave manifest atomically after all nine packages verify. It never withdraws other collections and
// never touches decisions, so full-cast-v1 and every earlier vote stay as they are.
export function prepareThemeCast(store,{wave='theme-cast-v1'}={}){
 if(!/^[a-z0-9-]+$/.test(wave))throw Error('잘못된 묶음 이름');
 const directory=path.join(ROOT,'harness-data/pokemon-character-casting/templates',wave);
 const rendered=spawnSync('python3',[path.join(import.meta.dirname,'author-theme-cast.py'),'--wave',wave,'--render'],{cwd:ROOT,encoding:'utf8',maxBuffer:4*1024*1024});
 if(rendered.status!==0)throw Error('테마 캐릭터 부분 수정 실패: '+rendered.stdout+rendered.stderr);
 const manifest=JSON.parse(fs.readFileSync(path.join(directory,'manifest.json'),'utf8'));
 if(manifest.errors.length)throw Error('완성되지 않은 테마 캐릭터가 있습니다');
 const roles=manifest.items.map(item=>item.role);
 if(roles.length!==THEME_ROLES.length||new Set(roles).size!==roles.length||THEME_ROLES.some(role=>!roles.includes(role)))throw Error('테마 9역할이 모두 한 번씩 필요합니다');
 const ids=new Map(manifest.items.map(item=>[item.role,queue(store,path.resolve(ROOT,item.bundle))]));
 const candidateIds=THEME_ROLES.map(role=>ids.get(role));
 for(const id of candidateIds){const {pack}=packageFor(store,id);if(pack.collection!==wave||!pack.templateId)throw Error('묶음·판형 정보가 다릅니다: '+id);}
 const record={id:wave,label:manifest.label,candidateIds,themes:Object.fromEntries(manifest.items.map(item=>[item.role,item.theme])),scope:manifest.scope};
 const waves=path.join(store.data,'waves');fs.mkdirSync(waves,{recursive:true});
 const target=path.join(waves,wave+'.json'),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(record,null,2)+'\n');fs.renameSync(temp,target);
 return {wave,roles:candidateIds.length,poses:candidateIds.length*12,candidateIds,autoApproved:0,data:store.data};
}
