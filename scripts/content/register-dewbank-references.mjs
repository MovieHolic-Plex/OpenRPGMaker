// Reference-only registration. Offline folders must have no running host.
// For live projects use --host URL --project-id ID (SQLite service + SHA CAS).
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {withTsModule} from '../ontology-ts-loader.mjs';
const category=JSON.parse(fs.readFileSync('src/assets/forestHarmonyTileset.json')).referenceDocuments.find(c=>c.id==='dewbank-village-v1');
const dirs=[];let host,projectId,allHostProjects=false;const args=process.argv.slice(2);
for(let i=0;i<args.length;i++){const flag=args[i];if(flag==='--all-host-projects'){allHostProjects=true;continue;}const value=args[++i];if(!value)throw Error('Missing argument');if(flag==='--project-dir')dirs.push(path.resolve(value));else if(flag==='--host')host=value;else if(flag==='--project-id')projectId=value;else throw Error('Unknown flag: '+flag);}
if((projectId||allHostProjects)&&!host)throw Error('--host is required');
if(projectId&&allHostProjects)throw Error('Choose --project-id or --all-host-projects');
function register(p){const ids=[];for(const t of Object.values(p.tilesets??{})){
 if(t.image?.type!=='bundled'||!['tex_forest_harmony','tex_shared_forest_village_objects'].includes(t.image.id)||t.referenceSourceTilesetId)continue;
 if(t.referenceDocuments?.some(c=>c.id===category.id))continue; // Preserve user-authored categories.
 t.referenceDocuments=[...(t.referenceDocuments??[]),structuredClone(category)];ids.push(t.id);
}return ids;}
function verify(before,after,ids){assert.deepEqual(after.maps,before.maps,'Reference registration changed maps');for(const id of ids)assert.deepEqual(after.tilesets[id].referenceDocuments.find(c=>c.id===category.id),category);}
const receipt={category:category.id,documents:category.documents.length,images:category.images.length,downloads:[],projects:[]};
await withTsModule('src/project/tilesetReferences.ts','dewbank-reference-schema.mjs',api=>api.validateTilesetReferences([category]));
for(const name of fs.readdirSync('public/assets/region-references').filter(n=>n.endsWith('.oprn.json'))){const file=path.join('public/assets/region-references',name),p=JSON.parse(fs.readFileSync(file)),before=structuredClone(p),ids=register(p);if(ids.length){fs.writeFileSync(file,JSON.stringify(p));verify(before,JSON.parse(fs.readFileSync(file)),ids);receipt.downloads.push({file,tilesetIds:ids,reloaded:true,mapsUnchanged:true});}}
await withTsModule('electron/local-store/store.ts','dewbank-registration-store.mjs',async api=>{
 for(const dir of dirs){let s=await api.openLocalProjectStore({projectDir:dir});let before,ids,revision,id;
  try{const loaded=s.loadSnapshot();before=loaded.project;const p=structuredClone(before);ids=register(p);id=s.info().projectId;if(ids.length){s.backup();const result=await s.saveSerialized(JSON.stringify(p),loaded.sha256);assert.equal(result.kind,'saved','Concurrent save; do not overwrite');revision=result.revision;}}finally{s.close();}
  s=await api.openLocalProjectStore({projectDir:dir});try{verify(before,s.loadSnapshot().project,ids);receipt.projects.push({projectId:id,projectDir:dir,storage:'SQLite',saved:ids.length>0,reopened:true,revision,tilesetIds:ids,mapsUnchanged:true});}finally{s.close();}
 }
});
if(host){const html=await(await fetch(host)).text(),match=html.match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/);assert(match,'Host bridge missing');const config=JSON.parse(match[1]),session=randomUUID();
 const call=async(channel,payload)=>{const r=await fetch(new URL(config.endpoint,host),{method:'POST',headers:{'content-type':'application/json','x-oprn-bridge-token':config.token,'x-oprn-session':session,...(projectId?{'x-oprn-project':projectId}:{})},body:JSON.stringify({channel,payload})});if(!r.ok)throw Error('Host status '+r.status);return r.json();};
 const hostIds=allHostProjects?[null,...(await call('oprn:start.recentProjects')).map(p=>p.projectDir)]:[projectId];
 for(const hostId of hostIds){projectId=hostId;
 const status=await call('oprn:project.status'),before=await call('oprn:project.load'),p=JSON.parse(before.serialized),original=structuredClone(p),ids=register(p);let saved;
 if(ids.length){saved=await call('oprn:project.save',{projectDir:status.projectDir,serialized:JSON.stringify(p),expectedSha:before.sha256});assert.equal(saved.kind,'saved','Concurrent host save; do not overwrite');}
 const after=await call('oprn:project.load');verify(original,JSON.parse(after.serialized),ids);receipt.projects.push({host,projectId,sqliteProjectId:status.projectId,storage:'SQLite host API',saved:ids.length>0,reopened:true,revision:after.revision,tilesetIds:ids,mapsUnchanged:true});
 }
}
const out='output/evidence/dewbank-public-references';fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/registration-'+Date.now()+'.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2));
