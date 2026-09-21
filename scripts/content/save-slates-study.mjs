// Explicit content update with optimistic concurrency. No credentials are written to evidence.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {parseEnv} from '../lib/supabase-database-ops.mjs';
const dir='verify-shots/slates-study';
const project=JSON.parse(await readFile(`${dir}/project.json`,'utf8'));
const source=JSON.parse(await readFile('output/slates-study/source-row.json','utf8'));
const expected=Array.isArray(source)?source[0]:source;
const id='rpg-zzu-slates32-38e6';
if(expected.project_id!==id||!expected.current_sha256)throw Error('Missing source revision');
if(project.spatialAuthoring)throw Error('Use spatial publication API for canonical projects');
const env=parseEnv(await readFile('.env.local','utf8'));
const base=env.VITE_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/';
const headers={apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json'};
async function request(path,method='GET',body){
 const r=await fetch(base+path,{method,headers:{...headers,Prefer:method==='POST'?'return=representation,resolution=merge-duplicates':'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 if(!r.ok)throw Error(`${path.split('?')[0]}: ${r.status}`);return r.json();
}
const sha=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const [current]=await request(`projects?project_id=eq.${id}&select=current_json,current_sha256`);
if(!current)throw Error('Source project not found');
if(!isDeepStrictEqual(current.current_json,project)){
 if(current.current_sha256!==expected.current_sha256)throw Error('Remote project changed; reload before merging');
 const updated=await request(`projects?project_id=eq.${id}&current_sha256=eq.${expected.current_sha256}`,'PATCH',{
 title:project.meta.title,schema_version:project.version,current_json:project,current_sha256:sha(project),map_count:Object.keys(project.maps).length,tileset_count:Object.keys(project.tilesets).length,updated_at:new Date().toISOString(),
 });
 if(updated.length!==1)throw Error('Concurrent update; root was not saved');
}
await request('maps','POST',Object.values(project.maps).map(m=>({project_id:id,map_id:m.id,name:m.name,width:m.width,height:m.height,tileset_id:m.tilesetId,lower_sha256:sha(m.lowerTiles),upper_sha256:sha(m.upperTiles),lower_tile_count:m.lowerTiles.length,upper_tile_count:m.upperTiles.length,map_json:m})));
await request('tilesets','POST',Object.values(project.tilesets).map(t=>({project_id:id,tileset_id:t.id,name:t.name,tile_count:t.count,tileset_json:t})));
const [saved]=await request(`projects?project_id=eq.${id}&select=current_json,current_sha256`);
const maps=await request(`maps?project_id=eq.${id}&select=map_id,map_json`);
const tilesets=await request(`tilesets?project_id=eq.${id}&select=tileset_id,tileset_json`);
if(!isDeepStrictEqual(saved.current_json,project))throw Error('Reloaded root differs');
if(maps.length!==Object.keys(project.maps).length||maps.some(r=>!isDeepStrictEqual(r.map_json,project.maps[r.map_id])))throw Error('Map mirrors differ');
if(tilesets.length!==Object.keys(project.tilesets).length||tilesets.some(r=>!isDeepStrictEqual(r.tileset_json,project.tilesets[r.tileset_id])))throw Error('Tileset mirrors differ');
await writeFile(`${dir}/reloaded-project.json`,JSON.stringify(saved.current_json));
const receipt={projectId:id,saved:true,reloadedEqual:true,mapMirrorsEqual:true,tilesetMirrorsEqual:true,maps:maps.map(r=>r.map_id),tileSize:32,sha256:saved.current_sha256};
await writeFile(`${dir}/persistence.json`,JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
