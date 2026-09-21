import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as same} from 'node:util';
import {configFromEnv,loadCurrentJson} from '../supabase-resource-root/supabaseRest.mjs';

// Capture first, then publish immutable snapshots. The source project is never rewritten.
const out='output/evidence/shared-village-curation',sourceProjectId='oprn-hill-forest-harmony-20260918-a4e1';
const config=await configFromEnv(),remote=await loadCurrentJson({...config,projectId:sourceProjectId});
const source=JSON.parse(fs.readFileSync(`${out}/local-before.json`));
const manifest=JSON.parse(fs.readFileSync(`${out}/selection.json`));
const skeleton=JSON.parse(fs.readFileSync('public/assets/region-references/forest-cliff-village.oprn.json'));
const headers={apikey:config.anonKey,Authorization:`Bearer ${config.anonKey}`};
const hash=v=>createHash('sha256').update(v).digest('hex');
function assetsFor(value,found=new Set()){
 if(Array.isArray(value)){for(const x of value)assetsFor(x,found);}
 else if(value&&typeof value==='object'){if(value.type==='uploaded'&&value.id)found.add(value.id);for(const x of Object.values(value))assetsFor(x,found);}
 return found;
}
function destinations(value,found=new Set()){
 if(Array.isArray(value)){for(const x of value)destinations(x,found);}
 else if(value&&typeof value==='object'){if(value.mapId&&source.maps[value.mapId])found.add(value.mapId);for(const x of Object.values(value))destinations(x,found);}
 return found;
}
function embeddedAsset(id){
 const asset=structuredClone(source.assets.uploaded[id]);assert.ok(asset,`Missing uploaded ${id}`);
 if(asset.ref){const bytes=fs.readFileSync(path.join('.oprn-projects',sourceProjectId,'assets',`${asset.ref.sha256}.${asset.ref.extension}`));assert.equal(hash(bytes),asset.ref.sha256);asset.dataUrl=`data:${asset.ref.mime};base64,${bytes.toString('base64')}`;delete asset.ref;}
 assert.ok(asset.dataUrl);return asset;
}
function startFor(m,ts){
 const pass=i=>{const lo=m.lowerTiles[i],up=m.upperTiles[i],lp=ts.passability[lo],upass=ts.passability[up];const eff=up<0?lp:(!upass||!Object.values(upass).some(Boolean))?upass:ts.priority[up]==='upper'?lp:upass;return eff&&Object.values(eff).every(Boolean)&&!m.events.some(e=>e.x===i%m.width&&e.y===Math.floor(i/m.width));};
 const ids=Array.from({length:m.width*m.height},(_,i)=>i).filter(pass).sort((a,b)=>Math.abs(a%m.width-m.width/2)+Math.abs(Math.floor(a/m.width)-m.height/2)-Math.abs(b%m.width-m.width/2)-Math.abs(Math.floor(b/m.width)-m.height/2));
 const i=ids.find(i=>[i-1,i+1,i-m.width,i+m.width].every(j=>j>=0&&j<m.width*m.height&&pass(j)))??ids[0];assert.ok(i!==undefined);return{x:i%m.width,y:Math.floor(i/m.width)};
}
const proof=[],entries=[];
for(const item of manifest){
 const m=source.maps[item.mapId],ts=source.tilesets[m.tilesetId];assert.ok(m&&ts);assert.equal(m.lowerTiles.length,m.width*m.height);assert.equal(m.upperTiles.length,m.width*m.height);
 let p,snapshotProjectId;
 if(item.existing){
  p=JSON.parse(fs.readFileSync(`public/assets/region-references/${item.slug}.oprn.json`));
  snapshotProjectId=item.slug==='high-cliff-village'?'oprn-place-high-cliff-village-v1':`oprn-region-${item.slug}-v1`;
  assert.ok(same(p.maps[item.mapId],m),`Existing map changed: ${item.id}`);assert.ok(same(p.tilesets[ts.id],ts),`Existing tileset changed: ${item.id}`);
 }else{
  p=structuredClone(skeleton);p.meta.title=item.name;p.maps={};p.tilesets={};p.assets.uploaded={};
  const todo=[item.mapId];for(let i=0;i<todo.length;i++){const id=todo[i],map=source.maps[id];p.maps[id]=structuredClone(map);p.tilesets[map.tilesetId]=structuredClone(source.tilesets[map.tilesetId]);for(const d of destinations(map.events))if(!todo.includes(d))todo.push(d);}
  for(const id of assetsFor([p.maps,p.tilesets]))p.assets.uploaded[id]=embeddedAsset(id);
  p.mapTree={mapId:item.mapId,children:todo.slice(1).map(mapId=>({mapId,children:[]}))};p.startMapId=item.mapId;p.startPos=startFor(m,ts);
  snapshotProjectId=`oprn-place-${item.slug}-v1`;
 }
 const query=new URLSearchParams({project_id:`eq.${snapshotProjectId}`,select:'current_json'});
 const check=await fetch(`${config.url}/rest/v1/projects?${query}`,{headers:{...headers,'Accept-Profile':'rpg_zzu'}});assert.ok(check.ok);const rows=await check.json();
 for(const row of rows)assert.ok(same(row.current_json,p),`Use a new snapshot revision: ${snapshotProjectId}`);
 if(!rows.length){const saved=await fetch(`${config.url}/rest/v1/projects?on_conflict=project_id`,{method:'POST',headers:{...headers,'Content-Profile':'rpg_zzu','Content-Type':'application/json',Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({project_id:snapshotProjectId,title:p.meta.title,schema_version:p.version,current_json:p,current_sha256:hash(JSON.stringify(p)),map_count:Object.keys(p.maps).length,tileset_count:Object.keys(p.tilesets).length,terrain_template_count:0})});assert.ok(saved.ok,`Snapshot save failed ${saved.status}`);}
 const reload=await loadCurrentJson({...config,projectId:snapshotProjectId});assert.ok(same(reload,p),`Reload mismatch ${snapshotProjectId}`);
 if(!item.existing){fs.writeFileSync(`src/project/regionReferences/${item.slug}.json`,JSON.stringify({map:m,tileset:ts})+'\n');fs.writeFileSync(`public/assets/region-references/${item.slug}.oprn.json`,JSON.stringify(reload)+'\n');}
 let atlas=`/assets/region-references/${item.slug}-atlas.png`;
 if(ts.image.type==='uploaded'){const asset=reload.assets.uploaded[ts.image.id];const bytes=Buffer.from(asset.dataUrl.split(',')[1],'base64');fs.writeFileSync(`public${atlas}`,bytes);}
 else{atlas='/assets/easyrpg-chipset-dungeon-transparent.png';assert.ok(fs.existsSync(`public${atlas}`));}
 entries.push({...item,width:m.width,height:m.height,tilesetId:ts.id,sourceProjectId,snapshotProjectId,tilesetPreview:atlas});
 proof.push({id:item.id,mapId:item.mapId,snapshotProjectId,saved:true,reloaded:true,exactMap:same(reload.maps[item.mapId],m),mapCount:Object.keys(reload.maps).length,sha256:hash(JSON.stringify(reload))});console.log(JSON.stringify(proof.at(-1)));
}
assert.ok(same((await loadCurrentJson({...config,projectId:sourceProjectId})).maps,remote.maps),'Source maps changed during publication');
fs.writeFileSync(`${out}/entries.json`,JSON.stringify(entries,null,2));fs.writeFileSync(`${out}/persistence.json`,JSON.stringify({sourceProjectId,sourceMapsUnchanged:true,places:proof},null,2));
