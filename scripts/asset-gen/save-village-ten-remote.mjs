import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { configFromEnv, loadCurrentJson } from '../supabase-resource-root/supabaseRest.mjs';

const out='output/evidence/village-ten';
const projectId='oprn-hill-forest-harmony-20260918-a4e1', mapId='map_cliff_forest_bridge';
const local=JSON.parse(fs.readFileSync(out+'/editor-saved-project.json'));
const plans=JSON.parse(fs.readFileSync(out+'/plans.json'));assert.equal(JSON.parse(fs.readFileSync(out+'/reload-proof.json')).reloaded,true);
const c={...await configFromEnv(),projectId};
const headers={apikey:c.anonKey,Authorization:`Bearer ${c.anonKey}`};
const q=new URLSearchParams({project_id:`eq.${projectId}`,select:'current_json,current_sha256'});
const response=await fetch(`${c.url}/rest/v1/projects?${q}`,{headers:{...headers,'Accept-Profile':'rpg_zzu'}});
assert.ok(response.ok);const [row]=await response.json(),p=row.current_json,before=structuredClone(p);
for(const plan of plans){const id=plan.map.id;assert.equal(p.maps[id],undefined,'Map already exists');const map=local.maps[id];assert.deepEqual(p.tilesets[map.tilesetId],local.tilesets[map.tilesetId]);p.maps[id]=map;p.mapTree.children.push({mapId:id,children:[]});}
const sha=createHash('sha256').update(JSON.stringify(p)).digest('hex');
const match=new URLSearchParams({project_id:`eq.${projectId}`,current_sha256:`eq.${row.current_sha256}`});
const saved=await fetch(`${c.url}/rest/v1/projects?${match}`,{method:'PATCH',headers:{...headers,'Content-Profile':'rpg_zzu','Content-Type':'application/json',Prefer:'return=representation'},body:JSON.stringify({current_json:p,current_sha256:sha,map_count:Object.keys(p.maps).length,tileset_count:Object.keys(p.tilesets).length})});
assert.ok(saved.ok,`Save status ${saved.status}`);assert.equal((await saved.json()).length,1,'Concurrent change; nothing replaced');
const reloaded=await loadCurrentJson(c);
for(const plan of plans)assert.deepEqual(reloaded.maps[plan.map.id],local.maps[plan.map.id]);
for(const[id,m]of Object.entries(before.maps))assert.deepEqual(reloaded.maps[id],m);
for(const[id,t]of Object.entries(before.tilesets))assert.deepEqual(reloaded.tilesets[id],t);
assert.deepEqual(reloaded.assets,before.assets);
fs.writeFileSync(out+'/remote-reloaded.json',JSON.stringify(reloaded));
const proof={projectId,mapIds:plans.map(p=>p.map.id),saved:true,reloaded:true,otherMapsUnchanged:true,existingTilesetsUnchanged:true,sha256:sha};fs.writeFileSync(out+'/remote-proof.json',JSON.stringify(proof,null,2));console.log(JSON.stringify(proof));
