import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {loadEnv} from 'vite';
const root='output/castle-scenes';fs.mkdirSync(root,{recursive:true});
const env=loadEnv('development',process.cwd(),'');assert(env.VITE_SUPABASE_URL&&env.VITE_SUPABASE_ANON_KEY);
const headers={apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json',Prefer:'return=representation'};
const endpoint=env.VITE_SUPABASE_URL+'/rest/v1/projects';
async function read(id){const r=await fetch(endpoint+'?project_id=eq.'+id+'&select=current_json',{headers});assert.equal(r.status,200);return(await r.json())[0]?.current_json;}
const source=JSON.parse(fs.readFileSync('public/assets/region-references/river-fortress.oprn.json'));assert.deepEqual(await read('oprn-place-river-fortress-v1'),source);
const sha=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');
const definitions=[
 {id:'castle-courtyard',name:'고목·분수 뒤뜰',rect:[28,28,64,36],start:[40,45],rules:['고목과 분수, 노점, 포장과 녹지를 함께 구성한 성채 뒤뜰.','상인과 안내인, 정원사의 대화를 포함한다.']},
 {id:'castle-small-harbor',name:'나룻배 두 척과 작은 선착장',rect:[90,42,36,22],start:[96,55],rules:['두 척의 배와 목제 선착장, 화물 소품을 묶은 작은 나루.','나루 관리인의 대화를 포함한다. 승선 기능은 없다.']},
 {id:'castle-stone-lodge',name:'석조 관리소와 진입길',rect:[26,124,46,20],start:[54,136],rules:['사용자가 선택한 개선1의 석조 건물과 정돈된 진입길.','남문 안내인과 가로등, 수목을 포함한다. 건물 실내는 없다.']},
];
const proof=[];
for(const d of definitions){
 const p=structuredClone(source),original=p.maps['grand-river-fortress'],m=structuredClone(original),[x,y,w,h]=d.rect;
 m.id=d.id;m.name=d.name;m.width=w;m.height=h;
 for(const layer of ['lowerTiles','upperTiles'])m[layer]=Array.from({length:h},(_,r)=>original[layer].slice((y+r)*original.width+x,(y+r)*original.width+x+w)).flat();
 m.events=original.events.filter(e=>e.x>=x&&e.x<x+w&&e.y>=y&&e.y<y+h).map(e=>({...e,x:e.x-x,y:e.y-y}));
 if(d.id==='castle-stone-lodge')m.events[0].pages[0].commands[0].body='어서 오세요. 이곳은 성채 남문 앞 석조 관리소입니다.';
 m.locations=[{id:d.id,name:d.name,x:0,y:0,w,h,tags:['공용 장소','강변 성채']}];
 p.maps={[m.id]:m};p.mapTree={mapId:m.id,children:[]};p.startMapId=m.id;p.startPos={x:d.start[0]-x,y:d.start[1]-y};p.meta.title=d.name;
 const snapshotId='oprn-place-'+d.id+'-v1',existing=await read(snapshotId);
 let equal=false;if(existing){try{assert.deepEqual(existing,p);equal=true;}catch{}}
 if(existing&&!equal){const previous=JSON.parse(fs.readFileSync(root+'/publication-proof.json')).places.find(v=>v.snapshotId===snapshotId);assert.deepEqual(existing,JSON.parse(fs.readFileSync('public/assets/region-references/'+d.id+'.oprn.json')));const r=await fetch(endpoint+'?project_id=eq.'+snapshotId+'&current_sha256=eq.'+previous.sha256,{method:'PATCH',headers,body:JSON.stringify({current_json:p,current_sha256:sha(p)})});assert(r.ok);assert.equal((await r.json()).length,1);}else if(!existing){const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({project_id:snapshotId,title:d.name,schema_version:p.version,current_json:p,current_sha256:sha(p),map_count:1,tileset_count:1,terrain_template_count:0})});assert(r.ok,'Save failed '+r.status);}
 assert.deepEqual(await read(snapshotId),p);
 fs.writeFileSync('public/assets/region-references/'+d.id+'.oprn.json',JSON.stringify(p));
 fs.writeFileSync('src/project/regionReferences/'+d.id+'.json',JSON.stringify({map:m,tileset:p.tilesets[m.tilesetId]}));
 proof.push({...d,snapshotId,reloadEqual:true,sha256:sha(p),npcCount:m.events.length});
}
assert.deepEqual(await read('oprn-place-river-fortress-v1'),source);
fs.writeFileSync(root+'/publication-proof.json',JSON.stringify({sourceUnchanged:true,places:proof},null,2));console.log(proof.map(p=>p.snapshotId+' saved and reloaded').join('\n'));
