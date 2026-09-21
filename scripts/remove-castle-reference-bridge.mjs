/** Remove the bridge's 16px cells from the reference atlas and its saved boards. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PNG } from 'pngjs';
import { loadEnv } from 'vite';
const env = loadEnv('development', process.cwd(), '');
const projectId = env.VITE_SUPABASE_PROJECT_ID;
const origin = env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const key = env.VITE_SUPABASE_ANON_KEY;
assert(projectId && origin && key, 'Existing project connection required');
const headers = {apikey:key,Authorization:`Bearer ${key}`,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json'};
const url = `${origin}/rest/v1/projects?project_id=eq.${encodeURIComponent(projectId)}&select=current_json,current_sha256`;
async function request(url,options={}) {const r=await fetch(url,{headers,...options});if(!r.ok)throw Error(`HTTP ${r.status}: ${await r.text()}`);return r.json();}
const row=(await request(url))[0]; assert(row?.current_json);
const project=structuredClone(row.current_json);
const path='public/assets/opengameart-castle-reference-composite.png';
const original=fs.readFileSync(path); const atlas=PNG.sync.read(original);
assert.equal(atlas.width,2240);assert.equal(atlas.height,2240);
// Atlas is a 140x140 board, one 16px cell per map cell. Includes both parapets,
// the deck, arch and piers. Replace their cells with existing river-water cells.
const rect={x:102,y:107,w:30,h:28};
const water={x:110,y:96,w:2,h:2};
for(let ty=rect.y;ty<rect.y+rect.h;ty++) for(let tx=rect.x;tx<rect.x+rect.w;tx++)
 for(let y=0;y<16;y++) for(let x=0;x<16;x++) {
  const from=((water.y*16+(ty%2)*16+y)*atlas.width+water.x*16+(tx%2)*16+x)*4;
  const to=((ty*16+y)*atlas.width+tx*16+x)*4;
  atlas.data.copy(atlas.data,to,from,from+4);
 }
const clean=PNG.sync.write(atlas,{colorType:2,deflateLevel:9,deflateStrategy:0});
const affected=Object.values(project.maps).filter(m=>m.tilesetId==='opengameart_castle_reference');
assert(affected.length>0,'No matching boards in target project');
const tileset=project.tilesets.opengameart_castle_reference;
const oldImage=tileset.image;
function remap(tile) {
 const x=tile%140,y=Math.floor(tile/140);
 return x>=rect.x && x<rect.x+rect.w && y>=rect.y && y<rect.y+rect.h
  ? (water.y+y%2)*140+water.x+x%2 : tile;
}
for(const map of affected) {
 for(const layer of ['lowerTiles','upperTiles'])map[layer]=map[layer].map(remap);
 for(const values of Object.values(map.upperTileStacks??{})) for(let i=0;i<values.length;i++)values[i]=remap(values[i]);
}
tileset.name='성채 참고 이미지 · 큰 돌다리 제거';
const replacedInlineCopies=0;
const dir='/tmp/castle-bridge-removal';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(`${dir}/preview.png`,clean);
fs.writeFileSync(`${dir}/pending-project.json`,JSON.stringify(project));
const report={projectId,rect,water,affectedMaps:affected.map(m=>m.id),oldImage,replacedInlineCopies,atlasSha256:crypto.createHash('sha256').update(clean).digest('hex')};
if(!process.argv.includes('--apply')) { console.log(JSON.stringify({...report,preview:true},null,2));process.exit(0); }
// Keep private recovery copies out of public/export paths.
fs.writeFileSync(`${dir}/before-project.json`,JSON.stringify(row.current_json));
fs.writeFileSync(`${dir}/before-atlas.png`,original);
const published=await request(`${origin}/rest/v1/rpc/publish_spatial_project`,{method:'POST',body:JSON.stringify({p_project_id:projectId,p_expected_sha256:row.current_sha256,p_project:project,p_operation:'update'})});
const sha=published.sha256??published[0]?.sha256;assert(sha);
await request(`${origin}/rest/v1/rpc/sync_spatial_mirrors`,{method:'POST',body:JSON.stringify({p_project_id:projectId,p_expected_sha256:sha})});
const after=(await request(url))[0];
assert.deepEqual(after.current_json.maps,project.maps);
for(const [id,map] of Object.entries(row.current_json.maps)) {
 if(!affected.some(m=>m.id===id))assert.deepEqual(after.current_json.maps[id],map,'Unrelated map must remain untouched');
}
fs.writeFileSync(path,clean);
fs.writeFileSync(`${dir}/reloaded-project.json`,JSON.stringify(after.current_json));
fs.writeFileSync(`${dir}/proof.json`,JSON.stringify({...report,saved:true,reloaded:true,sha256:after.current_sha256,unrelatedMapsUnchanged:true},null,2));
console.log(fs.readFileSync(`${dir}/proof.json`,'utf8'));
