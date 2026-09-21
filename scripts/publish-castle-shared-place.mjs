import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {loadEnv} from 'vite';
const root='output/castle-shared-place',p=JSON.parse(fs.readFileSync(root+'/sqlite-reloaded.json'));assert.deepEqual(p.maps,JSON.parse(fs.readFileSync(root+'/project.json')).maps);
const e=loadEnv('development',process.cwd(),''),key=e.VITE_SUPABASE_ANON_KEY;assert(key&&e.VITE_SUPABASE_URL);
const headers={apikey:key,Authorization:'Bearer '+key,'Accept-Profile':'rpg_zzu','Content-Profile':'rpg_zzu','Content-Type':'application/json',Prefer:'return=representation'};
const endpoint=e.VITE_SUPABASE_URL+'/rest/v1/projects',hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const sourceId='castle-fortress-city-20260921',snapshotId='oprn-place-river-fortress-v1';
const old=JSON.parse(fs.readFileSync(root+'/remote-before.json'))[0].current_sha256;
const r=await fetch(endpoint+'?project_id=eq.'+sourceId+'&current_sha256=eq.'+old,{method:'PATCH',headers,body:JSON.stringify({current_json:p,current_sha256:hash(p)})});assert.equal(r.status,200);assert.equal((await r.json()).length,1);
async function read(id){const r=await fetch(endpoint+'?project_id=eq.'+id+'&select=current_json',{headers});assert.equal(r.status,200);return(await r.json())[0]?.current_json;}
assert.deepEqual(await read(sourceId),p);
const shared=structuredClone(p),m=shared.maps['grand-river-fortress'],ts=shared.tilesets[m.tilesetId];
shared.meta.title='강변 성채';shared.maps={[m.id]:m};shared.tilesets={[ts.id]:ts};shared.mapTree={mapId:m.id,children:[]};shared.startMapId=m.id;
const exists=await read(snapshotId);if(exists)assert.deepEqual(exists,shared);else{const r=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify({project_id:snapshotId,title:shared.meta.title,schema_version:shared.version,current_json:shared,current_sha256:hash(shared),map_count:1,tileset_count:1,terrain_template_count:0})});assert(r.ok,'snapshot save '+r.status);}
assert.deepEqual(await read(snapshotId),shared);
fs.writeFileSync('public/assets/region-references/river-fortress.oprn.json',JSON.stringify(shared));
fs.writeFileSync('public/assets/region-references/river-fortress-atlas.png',Buffer.from(shared.assets.uploaded[ts.image.id].dataUrl.split(',')[1],'base64'));
fs.copyFileSync(root+'/map.png','public/assets/region-references/river-fortress.png');
fs.writeFileSync('src/project/regionReferences/river-fortress.json',JSON.stringify({map:m,tileset:ts}));
fs.writeFileSync(root+'/publication-proof.json',JSON.stringify({sourceProjectId:sourceId,snapshotProjectId:snapshotId,sourceReloadEqual:true,snapshotReloadEqual:true,sha256:hash(shared),mapId:m.id,width:m.width,height:m.height},null,2));
console.log('Source and shared snapshot saved and reloaded: '+snapshotId);
