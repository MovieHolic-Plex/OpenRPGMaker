// Reference-only update through the running SQLite host service with SHA concurrency check.
import fs from 'node:fs';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {isDeepStrictEqual} from 'node:util';
const out='output/castle-executable-guide',host='http://mdc-server:9888',projectId='castle-fortress-city-20260921';
const category=JSON.parse(fs.readFileSync('tiledata/castle-tiles-rpgs/executable/category.json'));
const html=await(await fetch(host)).text(),match=html.match(/window\.__OPRN_BRIDGE__=(.*?)<\/script>/);assert(match);const config=JSON.parse(match[1]),session=randomUUID();
async function call(channel,payload){const r=await fetch(new URL(config.endpoint,host),{method:'POST',headers:{'content-type':'application/json','x-oprn-bridge-token':config.token,'x-oprn-session':session,'x-oprn-project':projectId},body:JSON.stringify({channel,payload})});if(!r.ok)throw Error(`Host ${channel}: ${r.status}`);return r.json();}
const status=await call('oprn:project.status'),before=await call('oprn:project.load');assert(before?.serialized);
const p=JSON.parse(before.serialized),maps=structuredClone(p.maps);
for(const id of ['opengameart_castle','forest_harmony']){const t=p.tilesets[id];assert(t&&!t.referenceSourceTilesetId);t.referenceDocuments=[...(t.referenceDocuments??[]).filter(c=>c.id!==category.id),category];}
const saved=await call('oprn:project.save',{projectDir:status.projectDir,serialized:JSON.stringify(p),expectedSha:before.sha256});assert.equal(saved.kind,'saved','Host save conflict; do not overwrite another editor');
const after=await call('oprn:project.load'),loaded=JSON.parse(after.serialized);assert.ok(isDeepStrictEqual(loaded.maps,maps),'Maps changed');for(const id of ['opengameart_castle','forest_harmony'])assert.ok(isDeepStrictEqual(loaded.tilesets[id].referenceDocuments.find(c=>c.id===category.id),category),'Reference reload differs');
fs.writeFileSync(out+'/host-reloaded.json',JSON.stringify(loaded));fs.writeFileSync(out+'/host-persistence.json',JSON.stringify({host,projectId,sqliteProjectId:status.projectId,saved:true,reloaded:true,mapsUnchanged:true,revision:after.revision,category:category.id,documents:category.documents.length,images:category.images.length},null,2));console.log('Host saved and reloaded references; maps unchanged');
