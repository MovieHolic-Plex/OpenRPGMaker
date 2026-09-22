// Two isolated authored opening examples. Save to Supabase, reload and verify before recording.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
import {createBlankProject} from '../../src/project/defaults/blankProject';
import {serialize,deserialize} from '../../src/project/io';
import {STARTER_TITLE_BGM_ID} from '../../src/assets/bgmStarterTracks';
const env=loadEnv('development',process.cwd(),'');
const url=env.VITE_SUPABASE_URL?.replace(/\/$/,'');
const key=env.VITE_SUPABASE_ANON_KEY;
if(!url||!key)throw new Error('Supabase configuration required');
const headers={apikey:key,Authorization:'Bearer '+key,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json'};
const out='verify-shots/opening-examples';await mkdir(out,{recursive:true});
const specs=[
 {id:'oprn-opening-winter-1126',theme:'winter',title:'눈이 녹으면',narration:['겨울은 이 골짜기를 떠나지 않았다.','마지막 등불 아래, 한 통의 편지가 도착했다.','얼음 신전 깊은 곳에서 봄의 노래가 들려왔다.','이제, 잃어버린 계절을 되찾으러 간다.']},
 {id:'oprn-opening-ocean-1126',theme:'ocean',title:'파도 아래의 약속',narration:['사라진 왕국의 이야기는 파도에 남아 있었다.','산호 문 너머로, 오래된 길이 모습을 드러냈다.','잠든 궁전 한가운데 진주가 다시 빛났다.','우리는 그 약속을 세상으로 가져오기로 했다.']},
];
const receipts=[];
for(const spec of specs){
 const p=createBlankProject();p.meta.title=spec.title;p.system.playResolution={width:640,height:360};
 p.system.titleScreen={...p.system.titleScreen,backgroundResourceId:'oprn-pack-still-'+spec.theme+'-01'};
 p.system.opening={enabled:true,skippable:true,musicResourceId:STARTER_TITLE_BGM_ID,scenes:spec.narration.map((n,i)=>({id:spec.theme+'-'+i,kind:'image',resourceId:'oprn-pack-still-'+spec.theme+'-'+String(i+1).padStart(2,'0'),narration:n,durationMs:4200,motion:i%2===0?'zoom':'pan'}))};
 p.system.opening.scenes.push({id:'title',kind:'text',narration:'— '+spec.title+' —',durationMs:2500});
 const wire=serialize(p);deserialize(wire);
 const existing=await fetch(url+'/rest/v1/projects?project_id=eq.'+spec.id+'&select=title',{headers});
 if(!existing.ok)throw new Error('DB read failed: '+existing.status);
 const rows=await existing.json();if(rows.length && rows[0].title!==spec.title)throw new Error('Existing project title differs: '+spec.id);
 const row={project_id:spec.id,title:spec.title,schema_version:p.version,current_json:JSON.parse(wire),current_sha256:createHash('sha256').update(wire).digest('hex'),map_count:Object.keys(p.maps).length,tileset_count:Object.keys(p.tilesets).length,terrain_template_count:0};
 const saved=await fetch(url+'/rest/v1/projects?on_conflict=project_id',{method:'POST',headers:{...headers,Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row)});
 if(!saved.ok)throw new Error('DB save failed: '+saved.status+' '+(await saved.text()).slice(0,200));
 const loaded=await fetch(url+'/rest/v1/projects?project_id=eq.'+spec.id+'&select=current_json,current_sha256',{headers});
 if(!loaded.ok)throw new Error('DB reload failed: '+loaded.status);
 const [record]=await loaded.json();const restored=deserialize(JSON.stringify(record.current_json));
 if(!isDeepStrictEqual(restored.system.opening,deserialize(wire).system.opening)||record.current_sha256!==row.current_sha256)throw new Error('Remote roundtrip differs');
 await writeFile(out+'/'+spec.theme+'.json',serialize(restored));
 receipts.push({projectId:spec.id,title:spec.title,savedStatus:saved.status,reloaded:true,sha256:row.current_sha256});
 console.log('SAVED_AND_RELOADED',spec.id);
}
await writeFile(out+'/persistence.json',JSON.stringify(receipts,null,2)+'\n');
