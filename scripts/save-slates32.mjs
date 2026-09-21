// Creates a separate legacy Supabase project, then verifies the saved document.
// Credentials are read privately from .env.local; existing different content is never overwritten.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {parseEnv} from './lib/supabase-database-ops.mjs';
const env=parseEnv(await readFile('.env.local','utf8'));
const id='rpg-zzu-slates32-38e6';
const project=JSON.parse(await readFile('verify-shots/slates32/project.json','utf8'));
if(project.spatialAuthoring)throw Error('Canonical projects require the spatial publication API.');
const base=env.VITE_SUPABASE_URL.replace(/\/$/,'')+'/rest/v1/';
const headers={apikey:env.VITE_SUPABASE_ANON_KEY,Authorization:'Bearer '+env.VITE_SUPABASE_ANON_KEY,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json'};
async function request(path,body,merge=false){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...headers,...(body?{Prefer:merge?'return=representation,resolution=merge-duplicates':'return=representation'}:{})},...(body?{body:JSON.stringify(body)}:{})});if(!r.ok)throw Error(`${path.split('?')[0]}: ${r.status} ${await r.text()}`);return r.json();}
const sha=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const existing=await request(`projects?project_id=eq.${id}&select=current_json`);
if(existing.length && !isDeepStrictEqual(existing[0].current_json,project))throw Error('Target already contains different content; not overwritten.');
if(!existing.length)await request('projects',{
 project_id:id,title:project.meta.title,schema_version:project.version,current_json:project,current_sha256:sha(project),map_count:Object.keys(project.maps).length,tileset_count:Object.keys(project.tilesets).length,terrain_template_count:0,
});
await request('maps',Object.values(project.maps).map(map=>({project_id:id,map_id:map.id,name:map.name,width:map.width,height:map.height,tileset_id:map.tilesetId,lower_sha256:sha(map.lowerTiles),upper_sha256:sha(map.upperTiles),lower_tile_count:map.lowerTiles.length,upper_tile_count:map.upperTiles.length,map_json:map})),true);
await request('tilesets',Object.values(project.tilesets).map(ts=>({project_id:id,tileset_id:ts.id,name:ts.name,tile_count:ts.count,tileset_json:ts})),true);
const [row]=await request(`projects?project_id=eq.${id}&select=project_id,current_json,current_sha256`);
if(!isDeepStrictEqual(row.current_json,project))throw Error('Reloaded root differs.');
const maps=await request(`maps?project_id=eq.${id}&select=map_json`);
if(maps.length!==1||!isDeepStrictEqual(maps[0].map_json,project.maps.slates_grove))throw Error('Reloaded map differs.');
const tilesets=await request(`tilesets?project_id=eq.${id}&select=tileset_json`);
if(tilesets.length!==1||!isDeepStrictEqual(tilesets[0].tileset_json,project.tilesets.slates_32))throw Error('Reloaded tileset differs.');
await writeFile('verify-shots/slates32/reloaded-project.json',JSON.stringify(row.current_json));
const receipt={projectId:id,saved:true,reloadedEqual:true,mapMirrorEqual:true,tilesetMirrorEqual:true,tileSize:row.current_json.maps.slates_grove.tileSize,sha256:row.current_sha256};
await writeFile('verify-shots/slates32/persistence.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
