// Refresh metadata only in the user's installed PAW library and canonical host.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withTsModule} from '../ontology-ts-loader.mjs';
import {connectHostBridge} from '../lib/hostBridgeClient.mjs';
const [host,out]=process.argv.slice(2);
if(!host||!out||!['localhost','127.0.0.1','[::1]'].includes(new URL(host).hostname))throw Error('Usage: <local canonical host URL> <private evidence directory>');
await fs.mkdir(out,{recursive:true});
const markdown=await fs.readFile('tiledata/pixel-art-world/DIRECT-AUTHORING.md','utf8');
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
function update(tile){
 const doc=tile?.referenceDocuments?.find(c=>c.id==='direct-authoring')?.documents.find(d=>d.id==='method');
 if(!doc)throw Error('Installed direct-authoring method missing'); doc.markdown=markdown;
}
let shared;
await withTsModule('scripts/lib/sharedContentSqlite.ts','update-direct-guide.mjs',async api=>{
 const before=api.readSharedContent().libraries['pixel-art-world-local'],library=structuredClone(before);
 update(library.tilesets.shared_paw_modern_interiors);
 const saved=api.publishSharedContent('pixel-art-world-local',library,hash(before));
 if(hash(saved.reloaded)!==hash(library))throw Error('Shared reload differs');
 shared={file:saved.file,revision:saved.revision,reloadedEqual:true};
});
const {call}=await connectHostBridge(host),status=await call('oprn:project.status');
let loaded=await call('oprn:project.load'),project=JSON.parse(loaded.serialized);
const maps=hash(project.maps),assets=hash(project.assets);
await call('oprn:project.backup',{projectDir:status.projectDir});
const changed=[];
for(const id of ['paw-modern-interiors','shared_paw_modern_interiors'])if(project.tilesets[id]){update(project.tilesets[id]);changed.push(id);}
if(!changed.length)throw Error('Canonical PAW interior tile missing');
const saved=await call('oprn:project.save',{projectDir:status.projectDir,serialized:JSON.stringify(project),expectedSha:loaded.sha256});
if(saved.kind!=='saved')throw Error('Canonical CAS rejected');
project=null;loaded=await call('oprn:project.load');const after=JSON.parse(loaded.serialized);
if(hash(after.maps)!==maps||hash(after.assets)!==assets)throw Error('Map/asset changed unexpectedly');
for(const id of changed){const doc=after.tilesets[id].referenceDocuments.find(c=>c.id==='direct-authoring').documents.find(d=>d.id==='method');if(doc.markdown!==markdown)throw Error('Canonical guide reload differs');}
const proof={shared,canonical:{projectId:status.projectId,projectDir:status.projectDir,revision:loaded.revision,sha256:loaded.sha256,reloadedEqual:true,changedTilesets:changed,mapsAndAssetsUnchanged:true},methodHash:hash(markdown)};
await fs.writeFile(out+'/guide-save-proof.json',JSON.stringify(proof,null,2));console.log(proof);
